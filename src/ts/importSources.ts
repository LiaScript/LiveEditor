// Central registry of the ways a user can start / import a project from the
// index page. Adding a new source is a matter of appending one entry here and
// (for modal/file sources) one async handler — the ImportMenu and
// ImportUrlModal components render whatever is registered.

import { navigateTo } from "../index";
import { getGithubPat } from "./utils";
import { parseRepoUrl } from "./GitHubRepo";
import { createProjectFromFiles, filesFromZip, ImportFile, ProjectMeta } from "./createProject";
import * as LocalFolder from "./LocalFolder";
import { detectGitHubRemote } from "./localFolderSync";

export type SourceKind = "navigate" | "fileInput" | "modal";

export interface ImportSource {
  id: string;
  /** bootstrap-icons class, e.g. "bi-github". */
  icon: string;
  /** i18n key for the menu label. */
  labelKey: string;
  kind: SourceKind;
  /** fileInput: accepted file extensions/mime for the <input accept>. */
  accept?: string;
  /** fileInput: read the chosen files and create a project. */
  onFiles?: (files: FileList) => Promise<void>;
  /** modal: i18n keys for the input placeholder / helper text. */
  placeholderKey?: string;
  hintKey?: string;
  /** modal: handle the entered text. Throw an Error whose message is an
   *  `index.import.errors.*` sub-key (or raw text) on invalid input. */
  onSubmit?: (input: string) => Promise<void>;
  /** navigate: simple action without further input (e.g. new empty course). */
  onSelect?: () => void;
  /** optional gate: hide the source when it returns false (e.g. unsupported). */
  available?: () => boolean;
}

const MD_EXT = /\.(md|markdown)$/i;
const ZIP_EXT = /\.zip$/i;

function baseName(name: string): string {
  return name.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Build the import file list from a single uploaded/fetched file. A markdown
 *  file is placed at the main document path (README.md) so it opens as the
 *  course content; a zip is expanded; anything else is imported verbatim. */
async function filesFromSingle(
  name: string,
  bytes: Uint8Array,
  contentType?: string
): Promise<ImportFile[]> {
  if (ZIP_EXT.test(name) || contentType === "application/zip") {
    return filesFromZip(bytes);
  }
  if (MD_EXT.test(name) || !name.includes(".")) {
    return [{ path: "README.md", bytes, mime: "text/markdown" }];
  }
  return [{ path: name.replace(/^.*\//, ""), bytes }];
}

export const importSources: ImportSource[] = [
  {
    id: "new",
    icon: "bi-file-earmark-plus",
    labelKey: "index.import.new",
    kind: "navigate",
    onSelect: () => navigateTo("?/edit"),
  },

  {
    id: "upload",
    icon: "bi-upload",
    labelKey: "index.import.upload",
    kind: "fileInput",
    accept: ".md,.markdown,.zip",
    async onFiles(list) {
      const file = list[0];
      if (!file) return;
      const bytes = await fileToBytes(file);
      const files = await filesFromSingle(file.name, bytes, file.type);
      await createProjectFromFiles(files, { title: baseName(file.name) });
    },
  },

  {
    id: "github",
    icon: "bi-github",
    labelKey: "index.import.github",
    kind: "modal",
    placeholderKey: "index.import.githubPlaceholder",
    hintKey: "index.import.githubHint",
    async onSubmit(input) {
      const ref = parseRepoUrl(input);
      if (!ref) throw new Error("invalidRepo");
      navigateTo("?/github/" + ref.owner + "/" + ref.repo);
    },
  },

  {
    id: "url",
    icon: "bi-link-45deg",
    labelKey: "index.import.url",
    kind: "modal",
    placeholderKey: "index.import.urlPlaceholder",
    hintKey: "index.import.urlHint",
    async onSubmit(input) {
      const url = input.trim();
      if (!/^https?:\/\//.test(url)) throw new Error("invalidUrl");

      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        throw new Error("fetchFailed");
      }
      if (!response.ok) throw new Error("fetchFailed");

      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
      const name = url.split("/").pop() || "README.md";
      const files = await filesFromSingle(name, bytes, contentType);
      await createProjectFromFiles(files, { title: baseName(name) || "Import" });
    },
  },

  {
    id: "gist",
    icon: "bi-filetype-md",
    labelKey: "index.import.gist",
    kind: "modal",
    placeholderKey: "index.import.gistPlaceholder",
    hintKey: "index.import.gistHint",
    async onSubmit(input) {
      const match = input.trim().match(/([0-9a-f]{20,})/i);
      if (!match) throw new Error("invalidGist");
      const id = match[1];

      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      const pat = getGithubPat();
      if (pat) headers.Authorization = "Bearer " + pat;

      let response: Response;
      try {
        response = await fetch("https://api.github.com/gists/" + id, { headers });
      } catch {
        throw new Error("fetchFailed");
      }
      if (!response.ok) throw new Error(response.status === 404 ? "invalidGist" : "fetchFailed");

      const gist = await response.json();
      const gistFiles = Object.values(gist.files || {}) as any[];
      if (gistFiles.length === 0) throw new Error("invalidGist");

      // the main document is README.md if present, otherwise the first markdown
      // file, otherwise simply the first file in the gist
      const mainFile =
        gistFiles.find((f) => /^readme\.md$/i.test(f.filename)) ||
        gistFiles.find((f) => MD_EXT.test(f.filename)) ||
        gistFiles[0];

      const files: ImportFile[] = [];
      for (const f of gistFiles) {
        let content: string = f.content ?? "";
        if (f.truncated && f.raw_url) {
          const raw = await fetch(f.raw_url);
          content = await raw.text();
        }
        const path = f === mainFile ? "README.md" : f.filename;
        files.push({ path, bytes: new TextEncoder().encode(content) });
      }

      await createProjectFromFiles(files, {
        title: gist.description || mainFile.filename,
        // makes the card's "Gist" badge + export link work
        gist_url: mainFile.raw_url,
      });
    },
  },

  {
    id: "localFolder",
    icon: "bi-folder2-open",
    labelKey: "index.import.localFolder",
    kind: "navigate",
    // File System Access API is Chromium-only.
    available: () => LocalFolder.isSupported(),
    async onSelect() {
      let handle: LocalFolder.DirHandle;
      try {
        handle = await LocalFolder.pickFolder();
      } catch {
        return; // user dismissed the picker
      }

      const meta: ProjectMeta = {
        title: handle.name,
        localFolder: { name: handle.name },
      };
      // if the folder is a GitHub clone, link it so the user can push directly
      const repo = await detectGitHubRemote(handle);
      if (repo) meta.github = repo;

      // Create an empty project linked to the folder and open the sync dialog in
      // the editor (with an empty manifest, every file on disk shows up as a
      // pull) — exactly like opening a folder from inside an existing project.
      await createProjectFromFiles([], meta, {
        syncOnOpen: true,
        onReady: (storageId) => LocalFolder.saveHandle(storageId, handle),
      });
    },
  },
];
