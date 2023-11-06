module.exports = {
  globDirectory: "./dist",
  globPatterns: [
    "**/*.{ico,jpg,png,html,js,svg,webmanifest}"
  ],
  swSrc: "./src/sw.js",
  swDest: "./dist/sw.js",
  maximumFileSizeToCacheInBytes: 5000000, 
};
