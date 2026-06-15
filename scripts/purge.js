#!/usr/bin/env node
/*
 * Trim the production bundle: Monaco ships a separate lazy-loaded chunk for the
 * tokenizer of every "basic language". The LiveEditor only needs a curated set
 * (the languages the file explorer / multi-file editor actually highlights), so
 * we delete the chunks of all OTHER basic languages from dist.
 *
 * Language SERVICES (tsMode/cssMode/htmlMode/jsonMode and their workers) live
 * outside basic-languages and are intentionally kept — they power richer
 * editing for js/ts, css, html and json.
 *
 * This replaces the previous fragile `rm a* c*.js j* t* …` shell glob with an
 * allow-list that stays correct as Monaco adds/removes languages.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "dist");
const BASIC_LANGUAGES_DIR = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "monaco-editor",
  "esm",
  "vs",
  "basic-languages"
);

// Languages to KEEP (must stay in sync with languageFor() in Editor.vue).
const KEEP = new Set([
  "markdown",
  "javascript",
  "typescript",
  "css",
  "scss",
  "less",
  "html",
  "xml",
  "json",
  "python",
  "ruby",
  "php",
  "java",
  "cpp", // also provides the "c" language id
  "csharp",
  "go",
  "rust",
  "shell",
  "sql",
  "lua",
  "r",
  "yaml",
  "ini",
  "dockerfile",
  "powershell",
]);

if (!fs.existsSync(DIST)) {
  console.warn("purge: no dist/ directory, nothing to do");
  process.exit(0);
}

const allLanguages = fs
  .readdirSync(BASIC_LANGUAGES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const remove = new Set(allLanguages.filter((lang) => !KEEP.has(lang)));

let removedCount = 0;
let removedBytes = 0;

for (const file of fs.readdirSync(DIST)) {
  // match "<base>.<hash>.js" produced by Parcel for a language chunk
  const match = file.match(/^(.*)\.[a-z0-9]+\.js$/);
  if (!match) continue;

  const base = match[1];
  if (!remove.has(base)) continue;

  const full = path.join(DIST, file);
  removedBytes += fs.statSync(full).size;
  fs.unlinkSync(full);
  removedCount++;
}

console.log(
  `purge: removed ${removedCount} unused language chunks (${(
    removedBytes / 1024
  ).toFixed(0)} KB), kept ${KEEP.size} curated languages`
);
