module.exports = {
  globDirectory: "./dist",
  globPatterns: [
    "**/*.{ico,jpg,png,html,js,css,svg,webmanifest,json,woff,woff2,ttf,eot,wasm}"
  ],
  swSrc: "./src/sw.js",
  swDest: "./dist/sw.js",
  maximumFileSizeToCacheInBytes: 7000000, 
};
