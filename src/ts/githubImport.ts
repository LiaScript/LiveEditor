// Shared logic for importing a set of repository files into a ProjectDoc.
// Used by the import dialog, the pull dialog and the ?/github/owner/repo route.

import { ProjectDoc, isTextFile } from "./ProjectDoc";
import * as GitHub from "./GitHubRepo";
import type { TreeItem, GitHubError } from "./GitHubRepo";

export type ChangeStatus = "added" | "modified" | "deleted";

export interface FileChange {
  path: string;
  status: ChangeStatus;
  isText: boolean;
  size?: number;
  // remote blob sha (modified/deleted) — for fetching the remote version
  remoteSha?: string;
}

/**
 * Compare the local explorer files of `doc` against the repository tree
 * `remoteItems` (blobs only). Returns one entry per differing file:
 *   - added    : exists locally, not on the remote
 *   - modified : exists on both, content (git blob sha) differs
 *   - deleted  : exists on the remote, not locally
 * Unchanged files are omitted.
 */
export async function computeChanges(
  doc: ProjectDoc,
  remoteItems: TreeItem[]
): Promise<FileChange[]> {
  const remote = new Map<string, TreeItem>();
  for (const item of remoteItems) {
    if (item.type === "blob") remote.set(item.path, item);
  }

  const changes: FileChange[] = [];
  const localPaths = new Set<string>();

  for (const { path, meta } of doc.entries()) {
    if (meta.type !== "file") continue;
    localPaths.add(path);
    const bytes = doc.readFileData(path);
    if (!bytes) continue;
    const remoteItem = remote.get(path);
    const isText = isTextFile(path, meta.mime);
    if (!remoteItem) {
      changes.push({ path, status: "added", isText, size: bytes.byteLength });
    } else {
      const localSha = await GitHub.gitBlobSha(bytes);
      if (localSha !== remoteItem.sha) {
        changes.push({
          path,
          status: "modified",
          isText,
          size: bytes.byteLength,
          remoteSha: remoteItem.sha,
        });
      }
    }
  }

  // remote files that no longer exist locally → deletions
  for (const [path, item] of remote) {
    if (!localPaths.has(path)) {
      changes.push({
        path,
        status: "deleted",
        isText: isTextFile(path),
        size: item.size,
        remoteSha: item.sha,
      });
    }
  }

  changes.sort((a, b) => a.path.localeCompare(b.path));
  return changes;
}

/**
 * Used when importing from an empty repository: the main course document
 * (README.md by default) already exists implicitly and starts empty, so the
 * project simply opens with that editable starter file. Returns its path.
 */
export function seedEmptyReadme(doc: ProjectDoc): string {
  return doc.getMainPath();
}

export interface ImportProgress {
  done: number;
  total: number;
  path: string;
}

/**
 * Download the given `paths` (blobs) from owner/repo and write them into `doc`.
 * Returns the number of imported files, or a GitHubError if a request failed
 * (e.g. rate_limit / auth) so the caller can prompt for a PAT and retry.
 */
export async function importPaths(
  doc: ProjectDoc,
  owner: string,
  repo: string,
  items: TreeItem[],
  paths: string[],
  pat: string | undefined,
  onProgress?: (p: ImportProgress) => void
): Promise<{ imported: number } | GitHubError> {
  const byPath = new Map(items.map((i) => [i.path, i]));
  let done = 0;
  let imported = 0;

  for (const path of paths) {
    const item = byPath.get(path);
    done++;
    if (!item || item.type !== "blob") continue;
    onProgress?.({ done, total: paths.length, path });

    const bytes = await GitHub.getBlob(owner, repo, item.sha, pat);
    if (GitHub.isError(bytes)) return bytes;

    // mime is left undefined: ProjectDoc.importFile decides text-vs-binary from
    // the file extension, which is what we want for README/js/images/audio.
    doc.importFile(path, bytes);
    imported++;
  }

  return { imported };
}
