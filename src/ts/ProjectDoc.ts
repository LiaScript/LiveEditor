import * as Y from "yjs";

import { IndexeddbPersistence } from "y-indexeddb";
import { GenericProvider } from "y-generic";
import { PeerJSTransport } from "y-generic/dist/providers/peerjs";
import { WebSocketTransport } from "y-generic/dist/providers/websocket";
// peerjs is heavy (WebRTC) and only needed for the "webrtc" connection mode, so
// it is loaded on demand in the constructor to keep it out of the editor's
// startup bundle (see the "webrtc" case below).

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** File extensions that should be opened as editable text in the editor. */
const TEXT_EXTENSIONS = new Set([
  "md", "markdown", "txt", "text", "log",
  "js", "mjs", "cjs", "jsx", "ts", "tsx", "json", "jsonc",
  "css", "scss", "less", "html", "htm", "xml",
  "csv", "tsv", "yaml", "yml", "toml", "ini", "cfg", "conf", "env",
  "py", "rb", "php", "java", "c", "h", "cpp", "hpp", "cs", "go", "rs",
  "sh", "bash", "zsh", "sql", "r", "lua", "pl", "swift", "kt", "dart",
  "vue", "svelte", "gitignore", "lia",
]);

/** File extensions that should be displayed as an image. */
const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "ico", "svg",
]);

/** File extensions that should be played as audio. */
const AUDIO_EXTENSIONS = new Set([
  "mp3", "ogg", "wav", "flac", "aac", "opus", "m4a",
]);

/** File extensions that should be played as a video. */
const VIDEO_EXTENSIONS = new Set([
  "webm", "mp4", "ogv", "ogg", "mov", "avi", "mkv", "m4v",
]);

function extensionOf(path: string): string {
  const name = path.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Decide whether a path should be treated as editable text. */
export function isTextFile(path: string, mime?: string): boolean {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return false;
  if (m.startsWith("text/")) return true;
  if (m === "application/json" || m === "application/javascript" || m === "application/xml")
    return true;
  const ext = extensionOf(path);
  // SVG is XML and editable, but we prefer to display it as an image.
  if (ext === "svg") return false;
  return TEXT_EXTENSIONS.has(ext);
}

/** Decide whether a path should be displayed as an image. */
export function isImageFile(path: string, mime?: string): boolean {
  if ((mime || "").toLowerCase().startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.has(extensionOf(path));
}

export function isAudioFile(path: string, mime?: string): boolean {
  if ((mime || "").toLowerCase().startsWith("audio/")) return true;
  return AUDIO_EXTENSIONS.has(extensionOf(path));
}

/** Decide whether a path should be played as a video. */
export function isVideoFile(path: string, mime?: string): boolean {
  if ((mime || "").toLowerCase().startsWith("video/")) return true;
  return VIDEO_EXTENSIONS.has(extensionOf(path));
}

export type FileType = "file" | "folder";

export interface FileMeta {
  type: FileType;
  mime?: string;
  size?: number;
}

export interface FileEntry {
  path: string;
  meta: FileMeta;
}

/**
 * A ProjectDoc bundles the shared Yjs document for a single LiaScript project
 * (identified by its storageId) together with its network provider and
 * IndexedDB persistence. Both the Monaco editor and the file explorer use the
 * SAME instance so that every mutation is automatically persisted and synced.
 *
 *  - `content`  : Y.Text       -> the single editable LiaScript markdown file
 *  - `blob`     : Y.Map        -> legacy inline media, keyed by `hash+ending`
 *  - `files`    : Y.Map<FileMeta> -> the file-explorer tree (path -> metadata)
 *  - `fileData` : Y.Map<Uint8Array> -> binary content of explorer files (path -> bytes)
 */
export class ProjectDoc {
  readonly storageId: string;
  readonly ydoc: Y.Doc;
  // Not readonly: for the "webrtc" connection the provider is created
  // asynchronously (peerjs is loaded on demand, see constructor), so it starts
  // as null and is set later via setProvider().
  provider: any | null = null;
  readonly idb: IndexeddbPersistence;
  readonly content: Y.Text;
  readonly blob: Y.Map<any>;
  readonly files: Y.Map<FileMeta>;
  readonly fileData: Y.Map<Uint8Array>;
  readonly fileText: Y.Map<Y.Text>;

  /** internal reference counter for shared lifetime management */
  refCount = 0;

  /** callbacks waiting for the network provider (may arrive asynchronously) */
  private providerCallbacks: ((provider: any) => void)[] = [];

  /**
   * Register a callback for when the network provider becomes available. Fires
   * immediately if the provider already exists (websocket / no connection),
   * or later once the lazily-loaded webrtc provider is ready.
   */
  onProvider(cb: (provider: any) => void) {
    if (this.provider) cb(this.provider);
    else this.providerCallbacks.push(cb);
  }

  private setProvider(provider: any) {
    this.provider = provider;
    this.providerCallbacks.forEach((cb) => cb(provider));
    this.providerCallbacks = [];
  }

  constructor(storageId: string, connection?: string) {
    this.storageId = storageId;
    this.ydoc = new Y.Doc();

    let provider: any = null;

    switch (connection) {
      case "webrtc": {
        // Load peerjs lazily; provider stays null until it resolves and is then
        // published via setProvider() to any onProvider() subscribers.
        import("peerjs")
          .then(({ default: Peer }) => {
            const peerTransport = new PeerJSTransport({
              peer: Peer,
              peerOptions: {
                config: {
                  iceServers: JSON.parse(process.env.ICE_SERVERS || "[]"),
                },
              },
            });
            const p = new GenericProvider(this.ydoc, peerTransport);
            p.connect({ room: storageId }).catch(console.error);
            this.setProvider(p);
          })
          .catch(console.error);
        break;
      }
      case "websocket": {
        const wsTransport = new WebSocketTransport();
        provider = new GenericProvider(this.ydoc, wsTransport, {
          verifyUpdates: false, // Required for y-websocket server compatibility
        });
        provider
          .connect({
            serverUrl: process.env.WEBSOCKET_SERVER || "wss://aamkeaam.com",
            room: storageId,
          })
          .catch(console.error);
        break;
      }
      default: {
        provider = null;
      }
    }

    this.provider = provider;
    this.idb = new IndexeddbPersistence(storageId, this.ydoc);

    this.content = this.ydoc.getText(storageId);
    this.blob = this.ydoc.getMap("blob");
    this.files = this.ydoc.getMap("files");
    this.fileData = this.ydoc.getMap("fileData");
    this.fileText = this.ydoc.getMap("fileText");
  }

  // ---------------------------------------------------------------------------
  // file-tree helpers — all mutations run in a single transaction so that yjs
  // persists/syncs them atomically.
  // ---------------------------------------------------------------------------

  /**
   * Normalize a path: strip leading/trailing slashes, collapse doubles and drop
   * "." segments (so "./repo.js" and "repo.js" resolve to the same file).
   */
  static normalize(path: string): string {
    return path
      .split("/")
      .filter((segment) => segment.length > 0 && segment !== ".")
      .join("/");
  }

  /** Ensure every parent folder of `path` exists as an explicit entry. */
  private ensureParents(path: string) {
    const segments = path.split("/");
    let prefix = "";
    for (let i = 0; i < segments.length - 1; i++) {
      prefix = prefix ? prefix + "/" + segments[i] : segments[i];
      if (this.files.get(prefix)?.type !== "folder") {
        this.files.set(prefix, { type: "folder" });
      }
    }
  }

  exists(path: string): boolean {
    return this.files.has(ProjectDoc.normalize(path));
  }

  createFile(path: string, mime?: string): string {
    const norm = ProjectDoc.normalize(path);
    this.ydoc.transact(() => {
      this.ensureParents(norm);
      this.files.set(norm, { type: "file", mime, size: 0 });
      // The editable Y.Text content is created lazily on first open via getText().
    });
    return norm;
  }

  createFolder(path: string): string {
    const norm = ProjectDoc.normalize(path);
    this.ydoc.transact(() => {
      this.ensureParents(norm);
      this.files.set(norm, { type: "folder" });
    });
    return norm;
  }

  deletePath(path: string) {
    const norm = ProjectDoc.normalize(path);
    const prefix = norm + "/";
    this.ydoc.transact(() => {
      for (const key of Array.from(this.files.keys())) {
        if (key === norm || key.startsWith(prefix)) {
          this.files.delete(key);
          this.fileData.delete(key);
          this.fileText.delete(key);
        }
      }
    });
  }

  /** Rename/move a file or folder (and everything below it) to a new path. */
  renamePath(from: string, to: string) {
    const src = ProjectDoc.normalize(from);
    const dst = ProjectDoc.normalize(to);
    if (src === dst || !this.files.has(src)) return;

    const srcPrefix = src + "/";
    this.ydoc.transact(() => {
      this.ensureParents(dst);
      for (const key of Array.from(this.files.keys())) {
        let target: string | null = null;
        if (key === src) {
          target = dst;
        } else if (key.startsWith(srcPrefix)) {
          target = dst + "/" + key.slice(srcPrefix.length);
        }
        if (target === null) continue;

        const meta = this.files.get(key)!;
        this.files.set(target, meta);
        this.files.delete(key);

        if (this.fileData.has(key)) {
          this.fileData.set(target, this.fileData.get(key)!);
          this.fileData.delete(key);
        }

        // A Y.Text can only live in one place, so move it by copying its string.
        const yt = this.fileText.get(key);
        if (yt) {
          const moved = new Y.Text();
          this.fileText.set(target, moved);
          const value = yt.toString();
          if (value) moved.insert(0, value);
          this.fileText.delete(key);
        }
      }
    });
  }

  /** Move a path into the given destination folder (keeping its base name). */
  movePath(from: string, toFolder: string) {
    const src = ProjectDoc.normalize(from);
    const folder = ProjectDoc.normalize(toFolder);
    const base = src.split("/").pop()!;
    const dst = folder ? folder + "/" + base : base;
    if (dst === src) return;
    // don't move a folder into itself / its own subtree
    if (dst === src || dst.startsWith(src + "/")) return;
    this.renamePath(src, dst);
  }

  /** Find a free path by appending `-1`, `-2`, ... before the extension. */
  uniquePath(path: string): string {
    const norm = ProjectDoc.normalize(path);
    if (!this.files.has(norm)) return norm;

    const slash = norm.lastIndexOf("/");
    const dir = slash >= 0 ? norm.slice(0, slash + 1) : "";
    const name = slash >= 0 ? norm.slice(slash + 1) : norm;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";

    let i = 1;
    let candidate: string;
    do {
      candidate = `${dir}${stem}-${i}${ext}`;
      i++;
    } while (this.files.has(candidate));
    return candidate;
  }

  /**
   * Store an uploaded media file under its ORIGINAL name in the explorer,
   * returning the final (possibly disambiguated) path used to reference it.
   * Identical re-uploads of the same name are de-duplicated.
   */
  addUpload(filename: string, data: Uint8Array, mime?: string): string {
    const base = ProjectDoc.normalize(filename) || "file";
    const existing = this.fileData.get(base);
    if (existing && bytesEqual(existing, data)) {
      return base;
    }
    const path = this.uniquePath(base);
    this.writeFileData(path, data, mime);
    return path;
  }

  writeFileData(path: string, data: Uint8Array, mime?: string): string {
    const norm = ProjectDoc.normalize(path);
    this.ydoc.transact(() => {
      this.ensureParents(norm);
      this.files.set(norm, { type: "file", mime, size: data.byteLength });
      this.fileData.set(norm, data);
      this.fileText.delete(norm); // bytes are now the single source of truth
    });
    return norm;
  }

  readFileData(path: string): Uint8Array | undefined {
    const norm = ProjectDoc.normalize(path);
    const bytes = this.fileData.get(norm);
    if (bytes) return bytes;
    // text files are stored as Y.Text -> encode them back to bytes on demand
    const yt = this.fileText.get(norm);
    if (yt) return new TextEncoder().encode(yt.toString());
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // editable text files (collaborative, one nested Y.Text per path)
  // ---------------------------------------------------------------------------

  /**
   * Return the collaborative Y.Text for a text file, creating it on first use.
   * If the file was previously stored as raw bytes (e.g. uploaded), those bytes
   * are decoded as UTF-8 to seed the text and then removed.
   */
  getText(path: string): Y.Text {
    const norm = ProjectDoc.normalize(path);
    let yt = this.fileText.get(norm);
    if (!yt) {
      const created = new Y.Text();
      this.ydoc.transact(() => {
        const bytes = this.fileData.get(norm);
        const seed = bytes ? new TextDecoder().decode(bytes) : "";
        this.fileText.set(norm, created);
        if (seed) created.insert(0, seed);
        if (bytes) this.fileData.delete(norm);
        if (!this.files.has(norm)) {
          this.ensureParents(norm);
          this.files.set(norm, { type: "file" });
        }
      });
      yt = created;
    }
    return yt;
  }

  /** Replace the content of a text file (creating it if necessary). */
  setText(path: string, text: string, mime?: string): string {
    const norm = ProjectDoc.normalize(path);
    this.ydoc.transact(() => {
      this.ensureParents(norm);
      this.files.set(norm, { type: "file", mime, size: text.length });
      let yt = this.fileText.get(norm);
      if (!yt) {
        yt = new Y.Text();
        this.fileText.set(norm, yt);
      } else if (yt.length) {
        yt.delete(0, yt.length);
      }
      if (text) yt.insert(0, text);
      this.fileData.delete(norm);
    });
    return norm;
  }

  /**
   * Import an uploaded file: text files become editable Y.Text, binary files
   * (images, ...) are stored as bytes. Returns the path used.
   */
  importFile(path: string, data: Uint8Array, mime?: string): string {
    const norm = ProjectDoc.normalize(path);
    if (isTextFile(norm, mime)) {
      return this.setText(norm, new TextDecoder().decode(data), mime);
    }
    return this.writeFileData(norm, data, mime);
  }

  /** All explorer entries as a flat list (sorted by path). */
  entries(): FileEntry[] {
    const list: FileEntry[] = [];
    this.files.forEach((meta, path) => list.push({ path, meta }));
    list.sort((a, b) => a.path.localeCompare(b.path));
    return list;
  }
}

// -----------------------------------------------------------------------------
// shared, reference-counted registry keyed by storageId
// -----------------------------------------------------------------------------

const registry = new Map<string, ProjectDoc>();

/** Acquire the shared ProjectDoc for `storageId` (creating it on first use). */
export function getProjectDoc(storageId: string, connection?: string): ProjectDoc {
  let doc = registry.get(storageId);
  if (!doc) {
    doc = new ProjectDoc(storageId, connection);
    registry.set(storageId, doc);
  }
  doc.refCount++;
  return doc;
}

/** Release a previously acquired ProjectDoc; destroys it once unused. */
export function releaseProjectDoc(storageId: string) {
  const doc = registry.get(storageId);
  if (!doc) return;
  doc.refCount--;
  if (doc.refCount <= 0) {
    if (doc.provider) doc.provider.destroy();
    doc.idb.destroy();
    doc.ydoc.destroy();
    registry.delete(storageId);
  }
}

/** Peek at an already-acquired ProjectDoc without changing its ref count. */
export function peekProjectDoc(storageId: string): ProjectDoc | undefined {
  return registry.get(storageId);
}
