export const THREE_MODULE_URLS = Object.freeze([
  "/vendor/three/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js",
  "https://unpkg.com/three@0.185.1/build/three.module.js",
]);

/** Load the first available module without making a CDN a hard dependency. */
export async function loadModuleWithFallback(urls, importer = (url) => import(url)) {
  let lastError = null;
  for (const url of urls) {
    try {
      return await importer(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No asset module locations were provided");
}

export function loadThreeEngine(importer) {
  return loadModuleWithFallback(THREE_MODULE_URLS, importer);
}
