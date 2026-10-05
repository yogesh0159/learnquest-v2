(function () {
  const presets = [
    {
      id: "human_boy_v1",
      type: "human",
      gender: "boy",
      icon: "👦🏽",
      label: { en: "Boy Explorer", hi: "बॉय एक्सप्लोरर", mr: "बॉय एक्सप्लोरर" },
      model: "/assets/characters/boy-explorer.glb",
    },
    {
      id: "human_girl_v1",
      type: "human",
      gender: "girl",
      icon: "👧🏽",
      label: { en: "Girl Explorer", hi: "गर्ल एक्सप्लोरर", mr: "गर्ल एक्सप्लोरर" },
      model: "/assets/characters/girl-explorer.glb",
    },
  ];

  const byId = Object.fromEntries(presets.map((preset) => [preset.id, preset]));
  const legacyEmoji = new Set(["🦊", "🐯", "🐵", "🦁", "🐼", "🦜", "🐢", "🐘"]);

  function get(value) {
    return byId[value] || null;
  }

  function icon(value) {
    const preset = get(value);
    if (preset) return preset.icon;
    if (legacyEmoji.has(value)) return value;
    return "🧒🏽";
  }

  function label(value, lang = "en") {
    const preset = get(value);
    if (!preset) return "Explorer";
    return preset.label[lang] || preset.label.en;
  }

  function isHuman(value) {
    return Boolean(get(value));
  }

  window.LQCharacters = Object.freeze({ presets, get, icon, label, isHuman });
})();
