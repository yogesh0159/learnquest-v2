/* LearnQuest site navigation: one slim bar at the top of every page (Home, Play, Parents, Kids) so no page is a dead end.
 * Pages that already carry their own navigation (the home page, the game) do not load this file. */
(function () {
  var FAMILY = true;                                    // the free web page has no accounts: its build switches this off
  var T = { en: { home: "Home", play: "Play", parents: "Parents", kids: "Kids" }, hi: { home: "होम", play: "खेलो", parents: "पेरेंट्स", kids: "बच्चे" }, mr: { home: "होम", play: "खेळा", parents: "पालक", kids: "मुले" } };
  var lang = "en"; try { lang = localStorage.getItem("lq_lang") || "en"; } catch (e) { /* storage blocked */ }
  var d = T[lang] || T.en, here = location.pathname.split("/").pop() || "index.html";
  var items = [["index.html", "\u{1F3E0} " + d.home], ["jungle-local-preview.html", "\u25B6 " + d.play]];
  if (FAMILY) items.push(["parent.html", "\u{1F469}\u200D\u{1F467} " + d.parents], ["child-login.html", "\u{1F9D2} " + d.kids]);
  var css = document.createElement("style");
  css.textContent = ".sitenav{position:fixed;top:0;left:0;right:0;z-index:60;display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;padding:6px 10px;background:rgba(255,255,255,.93);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid rgba(16,58,38,.14);font-family:'Baloo 2','Segoe UI',system-ui,sans-serif}" +
    ".sitenav a{padding:5px 14px;border-radius:999px;color:#103a26;text-decoration:none;font-weight:700;font-size:14px;border:2px solid transparent}.sitenav a:hover{background:rgba(47,191,106,.16)}.sitenav a.on{background:#2fbf6a;color:#fff}body.has-sitenav{padding-top:46px}";
  document.head.appendChild(css);
  var nav = document.createElement("nav"); nav.className = "sitenav"; nav.setAttribute("aria-label", "LearnQuest");
  items.forEach(function (it) { var a = document.createElement("a"); a.href = it[0]; a.textContent = it[1]; if (it[0] === here || (here === "" && it[0] === "index.html")) a.className = "on"; nav.appendChild(a); });
  function mount() { document.body.classList.add("has-sitenav"); document.body.insertBefore(nav, document.body.firstChild); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
