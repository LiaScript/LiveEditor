#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const I18N_DIR = path.resolve(__dirname, "..", "src", "i18n");
const REFERENCE_FILE = "en.json";

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(I18N_DIR, file), "utf8"));
}

function flattenEntries(value, prefix = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).flatMap((key) =>
      flattenEntries(value[key], prefix ? `${prefix}.${key}` : key)
    );
  }

  return [[prefix, value]];
}

function placeholderNames(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
}

function diff(left, right) {
  return [...left].filter((key) => !right.has(key)).sort();
}

const files = fs
  .readdirSync(I18N_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort();

const maps = Object.fromEntries(
  files.map((file) => [file, new Map(flattenEntries(readJson(file)))])
);

const reference = maps[REFERENCE_FILE];
const referenceKeys = new Set(reference.keys());
const issues = [];

for (const file of files) {
  const map = maps[file];
  const keys = new Set(map.keys());
  const missing = diff(referenceKeys, keys);
  const extra = diff(keys, referenceKeys);

  if (missing.length) {
    issues.push(`${file}: missing keys:\n  ${missing.join("\n  ")}`);
  }

  if (extra.length) {
    issues.push(`${file}: extra keys:\n  ${extra.join("\n  ")}`);
  }

  for (const [key, value] of map) {
    if (typeof value !== "string" || value.length === 0) {
      issues.push(`${file}: ${key} must be a non-empty string`);
    }
  }
}

for (const file of files.filter((file) => file !== REFERENCE_FILE)) {
  const map = maps[file];

  for (const [key, referenceValue] of reference) {
    if (!map.has(key)) continue;

    const expected = placeholderNames(referenceValue).join("|");
    const actual = placeholderNames(map.get(key)).join("|");

    if (expected !== actual) {
      issues.push(
        `${file}: ${key} placeholders differ from ${REFERENCE_FILE} ` +
          `(expected: ${expected || "-"}, actual: ${actual || "-"})`
      );
    }
  }
}

if (issues.length) {
  console.error(`i18n check failed with ${issues.length} issue(s):`);
  console.error(issues.join("\n\n"));
  process.exit(1);
}

console.log(`i18n check passed for ${files.length} locale files.`);
