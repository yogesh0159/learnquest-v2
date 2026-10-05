/*
 * LearnQuest platform layer (classic script, also loadable from Node for tests).
 * Tells every page where it runs - browser, installed web app (PWA), Android / iOS app (Capacitor) or desktop app (Electron) - and on which
 * operating system, and resolves the server address the app talks to.
 *
 *   window.LQ_PLATFORM = { kind: "web" | "pwa" | "capacitor" | "electron", os: "android" | "ios" | "windows" | "mac" | "linux" | "unknown",
 *                          phone, tablet, touch, standalone, webview, secure }
 *   window.LQ_CONFIG   = { apiBase }   // "" = same server as the page (website); an https://... address for installed apps
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) { root.LQ_PLATFORM = api.detectPlatform(root); root.LQ_CONFIG = api.resolveConfig(root); }
})(typeof window !== "undefined" ? window : this, function () {
  function detectPlatform(env) {
    env = env || {};
    var nav = env.navigator || {}, ua = String(nav.userAgent || ""), plat = String(nav.platform || "");
    var touchPoints = nav.maxTouchPoints || 0;
    var ios = /iPhone|iPad|iPod/.test(ua) || (plat === "MacIntel" && touchPoints > 1);
    var android = /Android/i.test(ua);
    var os = ios ? "ios" : android ? "android" : /Windows/i.test(ua) ? "windows" : /Mac/i.test(ua) ? "mac" : /Linux|X11|CrOS/i.test(ua) ? "linux" : "unknown";
    var cap = env.Capacitor, capacitor = !!(cap && ((typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) || (cap.getPlatform && cap.getPlatform() !== "web")));
    var electron = /Electron\//.test(ua) || !!(env.process && env.process.versions && env.process.versions.electron) || !!env.LQ_ELECTRON;
    var standalone = !!(nav.standalone || (env.matchMedia && (env.matchMedia("(display-mode: standalone)").matches || env.matchMedia("(display-mode: fullscreen)").matches)));
    var touch = touchPoints > 0 || !!(env.matchMedia && env.matchMedia("(pointer: coarse)").matches);
    var w = (env.screen && env.screen.width) || 0, h = (env.screen && env.screen.height) || 0, small = Math.min(w, h);
    var mobileOs = os === "android" || os === "ios";
    var kind = electron ? "electron" : capacitor ? "capacitor" : standalone ? "pwa" : "web";
    return {
      kind: kind, os: os, touch: touch, standalone: standalone || capacitor || electron,
      phone: mobileOs && touch && (small === 0 || small < 600), tablet: mobileOs && touch && small >= 600,
      webview: capacitor || /; wv\)/.test(ua) || (ios && !/Safari\//.test(ua)),
      secure: !!(env.isSecureContext !== false),
    };
  }

  /** Where do the API calls go?  native shell setting > ?api= (remembered) > saved value > same server. */
  function resolveConfig(env) {
    env = env || {}; var store = null; try { store = env.localStorage; } catch (e) { store = null; }
    var fromShell = env.LQ_NATIVE_CONFIG && env.LQ_NATIVE_CONFIG.apiBase;
    var fromUrl = ""; try { fromUrl = new URL(env.location.href).searchParams.get("api") || ""; } catch (e) { fromUrl = ""; }
    var saved = ""; try { saved = (store && store.getItem("lq_api_base")) || ""; } catch (e) { saved = ""; }
    var base = normalizeBase(fromShell || fromUrl || saved);
    if (fromUrl && base && store) { try { store.setItem("lq_api_base", base); } catch (e) { /* storage blocked */ } }
    return { apiBase: base };
  }

  function normalizeBase(value) {
    var v = String(value || "").trim().replace(/\/+$/, "").replace(/\/api$/, "");
    if (!v) return "";
    if (!/^https?:\/\/[^\s/]+(:\d+)?$/i.test(v)) return "";                 // only scheme://host[:port], nothing else
    return v;
  }

  return { detectPlatform: detectPlatform, resolveConfig: resolveConfig, normalizeBase: normalizeBase };
});
