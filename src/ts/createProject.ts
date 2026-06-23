// Shared helper for creating a brand new project from a set of files and
// handing it over to the editor. This captures the pattern first established in
// views/GitHub/DirectImport.vue so that every import source (file upload, URL,
// gist, ...) creates projects in exactly the same way.

import Dexie from "./indexDB";
import { navigateTo } from "../index";
import { randomString } from "./utils";
import { getProjectDoc } from "./ProjectDoc";

export interface ImportFile {
  /** Path inside the project, e.g. "README.md" or "img/logo.png". */
  path: string;
  bytes: Uint8Array;
  mime?: string;
}

/** Metadata stored in the Dexie index for the new project card. */
export interface ProjectMeta {
  title?: string;
  gist_url?: string;
  github?: { owner: string; repo: string; branch: string; commitSha: string };
}

/**
 * Create a new project, import every file into it, persist its index metadata
 * and navigate to the editor. The ProjectDoc reference is intentionally kept
 * (never released here): the editor view acquires the same shared instance, so
 * the freshly imported data stays persisted across the navigation.
 *
 * Returns the new storageId.
 */
export async function createProjectFromFiles(
  files: ImportFile[],
  meta: ProjectMeta = {}
): Promise<string> {
  const storageId = randomString(24);
  const doc = getProjectDoc(storageId);

  for (const file of files) {
    doc.importFile(file.path, file.bytes, file.mime);
  }

  const database = new Dexie();
  await database.put(storageId, { title: "", ...meta });

  navigateTo("?/edit/" + storageId);
  return storageId;
}

/** Decode the bytes of a single uploaded/fetched ZIP into a flat file list.
 *  jszip is loaded lazily (it is already a dependency, see utils.buildProjectZip). */
export async function filesFromZip(data: Uint8Array): Promise<ImportFile[]> {
  const mod: any = await import("jszip");
  const JSZip =
    typeof mod === "function"
      ? mod
      : typeof mod.default === "function"
      ? mod.default
      : mod.default && typeof mod.default.default === "function"
      ? mod.default.default
      : undefined;
  if (!JSZip) throw new Error("Could not load JSZip");

  const zip = await JSZip.loadAsync(data);
  const files: ImportFile[] = [];

  const entries = Object.values(zip.files) as any[];
  for (const entry of entries) {
    if (entry.dir) continue;
    const bytes = new Uint8Array(await entry.async("uint8array"));
    files.push({ path: entry.name, bytes });
  }

  return files;
}
