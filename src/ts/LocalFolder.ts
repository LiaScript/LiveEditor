// Low-level wrapper around the File System Access API plus persistence of the
// chosen directory handle and the "last-synced" manifest. This module knows
// nothing about ProjectDoc — the diff/apply logic lives in localFolderSync.ts.
//
// The File System Access API is only available in Chromium-based browsers, so
// every entry point is gated behind isSupported() by the callers. The DOM lib
// does not reliably ship these types, so handles are typed loosely as `any`.

import { Dexie } from "dexie";

/** A FileSystemDirectoryHandle (typed loosely; see file header). */
export type DirHandle = any;

/** Whether the current browser supports the File System Access API. */
export function isSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === "function";
}

/** Prompt the user to pick a folder with read/write access. */
export async function pickFolder(): Promise<DirHandle> {
  return await (window as any).showDirectoryPicker({ mode: "readwrite" });
}

/**
 * Ensure we have permission on a (possibly persisted) handle. Must be called
 * from a user gesture, because requestPermission() may show a prompt.
 */
export async function verifyPermission(
  handle: DirHandle,
  readWrite: boolean
): Promise<boolean> {
  const opts = { mode: readWrite ? "readwrite" : "read" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}

export interface LocalEntry {
  path: string;
  kind: "file" | "directory";
}

/** Directory/file names that are never mirrored. */
const IGNORED = new Set([".git", "node_modules", ".DS_Store"]);

/** Recursively list every file/folder below `handle` as POSIX-style paths. */
export async function readTree(handle: DirHandle): Promise<LocalEntry[]> {
  const out: LocalEntry[] = [];
  async function walk(dir: DirHandle, prefix: string) {
    for await (const entry of dir.values()) {
      if (IGNORED.has(entry.name)) continue;
      const path = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.kind === "directory") {
        out.push({ path, kind: "directory" });
        await walk(entry, path);
      } else {
        out.push({ path, kind: "file" });
      }
    }
  }
  await walk(handle, "");
  return out;
}

/** Resolve the directory handle that contains `path`, optionally creating it. */
async function parentDir(
  root: DirHandle,
  path: string,
  create: boolean
): Promise<{ dir: DirHandle; name: string }> {
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop()!;
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return { dir, name };
}

/** Read a file's bytes, or undefined if it does not exist. */
export async function readBytes(
  handle: DirHandle,
  path: string
): Promise<Uint8Array | undefined> {
  try {
    const { dir, name } = await parentDir(handle, path, false);
    const fileHandle = await dir.getFileHandle(name, { create: false });
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return undefined;
  }
}

/** Write a file, creating any intermediate folders. */
export async function writeBytes(
  handle: DirHandle,
  path: string,
  bytes: Uint8Array
): Promise<void> {
  const { dir, name } = await parentDir(handle, path, true);
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

/** Delete a file (or folder, recursively); silently ignores missing paths. */
export async function removePath(handle: DirHandle, path: string): Promise<void> {
  try {
    const { dir, name } = await parentDir(handle, path, false);
    await dir.removeEntry(name, { recursive: true });
  } catch {
    /* already gone */
  }
}

/** Stable content hash (SHA-256, hex) used for the manifest and the diff. */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// -----------------------------------------------------------------------------
// persistence: directory handle + last-synced manifest, keyed by storageId
// (separate Dexie database so the existing "LiveEditor" schema stays untouched)
// -----------------------------------------------------------------------------

interface FolderRecord {
  id: string;
  handle: DirHandle;
  name: string;
  /** path -> content hash at the time of the last successful sync */
  manifest: Record<string, string>;
}

const db = new Dexie("LiveEditorFS");
db.version(1).stores({ folders: "&id" });
const folders = () => db.table<FolderRecord, string>("folders");

export async function loadFolder(storageId: string): Promise<FolderRecord | undefined> {
  return await folders().get(storageId);
}

export async function loadHandle(storageId: string): Promise<DirHandle | undefined> {
  return (await loadFolder(storageId))?.handle;
}

/** Persist a freshly picked handle, preserving any existing manifest. */
export async function saveHandle(storageId: string, handle: DirHandle): Promise<void> {
  const existing = await loadFolder(storageId);
  await folders().put({
    id: storageId,
    handle,
    name: handle.name,
    manifest: existing?.manifest || {},
  });
}

export async function clearHandle(storageId: string): Promise<void> {
  await folders().delete(storageId);
}

export async function loadManifest(storageId: string): Promise<Map<string, string>> {
  const record = await loadFolder(storageId);
  return new Map(Object.entries(record?.manifest || {}));
}

export async function saveManifest(
  storageId: string,
  manifest: Map<string, string>
): Promise<void> {
  const record = await loadFolder(storageId);
  if (!record) return;
  record.manifest = Object.fromEntries(manifest);
  await folders().put(record);
}
