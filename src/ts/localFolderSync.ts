// 3-way sync between a ProjectDoc (editor side, source of truth for editing) and
// a local folder (disk side), using a persisted "last-synced" manifest as the
// common base. This lets us tell "only one side changed" apart from "both sides
// changed" (a conflict) instead of silently overwriting one side.
//
// Mirrors the role of githubImport.ts for the GitHub backend.

import { ProjectDoc, isTextFile } from "./ProjectDoc";
import * as LocalFolder from "./LocalFolder";
import { parseRepoUrl } from "./GitHubRepo";

export type SyncDirection = "push" | "pull" | "conflict";
/** The change relative to the last sync (for display/labelling only). */
export type SyncOp = "added" | "modified" | "deleted";

export interface SyncEntry {
  path: string;
  direction: SyncDirection;
  op: SyncOp;
  isText: boolean;
  size?: number;
  /** for conflicts: which side the user chose to keep */
  resolution?: "editor" | "disk";
}

interface Side {
  bytes?: Uint8Array;
  hash?: string;
}

/**
 * Compare the editor files of `doc`, the files on disk under `handle` and the
 * last-synced `manifest`. Returns one entry per differing path; in-sync files
 * are omitted.
 */
export async function computeSync(
  doc: ProjectDoc,
  handle: LocalFolder.DirHandle,
  manifest: Map<string, string>
): Promise<SyncEntry[]> {
  // editor side
  const editor = new Map<string, Side>();
  for (const { path, meta } of doc.entries()) {
    if (meta.type !== "file") continue;
    const bytes = doc.readFileData(path);
    if (!bytes) continue;
    editor.set(path, { bytes, hash: await LocalFolder.hashBytes(bytes) });
  }

  // disk side
  const disk = new Map<string, Side>();
  for (const entry of await LocalFolder.readTree(handle)) {
    if (entry.kind !== "file") continue;
    const bytes = await LocalFolder.readBytes(handle, entry.path);
    if (!bytes) continue;
    disk.set(entry.path, { bytes, hash: await LocalFolder.hashBytes(bytes) });
  }

  const paths = new Set<string>([
    ...editor.keys(),
    ...disk.keys(),
    ...manifest.keys(),
  ]);

  const entries: SyncEntry[] = [];
  for (const path of paths) {
    const e = editor.get(path);
    const d = disk.get(path);
    const base = manifest.get(path);
    const editorHash = e?.hash;
    const diskHash = d?.hash;

    // identical on both sides → nothing to do
    if (editorHash === diskHash) continue;

    const editorChanged = editorHash !== base;
    const diskChanged = diskHash !== base;
    const isText = isTextFile(path, undefined);
    const size = (e?.bytes ?? d?.bytes)?.byteLength;

    // An empty editor file that was never synced (base === undefined) is just a
    // blank placeholder — e.g. the starter README.md of a fresh project or a
    // freshly cloned repo. Adopt the disk version automatically instead of
    // flagging a conflict, so importing real content "just works".
    const blankPlaceholder = !!e && e.bytes!.byteLength === 0 && base === undefined;

    if (e && d) {
      // present on both, content differs
      if (blankPlaceholder && d.bytes!.byteLength > 0) {
        entries.push({ path, direction: "pull", op: "modified", isText, size });
      } else if (editorChanged && diskChanged) {
        entries.push({ path, direction: "conflict", op: "modified", isText, size });
      } else if (editorChanged) {
        entries.push({ path, direction: "push", op: "modified", isText, size });
      } else {
        entries.push({ path, direction: "pull", op: "modified", isText, size });
      }
    } else if (e && !d) {
      // missing on disk
      if (base === undefined) {
        entries.push({ path, direction: "push", op: "added", isText, size });
      } else if (!editorChanged) {
        entries.push({ path, direction: "pull", op: "deleted", isText, size });
      } else {
        // editor changed, disk deleted → conflict
        entries.push({ path, direction: "conflict", op: "deleted", isText, size });
      }
    } else if (!e && d) {
      // missing in editor
      if (base === undefined) {
        entries.push({ path, direction: "pull", op: "added", isText, size });
      } else if (!diskChanged) {
        entries.push({ path, direction: "push", op: "deleted", isText, size });
      } else {
        // disk changed, editor deleted → conflict
        entries.push({ path, direction: "conflict", op: "deleted", isText, size });
      }
    }
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

export interface SyncProgress {
  done: number;
  total: number;
  path: string;
}

/**
 * Apply the given (selected, conflicts resolved) entries in both directions and
 * return the updated manifest. Unselected paths and in-sync files keep their
 * previous manifest hash. Conflicts without a resolution are skipped.
 */
export async function applySync(
  doc: ProjectDoc,
  handle: LocalFolder.DirHandle,
  entries: SyncEntry[],
  manifest: Map<string, string>,
  onProgress?: (p: SyncProgress) => void
): Promise<Map<string, string>> {
  const result = new Map(manifest);
  let done = 0;

  for (const entry of entries) {
    done++;
    onProgress?.({ done, total: entries.length, path: entry.path });

    // resolve the effective direction; skip unresolved conflicts
    let direction: "push" | "pull";
    if (entry.direction === "conflict") {
      if (!entry.resolution) continue;
      direction = entry.resolution === "disk" ? "pull" : "push";
    } else {
      direction = entry.direction;
    }

    if (direction === "push") {
      // make disk match the editor
      const bytes = doc.readFileData(entry.path);
      if (bytes) {
        await LocalFolder.writeBytes(handle, entry.path, bytes);
        result.set(entry.path, await LocalFolder.hashBytes(bytes));
      } else {
        await LocalFolder.removePath(handle, entry.path);
        result.delete(entry.path);
      }
    } else {
      // make the editor match disk
      const bytes = await LocalFolder.readBytes(handle, entry.path);
      if (bytes) {
        doc.importFile(entry.path, bytes);
        result.set(entry.path, await LocalFolder.hashBytes(bytes));
      } else {
        doc.deletePath(entry.path);
        result.delete(entry.path);
      }
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// detect an existing GitHub repository from a folder's .git metadata, so a
// project opened from disk can be pushed straight back to GitHub
// -----------------------------------------------------------------------------

export interface DetectedRepo {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
}

/** Extract a GitHub remote URL from a raw .git/config (origin preferred). */
function gitConfigGitHubUrl(config: string): string | undefined {
  const remotes: Record<string, string> = {};
  const re = /\[remote\s+"([^"]+)"\]([^[]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(config))) {
    const url = m[2].match(/^\s*url\s*=\s*(.+?)\s*$/m);
    if (url) remotes[m[1]] = url[1].trim();
  }
  const isGitHub = (u?: string) => !!u && /github\.com/i.test(u);
  if (isGitHub(remotes["origin"])) return remotes["origin"];
  return Object.values(remotes).find(isGitHub);
}

/**
 * Inspect the folder's `.git` directory and, if it is a GitHub clone, return
 * the owner/repo/branch (and best-effort head sha) so the editor can link it as
 * a GitHub project. Returns undefined for non-git or non-GitHub folders.
 */
export async function detectGitHubRemote(
  handle: LocalFolder.DirHandle
): Promise<DetectedRepo | undefined> {
  const configBytes = await LocalFolder.readBytes(handle, ".git/config");
  if (!configBytes) return undefined;
  const url = gitConfigGitHubUrl(new TextDecoder().decode(configBytes));
  if (!url) return undefined;
  const ref = parseRepoUrl(url);
  if (!ref) return undefined;

  // current branch from .git/HEAD ("ref: refs/heads/<branch>")
  let branch = ref.branch || "main";
  const headBytes = await LocalFolder.readBytes(handle, ".git/HEAD");
  if (headBytes) {
    const head = new TextDecoder().decode(headBytes).trim();
    const match = head.match(/ref:\s*refs\/heads\/(.+)$/);
    if (match) branch = match[1].trim();
  }

  // head commit sha (optional — only used to detect remote drift)
  let commitSha = "";
  const shaBytes = await LocalFolder.readBytes(handle, ".git/refs/heads/" + branch);
  if (shaBytes) commitSha = new TextDecoder().decode(shaBytes).trim();

  return { owner: ref.owner, repo: ref.repo, branch, commitSha };
}
