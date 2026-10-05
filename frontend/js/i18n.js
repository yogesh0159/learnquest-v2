const SUPPORTED_LANGS = ["en", "hi", "mr"];
let LQ_STRINGS = {};

function getLang() {
  return localStorage.getItem("lq_lang") || "en";
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = "en";
  localStorage.setItem("lq_lang", lang);
  document.documentElement.lang = lang;
}

async function loadStrings() {
  const lang = getLang();
  setLang(lang);
  const res = await fetch(`locales/${lang}.json`);
  LQ_STRINGS = await res.json();
  applyStrings();
  document.dispatchEvent(new CustomEvent("lq:i18n-ready"));
}

function t(key, vars = {}) {
  let str = LQ_STRINGS[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(`{${k}}`, v);
  });
  return str;
}

function applyStrings() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });
  document.querySelectorAll(".lang-switch button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === getLang());
  });
}

function initLangSwitch() {
  document.querySelectorAll(".lang-switch button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      setLang(btn.dataset.lang);
      await loadStrings();
      // Notify page-specific scripts to re-render dynamic (server-fetched) content
      document.dispatchEvent(new CustomEvent("lq:lang-changed"));
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadStrings();
  initLangSwitch();
});
