/* LearnQuest app shell helper (classic script): registers the service worker, offers "Install app", reports offline status and updates.
 * window.LQ_PWA = { supported, registered, controlled, updateReady, canInstall, installed, iosHint,
 *                   install(), applyUpdate(), offlineStatus(), downloadOffline(onProgress), on(fn) }                                   */
(function () {
  var P = window.LQ_PLATFORM || {};
  var secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var supported = !!navigator.serviceWorker && secure && P.kind !== "electron" && P.kind !== "capacitor" && !/[?&]nosw=1/.test(location.search);
  var deferred = null, reg = null, listeners = [];
  var S = window.LQ_PWA = { supported: supported, registered: false, controlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller), updateReady: false, canInstall: false, installed: !!P.standalone, iosHint: P.os === "ios" && !P.standalone && !P.webview };
  function emit() { listeners.forEach(function (fn) { try { fn(S); } catch (e) { /* listener error */ } }); try { window.dispatchEvent(new CustomEvent("lq-pwa", { detail: S })); } catch (e) { /* old browser */ } }
  S.on = function (fn) { listeners.push(fn); };

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; S.canInstall = true; emit(); });
  window.addEventListener("appinstalled", function () { deferred = null; S.canInstall = false; S.installed = true; emit(); });
  S.install = function () { if (!deferred) return Promise.resolve("unavailable"); deferred.prompt(); return deferred.userChoice.then(function (c) { deferred = null; S.canInstall = false; emit(); return c.outcome; }); };

  if (supported) {
    navigator.serviceWorker.register("/sw.js").then(function (r) {
      reg = r; S.registered = true; emit();
      var watch = function (w) { w.addEventListener("statechange", function () { if (w.state === "installed" && navigator.serviceWorker.controller) { S.updateReady = true; emit(); } }); };
      if (r.waiting && navigator.serviceWorker.controller) { S.updateReady = true; emit(); }
      r.addEventListener("updatefound", function () { if (r.installing) watch(r.installing); });
    }).catch(function () { /* registration blocked: the site still works online */ });
    navigator.serviceWorker.addEventListener("controllerchange", function () { S.controlled = true; emit(); if (S.reloading) location.reload(); });
  }
  S.applyUpdate = function () { if (reg && reg.waiting) { S.reloading = true; reg.waiting.postMessage({ type: "SKIP_WAITING" }); } else location.reload(); };

  function manifest() { return fetch("/precache-manifest.json", { cache: "no-store" }).then(function (r) { return r.json(); }); }
  /** How much of the 3D-model pack is already on this device. */
  S.offlineStatus = function () {
    if (!window.caches) return Promise.resolve({ supported: false });
    return manifest().then(function (m) { return caches.open("lq-assets-" + m.assetsVersion).then(function (c) { return c.keys().then(function (keys) {
      var have = {}; keys.forEach(function (k) { have[new URL(k.url).pathname] = 1; });
      var cached = m.offlinePack.filter(function (e) { return have[e.url]; });
      return { supported: true, total: m.offlinePack.length, cached: cached.length, bytesTotal: m.packBytes, bytesCached: cached.reduce(function (s, e) { return s + e.bytes; }, 0), complete: cached.length === m.offlinePack.length };
    }); }); }).catch(function () { return { supported: false }; });
  };
  /** Fetch every model into the offline cache (3 at a time). onProgress({done,total}) */
  S.downloadOffline = function (onProgress) {
    if (!window.caches) return Promise.reject(new Error("offline storage is not available in this browser"));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    return manifest().then(function (m) { return caches.open("lq-assets-" + m.assetsVersion).then(function (c) {
      var todo = m.offlinePack.slice(), done = 0, total = todo.length;
      function worker() { var e = todo.shift(); if (!e) return Promise.resolve();
        return c.match(e.url).then(function (hit) { return hit || fetch(e.url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status + " " + e.url); return c.put(e.url, r); }); })
          .then(function () { done++; if (onProgress) onProgress({ done: done, total: total }); return worker(); }); }
      return Promise.all([worker(), worker(), worker()]).then(function () { return { done: done, total: total }; });
    }); });
  };
})();
