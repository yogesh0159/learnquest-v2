// What does NOT go into the installed apps (Android, iOS, desktop). Kids' apps ship the game and the family pages, not developer tools,
// reference pictures or the old fallback models.  `rel` is a path inside frontend/ using "/".
const EXCLUDED = [
  "docs", "explorer.html", "asset-gallery.html", "selftest.html", "reference-studio.html", "js/explorer.js", "js/asset-gallery.js", "js/selftest.js", "js/reference-studio.js",
  "assets/reference", "assets/jungle/reference", "assets/jungle/path", "assets/characters", "sw.js", "precache-manifest.json",
];
export const isExcludedFromApps = (rel) => EXCLUDED.some((e) => rel === e || rel.startsWith(e + "/"));
