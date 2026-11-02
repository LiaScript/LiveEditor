// Parcel bug: a module shared only between workers lands in a shared chunk
// without being registered ("Cannot find module" in every worker). A
// non-top-level require marks it shouldWrap, so Parcel registers it.
// shortcut: remove once Parcel fixes isAssetReferenced() for worker bundles.
;(() => require('monaco-editor/esm/vs/editor/editor.worker'))()
