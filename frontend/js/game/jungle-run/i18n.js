/**
 * Language support for the Jungle Run: English, Hindi (हिन्दी) and Marathi (मराठी), matching the three languages
 * the rest of LearnQuest already supports. All user-facing text lives here; code asks for it with t("key", {vars}).
 * Missing keys fall back to English, then to the key itself, so a gap can never crash the game.
 */
export const LANGS = Object.freeze({ en: { name: "English", speech: "en-US" }, hi: { name: "\u0939\u093f\u0928\u094d\u0926\u0940", speech: "hi-IN" }, mr: { name: "\u092e\u0930\u093e\u0920\u0940", speech: "mr-IN" } });

const en = {
  "teacher.name": "Teacher", "teacher.asks": "\u{1F9D1}\u200D\u{1F3EB} Teacher:", "teacher.caught": "Teacher's rescue question", "teacher.keys": "Press 1, 2 or 3 (or tap)", "teacher.setting": "Teacher chase (a friendly teacher runs behind you)",
  "teacher.l.start1": "The bell is ringing! Run to class!", "teacher.l.near1": "Wait for me!", "teacher.l.near2": "Run faster, or you will be late!", "teacher.l.close1": "I am right behind you!", "teacher.l.close2": "Answer questions to stay ahead!",
  "teacher.l.praise1": "Well done!", "teacher.l.praise2": "Excellent! Keep running!", "teacher.l.caught1": "Got you! Answer this to run free:", "teacher.l.rescued1": "Correct! Off you go!", "teacher.l.oops1": "Not quite. Next time you will get it!",
  "app.title": "App", "app.install": "Install the app", "app.installed": "Installed as an app", "app.ios": "On iPhone / iPad: tap Share, then \"Add to Home Screen\"", "app.offline": "Offline play", "app.offline.ready": "Ready: works without internet ({mb} MB saved)", "app.offline.get": "Download for offline play ({mb} MB)", "app.offline.progress": "Downloading {done}/{total}...", "app.offline.none": "Offline storage is not available here", "app.offline.err": "Download failed. Check the internet and try again.", "app.update": "A new version is ready", "app.update.btn": "Reload now", "app.fullscreen": "Fullscreen",
  "set.native": "Native engine core (C/C++ WebAssembly)", "set.native.note": "(applies at the next start)", "dev.engine": "Engine core", "dev.engine.native": "C/C++ (WebAssembly)", "dev.engine.js": "JavaScript",
  "set.graphics": "Graphics", "gfx.auto": "Auto (analyses this device)", "gfx.ultra": "Ultra (up to 4K)", "gfx.high": "High (up to 2K)", "gfx.balanced": "Balanced (Full HD)", "gfx.low": "Low (HD)", "gfx.minimal": "Minimal (weak devices)", "gfx.now": "Now using: {tier}",
  "load.analyse": "Checking your device...", "load.facts": "{gpu}\nScreen {w}x{h} \u00b7 {hz} Hz \u00b7 Memory {ram} \u00b7 CPU cores {cores}", "load.probe": "Testing {tier} quality ({i}/{n})...", "load.picked": "Best quality for this device: {tier}", "menu.quality": "Quality: {tier} \u00b7 {w}x{h}",
  "dev.title": "Your device", "dev.gpu": "Graphics", "dev.screen": "Screen", "dev.ram": "Memory", "dev.cores": "CPU cores", "dev.refresh": "Refresh rate", "dev.draws": "The game draws at", "dev.limit": "Highest level for this device", "dev.retest": "Analyse this device again", "dev.retesting": "Analysing your device...", "dev.measured": "Measured on {date}", "dev.notyet": "Not measured yet (using the safe starting level)",
  "load.title": "LearnQuest Jungle Run", "load.text": "Loading {label}... {pct}%", "load.assets": "assets",
  "menu.title": "Jungle Run", "menu.sub": "Collect coins, answer the questions by running through the right lane!", "menu.boy": "Boy explorer", "menu.girl": "Girl explorer", "menu.play": "Play",
  "menu.enter": "Press Enter to start", "menu.lab": "Lab view", "menu.settings": "Settings & rewards", "menu.welcome": "Welcome, explorer!", "menu.stats": "\u2B50 Best {best}  \u00b7  \u{1FA99} {coins} coins  \u00b7  {games} runs", "menu.lang": "Language",
  "hud.score": "Score", "hud.distance": "Distance", "hud.coins": "Coins", "hud.combo": "Combo x{n}", "hud.streak": "\u{1F525} {n} in a row", "hud.multi": "x{n} coins {s}s",
  "q.label": "Question", "q.hint": "Run through the lane with the answer!", "q.biggest": "Which is the BIGGEST?", "q.smallest": "Which is the SMALLEST?", "q.sides": "Sides of a {shape}?",
  "hint.keys": "\u2190 \u2192 / A D: lanes  \u2191 / W / Space: jump  \u2193 / S: slide  P: pause  M: sound  F2: lab",
  "pause.title": "Paused", "pause.resume": "Resume", "coach.skip": "Skip",
  "over.title": "Great run!", "over.again": "Play again", "over.enter": "Press Enter to restart", "over.score": "Score", "over.coins": "Coins", "over.tokens": "Golden Enigmas", "over.distance": "Distance", "over.right": "Questions right", "over.newbest": "\u2605 new best!",
  "rv.perfect": "Perfect answers! \u{1F31F}", "rv.practise": "Let's practise these", "rv.chose": "You chose {a} \u00b7 answer: {b}", "rv.ach": "New achievements",
  "t.correct": "Correct! +100", "t.streak": "Correct x3! Extra heart", "t.wrong": "Not quite: {x}", "t.shield": "\u{1F6E1}\uFE0F Shield saved you!", "t.nice": "Nice! \u2B50", "t.loading": "Loading explorer...", "t.missing": "Missing: {x}",
  "board.correct": "Correct!", "board.oops": "Oops!",
  "coach.lane": "Press \u2190 \u2192 (or swipe) to change lane", "coach.lane.t": "Swipe left or right, or tap \u25C0 \u25B6 to change lane",
  "coach.jump": "Press \u2191 or Space to JUMP", "coach.jump.t": "Swipe up or tap \u2B06 to JUMP", "coach.slide": "Press \u2193 to SLIDE", "coach.slide.t": "Swipe down or tap \u2B07 to SLIDE",
  "coach.coin": "Run into the coins to collect them!", "coach.quiz": "Questions appear on a board. Run through the lane with the RIGHT answer!",
  "set.class": "Class / difficulty", "set.grade": "Grade {n}", "set.subjects": "Subjects (pick one or more)", "set.help": "Help & comfort", "set.tts": "Read questions aloud", "set.tts.no": "(not supported by this browser)",
  "set.motion": "Reduce motion & effects", "set.bigtext": "Bigger text", "set.trail": "Running trail", "set.trail.hint": "(unlocked with total coins: you have {n})", "set.report": "Progress report", "set.print": "Print / save report",
  "set.tutorial": "Show tutorial again", "set.tutorial.done": "Tutorial will show on your next run", "set.reset": "Reset all progress", "set.reset.confirm": "Delete ALL progress (best score, coins, achievements, report)? This cannot be undone.", "set.ach": "Achievements {a}/{b}",
  "subj.math": "Math", "subj.patterns": "Patterns", "subj.spelling": "Spelling (English words)", "subj.science": "Science (English)", "subj.shapes": "Shapes",
  "trail.none": "No trail", "trail.gold": "Gold dust", "trail.leaf": "Leaf sparkle", "trail.rainbow": "Rainbow",
  "shape.triangle": "triangle", "shape.square": "square", "shape.circle": "circle", "shape.rectangle": "rectangle", "shape.pentagon": "pentagon", "shape.hexagon": "hexagon", "shape.octagon": "octagon", "shape.line": "line",
  "exp.shape": "A {shape} has {n} sides", "exp.pattern": "The pattern grows: next is {n}", "exp.pattern.step": "The pattern adds {step}: next is {n}", "exp.spelling": "{word} - the missing letter is {letter}", "exp.compare.big": "{n} is the biggest of {list}", "exp.compare.small": "{n} is the smallest of {list}",
  "rep.summary": "{games} runs \u00b7 {q} questions ({acc}% right) \u00b7 best streak {streak} \u00b7 best {best} pts", "rep.none": "No questions answered yet. Play a few runs to see progress here.", "rep.few": "Keep playing: a few more questions are needed for useful advice.",
  "rep.practise": "Practise {subject}: {acc}% right so far ({r} of {t}).", "rep.great": "Great accuracy in every subject so far. Try a higher grade in Settings.",
  "pr.title": "LearnQuest Jungle Run - Progress report", "pr.line": "{date} \u00b7 {games} runs \u00b7 {coins} coins \u00b7 best score {best} \u00b7 best distance {dist} m \u00b7 {ach} achievements", "pr.subject": "Subject", "pr.right": "Right", "pr.wrong": "Wrong", "pr.acc": "Accuracy",
  "pr.advice": "Advice", "pr.strong": "Strongest subject: {s}.", "pr.overall": "Overall: {q} questions answered, {acc}% right.",
  "pu.magnet.label": "Coin Magnet", "pu.magnet.blurb": "Coins fly to you!", "pu.shield.label": "Shield", "pu.shield.blurb": "Blocks the next mistake", "pu.slowmo.label": "Slow Time", "pu.slowmo.blurb": "Everything slows down", "pu.double.label": "Double Coins", "pu.double.blurb": "Coins are worth x2",
  "biome.day": "Sunny Jungle", "biome.sunset": "Golden Sunset", "biome.night": "Firefly Night", "biome.dawn": "Misty Dawn",
  "ach.first_run.t": "First Steps", "ach.first_run.d": "Finish your first run", "ach.coins_50.t": "Coin Collector", "ach.coins_50.d": "Collect 50 coins in one run", "ach.coins_150.t": "Treasure Hunter", "ach.coins_150.d": "Collect 150 coins in one run",
  "ach.total_500.t": "Rich Explorer", "ach.total_500.d": "Collect 500 coins in total", "ach.dist_500.t": "Fast Feet", "ach.dist_500.d": "Run 500 m in one run", "ach.dist_1500.t": "Jungle Marathon", "ach.dist_1500.d": "Run 1500 m in one run",
  "ach.right_5.t": "Bright Mind", "ach.right_5.d": "Answer 5 questions right in a run", "ach.streak_5.t": "On Fire", "ach.streak_5.d": "5 right answers in a row", "ach.enigma_3.t": "Enigma Master", "ach.enigma_3.d": "Collect 3 Golden Enigmas in a run",
  "ach.clean_300.t": "Untouchable", "ach.clean_300.d": "Run 300 m without getting hit", "ach.combo_20.t": "Combo King", "ach.combo_20.d": "Collect 20 coins in a row", "ach.all_rounder.t": "All-Rounder", "ach.all_rounder.d": "Answer right in 3 different subjects",
  "sp.plus": "plus", "sp.minus": "minus", "sp.times": "times", "sp.equals": "equals", "sp.next": "What comes next?", "sp.answer": "The answer is {x}", "sp.on": "Read aloud is on", "sp.spell": "Which letter is missing in {word}?", "sp.biggest": "Which is the biggest?", "sp.smallest": "Which is the smallest?", "sp.sides": "How many sides does a {shape} have?",
};

const hi = {
  "teacher.name": "टीचर", "teacher.asks": "\u{1F9D1}\u200D\u{1F3EB} टीचर:", "teacher.caught": "टीचर का बचाव-सवाल", "teacher.keys": "1, 2 या 3 दबाओ (या टैप करो)", "teacher.setting": "टीचर का पीछा (एक दोस्ताना टीचर तुम्हारे पीछे दौड़ती है)",
  "teacher.l.start1": "घंटी बज रही है! क्लास की ओर दौड़ो!", "teacher.l.near1": "मेरा इंतज़ार करो!", "teacher.l.near2": "तेज़ दौड़ो, वरना देर हो जाएगी!", "teacher.l.close1": "मैं तुम्हारे ठीक पीछे हूँ!", "teacher.l.close2": "आगे रहने के लिए सवालों के जवाब दो!",
  "teacher.l.praise1": "शाबाश!", "teacher.l.praise2": "बहुत बढ़िया! दौड़ते रहो!", "teacher.l.caught1": "पकड़ लिया! आज़ाद होने के लिए जवाब दो:", "teacher.l.rescued1": "सही! अब आगे दौड़ो!", "teacher.l.oops1": "थोड़ा गलत। अगली बार ज़रूर होगा!",
  "app.title": "ऐप", "app.install": "ऐप इंस्टॉल करो", "app.installed": "ऐप के रूप में इंस्टॉल है", "app.ios": "iPhone / iPad पर: Share दबाओ, फिर \"Add to Home Screen\"", "app.offline": "ऑफ़लाइन खेल", "app.offline.ready": "तैयार: इंटरनेट के बिना चलेगा ({mb} MB सेव)", "app.offline.get": "ऑफ़लाइन खेलने के लिए डाउनलोड करो ({mb} MB)", "app.offline.progress": "डाउनलोड हो रहा है {done}/{total}...", "app.offline.none": "यहाँ ऑफ़लाइन स्टोरेज उपलब्ध नहीं है", "app.offline.err": "डाउनलोड नहीं हुआ। इंटरनेट देखकर फिर कोशिश करो।", "app.update": "नया वर्शन तैयार है", "app.update.btn": "अभी रीलोड करो", "app.fullscreen": "फुलस्क्रीन",
  "set.native": "नेटिव इंजन कोर (C/C++ WebAssembly)", "set.native.note": "(अगली शुरुआत से लागू)", "dev.engine": "इंजन कोर", "dev.engine.native": "C/C++ (WebAssembly)", "dev.engine.js": "JavaScript",
  "set.graphics": "ग्राफ़िक्स", "gfx.auto": "ऑटो (इस डिवाइस की जाँच करता है)", "gfx.ultra": "अल्ट्रा (4K तक)", "gfx.high": "ऊँचा (2K तक)", "gfx.balanced": "संतुलित (फुल HD)", "gfx.low": "कम (HD)", "gfx.minimal": "न्यूनतम (कमज़ोर डिवाइस)", "gfx.now": "अभी उपयोग में: {tier}",
  "load.analyse": "आपके डिवाइस की जाँच हो रही है...", "load.facts": "{gpu}\nस्क्रीन {w}x{h} \u00b7 {hz} Hz \u00b7 मेमोरी {ram} \u00b7 CPU कोर {cores}", "load.probe": "{tier} क्वालिटी की जाँच ({i}/{n})...", "load.picked": "इस डिवाइस के लिए सबसे अच्छी क्वालिटी: {tier}", "menu.quality": "क्वालिटी: {tier} \u00b7 {w}x{h}",
  "dev.title": "आपका डिवाइस", "dev.gpu": "ग्राफ़िक्स", "dev.screen": "स्क्रीन", "dev.ram": "मेमोरी", "dev.cores": "CPU कोर", "dev.refresh": "रिफ़्रेश रेट", "dev.draws": "खेल इस आकार में बनता है", "dev.limit": "इस डिवाइस के लिए सबसे ऊँचा स्तर", "dev.retest": "इस डिवाइस की फिर से जाँच करो", "dev.retesting": "आपके डिवाइस की जाँच हो रही है...", "dev.measured": "{date} को नापा गया", "dev.notyet": "अभी नापा नहीं गया (सुरक्षित शुरुआती स्तर)",
  "load.title": "लर्नक्वेस्ट जंगल रन", "load.text": "{label} लोड हो रहा है... {pct}%", "load.assets": "सामग्री",
  "menu.title": "जंगल रन", "menu.sub": "सिक्के इकट्ठा करो और सही लेन में दौड़कर सवालों के जवाब दो!", "menu.boy": "लड़का खोजी", "menu.girl": "लड़की खोजी", "menu.play": "खेलो",
  "menu.enter": "शुरू करने के लिए Enter दबाओ", "menu.lab": "लैब व्यू", "menu.settings": "सेटिंग्स और इनाम", "menu.welcome": "स्वागत है, खोजी!", "menu.stats": "\u2B50 सर्वश्रेष्ठ {best}  \u00b7  \u{1FA99} {coins} सिक्के  \u00b7  {games} दौड़", "menu.lang": "भाषा",
  "hud.score": "स्कोर", "hud.distance": "दूरी", "hud.coins": "सिक्के", "hud.combo": "कॉम्बो x{n}", "hud.streak": "\u{1F525} लगातार {n}", "hud.multi": "x{n} सिक्के {s} सेकंड",
  "q.label": "सवाल", "q.hint": "जवाब वाली लेन में दौड़ो!", "q.biggest": "सबसे बड़ा कौन सा है?", "q.smallest": "सबसे छोटा कौन सा है?", "q.sides": "{shape} की कितनी भुजाएँ होती हैं?",
  "hint.keys": "\u2190 \u2192 / A D: लेन  \u2191 / W / Space: कूदो  \u2193 / S: फिसलो  P: रोको  M: आवाज़  F2: लैब",
  "pause.title": "रुका हुआ", "pause.resume": "जारी रखो", "coach.skip": "छोड़ो",
  "over.title": "शानदार दौड़!", "over.again": "फिर से खेलो", "over.enter": "फिर से शुरू करने के लिए Enter दबाओ", "over.score": "स्कोर", "over.coins": "सिक्के", "over.tokens": "सुनहरे रहस्य", "over.distance": "दूरी", "over.right": "सही जवाब", "over.newbest": "\u2605 नया रिकॉर्ड!",
  "rv.perfect": "सारे जवाब सही! \u{1F31F}", "rv.practise": "इनका अभ्यास करते हैं", "rv.chose": "तुमने चुना {a} \u00b7 सही जवाब: {b}", "rv.ach": "नई उपलब्धियाँ",
  "t.correct": "सही! +100", "t.streak": "लगातार 3 सही! एक और दिल", "t.wrong": "लगभग: {x}", "t.shield": "\u{1F6E1}\uFE0F ढाल ने बचा लिया!", "t.nice": "शाबाश! \u2B50", "t.loading": "खोजी लोड हो रहा है...", "t.missing": "नहीं मिला: {x}",
  "board.correct": "सही!", "board.oops": "ओह!",
  "coach.lane": "लेन बदलने के लिए \u2190 \u2192 दबाओ (या स्वाइप करो)", "coach.lane.t": "लेन बदलने के लिए बाएँ-दाएँ स्वाइप करो या \u25C0 \u25B6 दबाओ",
  "coach.jump": "कूदने के लिए \u2191 या Space दबाओ", "coach.jump.t": "कूदने के लिए ऊपर स्वाइप करो या \u2B06 दबाओ", "coach.slide": "फिसलने के लिए \u2193 दबाओ", "coach.slide.t": "फिसलने के लिए नीचे स्वाइप करो या \u2B07 दबाओ",
  "coach.coin": "सिक्के इकट्ठा करने के लिए उनसे टकराओ!", "coach.quiz": "सवाल एक बोर्ड पर आते हैं। सही जवाब वाली लेन में दौड़ो!",
  "set.class": "कक्षा / कठिनाई", "set.grade": "कक्षा {n}", "set.subjects": "विषय (एक या ज़्यादा चुनो)", "set.help": "मदद और आराम", "set.tts": "सवाल ज़ोर से पढ़ो", "set.tts.no": "(यह ब्राउज़र समर्थन नहीं करता)",
  "set.motion": "हलचल और इफ़ेक्ट कम करो", "set.bigtext": "बड़े अक्षर", "set.trail": "दौड़ने का निशान", "set.trail.hint": "(कुल सिक्कों से खुलते हैं: तुम्हारे पास {n} हैं)", "set.report": "प्रगति रिपोर्ट", "set.print": "रिपोर्ट प्रिंट / सेव करो",
  "set.tutorial": "ट्यूटोरियल फिर दिखाओ", "set.tutorial.done": "अगली दौड़ में ट्यूटोरियल दिखेगा", "set.reset": "सारी प्रगति मिटाओ", "set.reset.confirm": "सारी प्रगति (सबसे अच्छा स्कोर, सिक्के, उपलब्धियाँ, रिपोर्ट) मिटा दें? इसे वापस नहीं लाया जा सकता।", "set.ach": "उपलब्धियाँ {a}/{b}",
  "subj.math": "गणित", "subj.patterns": "पैटर्न", "subj.spelling": "वर्तनी (अंग्रेज़ी शब्द)", "subj.science": "विज्ञान (अंग्रेज़ी)", "subj.shapes": "आकृतियाँ",
  "trail.none": "कोई निशान नहीं", "trail.gold": "सुनहरी धूल", "trail.leaf": "पत्तियों की चमक", "trail.rainbow": "इंद्रधनुष",
  "shape.triangle": "त्रिभुज", "shape.square": "वर्ग", "shape.circle": "वृत्त", "shape.rectangle": "आयत", "shape.pentagon": "पंचभुज", "shape.hexagon": "षट्भुज", "shape.octagon": "अष्टभुज", "shape.line": "रेखा",
  "exp.shape": "{shape} की {n} भुजाएँ होती हैं", "exp.pattern": "पैटर्न बढ़ता जाता है: अगली संख्या {n} है", "exp.pattern.step": "पैटर्न में हर बार {step} जुड़ता है: अगली संख्या {n} है", "exp.spelling": "{word} - छूटा हुआ अक्षर {letter} है", "exp.compare.big": "{list} में सबसे बड़ा {n} है", "exp.compare.small": "{list} में सबसे छोटा {n} है",
  "rep.summary": "{games} दौड़ \u00b7 {q} सवाल ({acc}% सही) \u00b7 सबसे लंबी लगातार जीत {streak} \u00b7 सर्वश्रेष्ठ {best} अंक", "rep.none": "अभी कोई सवाल हल नहीं हुआ। कुछ दौड़ें खेलो, फिर यहाँ प्रगति दिखेगी।", "rep.few": "खेलते रहो: सही सलाह के लिए कुछ और सवाल चाहिए।",
  "rep.practise": "{subject} का अभ्यास करो: अब तक {acc}% सही ({t} में से {r}).", "rep.great": "अब तक हर विषय में बहुत अच्छी सटीकता है। सेटिंग्स में ऊँची कक्षा आज़माओ।",
  "pr.title": "लर्नक्वेस्ट जंगल रन - प्रगति रिपोर्ट", "pr.line": "{date} \u00b7 {games} दौड़ \u00b7 {coins} सिक्के \u00b7 सर्वश्रेष्ठ स्कोर {best} \u00b7 सबसे लंबी दूरी {dist} मीटर \u00b7 {ach} उपलब्धियाँ", "pr.subject": "विषय", "pr.right": "सही", "pr.wrong": "गलत", "pr.acc": "सटीकता",
  "pr.advice": "सलाह", "pr.strong": "सबसे मज़बूत विषय: {s}।", "pr.overall": "कुल: {q} सवाल हल किए, {acc}% सही।",
  "pu.magnet.label": "सिक्का चुंबक", "pu.magnet.blurb": "सिक्के तुम्हारी ओर उड़ते हैं!", "pu.shield.label": "ढाल", "pu.shield.blurb": "अगली गलती से बचाती है", "pu.slowmo.label": "धीमा समय", "pu.slowmo.blurb": "सब कुछ धीमा हो जाता है", "pu.double.label": "दोगुने सिक्के", "pu.double.blurb": "सिक्कों की कीमत x2",
  "biome.day": "धूप वाला जंगल", "biome.sunset": "सुनहरी शाम", "biome.night": "जुगनुओं की रात", "biome.dawn": "धुंध भरी सुबह",
  "ach.first_run.t": "पहले कदम", "ach.first_run.d": "अपनी पहली दौड़ पूरी करो", "ach.coins_50.t": "सिक्का संग्रहकर्ता", "ach.coins_50.d": "एक दौड़ में 50 सिक्के इकट्ठा करो", "ach.coins_150.t": "खज़ाना खोजी", "ach.coins_150.d": "एक दौड़ में 150 सिक्के इकट्ठा करो",
  "ach.total_500.t": "अमीर खोजी", "ach.total_500.d": "कुल 500 सिक्के इकट्ठा करो", "ach.dist_500.t": "तेज़ कदम", "ach.dist_500.d": "एक दौड़ में 500 मीटर दौड़ो", "ach.dist_1500.t": "जंगल मैराथन", "ach.dist_1500.d": "एक दौड़ में 1500 मीटर दौड़ो",
  "ach.right_5.t": "तेज़ दिमाग", "ach.right_5.d": "एक दौड़ में 5 सवाल सही करो", "ach.streak_5.t": "आग लग गई", "ach.streak_5.d": "लगातार 5 सही जवाब", "ach.enigma_3.t": "रहस्य के उस्ताद", "ach.enigma_3.d": "एक दौड़ में 3 सुनहरे रहस्य इकट्ठा करो",
  "ach.clean_300.t": "अजेय", "ach.clean_300.d": "बिना चोट खाए 300 मीटर दौड़ो", "ach.combo_20.t": "कॉम्बो राजा", "ach.combo_20.d": "लगातार 20 सिक्के इकट्ठा करो", "ach.all_rounder.t": "हरफ़नमौला", "ach.all_rounder.d": "3 अलग विषयों में सही जवाब दो",
  "sp.plus": "जमा", "sp.minus": "घटा", "sp.times": "गुणा", "sp.equals": "बराबर", "sp.next": "अगला क्या आएगा?", "sp.answer": "सही जवाब है {x}", "sp.on": "ज़ोर से पढ़ना चालू है", "sp.spell": "{word} में कौन सा अक्षर छूटा है?", "sp.biggest": "सबसे बड़ा कौन सा है?", "sp.smallest": "सबसे छोटा कौन सा है?", "sp.sides": "{shape} की कितनी भुजाएँ होती हैं?",
};

const mr = {
  "teacher.name": "टीचर", "teacher.asks": "\u{1F9D1}\u200D\u{1F3EB} टीचर:", "teacher.caught": "टीचरचा सुटका-प्रश्न", "teacher.keys": "1, 2 किंवा 3 दाबा (किंवा टॅप करा)", "teacher.setting": "टीचरचा पाठलाग (एक मित्रत्वाची टीचर तुमच्या मागे धावते)",
  "teacher.l.start1": "घंटा वाजतोय! वर्गाकडे धाव!", "teacher.l.near1": "माझी वाट पाहा!", "teacher.l.near2": "वेगाने धाव, नाहीतर उशीर होईल!", "teacher.l.close1": "मी तुझ्या अगदी मागे आहे!", "teacher.l.close2": "पुढे राहण्यासाठी प्रश्नांची उत्तरे दे!",
  "teacher.l.praise1": "शाब्बास!", "teacher.l.praise2": "उत्तम! धावत राहा!", "teacher.l.caught1": "पकडले! मोकळे होण्यासाठी उत्तर दे:", "teacher.l.rescued1": "बरोबर! आता पुढे धाव!", "teacher.l.oops1": "थोडे चुकले. पुढच्या वेळी जमेल!",
  "app.title": "ॲप", "app.install": "ॲप इंस्टॉल करा", "app.installed": "ॲप म्हणून इंस्टॉल आहे", "app.ios": "iPhone / iPad वर: Share दाबा, मग \"Add to Home Screen\"", "app.offline": "ऑफलाइन खेळ", "app.offline.ready": "तयार: इंटरनेटशिवाय चालेल ({mb} MB सेव्ह)", "app.offline.get": "ऑफलाइन खेळण्यासाठी डाउनलोड करा ({mb} MB)", "app.offline.progress": "डाउनलोड होत आहे {done}/{total}...", "app.offline.none": "येथे ऑफलाइन स्टोरेज उपलब्ध नाही", "app.offline.err": "डाउनलोड झाले नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा.", "app.update": "नवीन आवृत्ती तयार आहे", "app.update.btn": "आता रीलोड करा", "app.fullscreen": "फुलस्क्रीन",
  "set.native": "नेटिव इंजिन कोर (C/C++ WebAssembly)", "set.native.note": "(पुढच्या सुरुवातीपासून लागू)", "dev.engine": "इंजिन कोर", "dev.engine.native": "C/C++ (WebAssembly)", "dev.engine.js": "JavaScript",
  "set.graphics": "ग्राफिक्स", "gfx.auto": "ऑटो (हे डिव्हाइस तपासतो)", "gfx.ultra": "अल्ट्रा (4K पर्यंत)", "gfx.high": "उच्च (2K पर्यंत)", "gfx.balanced": "संतुलित (फुल HD)", "gfx.low": "कमी (HD)", "gfx.minimal": "किमान (कमकुवत डिव्हाइस)", "gfx.now": "सध्या वापरात: {tier}",
  "load.analyse": "तुमचे डिव्हाइस तपासले जात आहे...", "load.facts": "{gpu}\nस्क्रीन {w}x{h} \u00b7 {hz} Hz \u00b7 मेमरी {ram} \u00b7 CPU कोर {cores}", "load.probe": "{tier} क्वालिटीची चाचणी ({i}/{n})...", "load.picked": "या डिव्हाइससाठी सर्वोत्तम क्वालिटी: {tier}", "menu.quality": "क्वालिटी: {tier} \u00b7 {w}x{h}",
  "dev.title": "तुमचे डिव्हाइस", "dev.gpu": "ग्राफिक्स", "dev.screen": "स्क्रीन", "dev.ram": "मेमरी", "dev.cores": "CPU कोर", "dev.refresh": "रिफ्रेश रेट", "dev.draws": "खेळ या आकारात चालतो", "dev.limit": "या डिव्हाइससाठी सर्वोच्च स्तर", "dev.retest": "या डिव्हाइसची पुन्हा तपासणी करा", "dev.retesting": "तुमचे डिव्हाइस तपासले जात आहे...", "dev.measured": "{date} रोजी मोजले", "dev.notyet": "अजून मोजले नाही (सुरक्षित सुरुवातीचा स्तर)",
  "load.title": "लर्नक्वेस्ट जंगल रन", "load.text": "{label} लोड होत आहे... {pct}%", "load.assets": "साहित्य",
  "menu.title": "जंगल रन", "menu.sub": "नाणी गोळा करा आणि योग्य लेनमधून धावत प्रश्नांची उत्तरे द्या!", "menu.boy": "मुलगा शोधक", "menu.girl": "मुलगी शोधक", "menu.play": "खेळा",
  "menu.enter": "सुरू करण्यासाठी Enter दाबा", "menu.lab": "लॅब व्ह्यू", "menu.settings": "सेटिंग्ज आणि बक्षिसे", "menu.welcome": "स्वागत आहे, शोधक!", "menu.stats": "\u2B50 सर्वोत्तम {best}  \u00b7  \u{1FA99} {coins} नाणी  \u00b7  {games} धाव", "menu.lang": "भाषा",
  "hud.score": "गुण", "hud.distance": "अंतर", "hud.coins": "नाणी", "hud.combo": "कॉम्बो x{n}", "hud.streak": "\u{1F525} सलग {n}", "hud.multi": "x{n} नाणी {s} सेकंद",
  "q.label": "प्रश्न", "q.hint": "उत्तर असलेल्या लेनमधून धावा!", "q.biggest": "सर्वात मोठे कोणते?", "q.smallest": "सर्वात लहान कोणते?", "q.sides": "{shape} ला किती बाजू असतात?",
  "hint.keys": "\u2190 \u2192 / A D: लेन  \u2191 / W / Space: उडी  \u2193 / S: सरका  P: थांबवा  M: आवाज  F2: लॅब",
  "pause.title": "थांबवले", "pause.resume": "पुन्हा सुरू करा", "coach.skip": "वगळा",
  "over.title": "मस्त धाव!", "over.again": "पुन्हा खेळा", "over.enter": "पुन्हा सुरू करण्यासाठी Enter दाबा", "over.score": "गुण", "over.coins": "नाणी", "over.tokens": "सोनेरी रहस्ये", "over.distance": "अंतर", "over.right": "बरोबर उत्तरे", "over.newbest": "\u2605 नवीन विक्रम!",
  "rv.perfect": "सगळी उत्तरे बरोबर! \u{1F31F}", "rv.practise": "यांचा सराव करूया", "rv.chose": "तुम्ही निवडले {a} \u00b7 बरोबर उत्तर: {b}", "rv.ach": "नवीन कामगिरी",
  "t.correct": "बरोबर! +100", "t.streak": "सलग 3 बरोबर! एक जास्तीचे हृदय", "t.wrong": "जवळजवळ: {x}", "t.shield": "\u{1F6E1}\uFE0F ढालीने वाचवले!", "t.nice": "शाब्बास! \u2B50", "t.loading": "शोधक लोड होत आहे...", "t.missing": "सापडले नाही: {x}",
  "board.correct": "बरोबर!", "board.oops": "अरेरे!",
  "coach.lane": "लेन बदलण्यासाठी \u2190 \u2192 दाबा (किंवा स्वाइप करा)", "coach.lane.t": "लेन बदलण्यासाठी डावीकडे-उजवीकडे स्वाइप करा किंवा \u25C0 \u25B6 दाबा",
  "coach.jump": "उडी मारण्यासाठी \u2191 किंवा Space दाबा", "coach.jump.t": "उडी मारण्यासाठी वर स्वाइप करा किंवा \u2B06 दाबा", "coach.slide": "सरकण्यासाठी \u2193 दाबा", "coach.slide.t": "सरकण्यासाठी खाली स्वाइप करा किंवा \u2B07 दाबा",
  "coach.coin": "नाणी गोळा करण्यासाठी त्यांना धडका!", "coach.quiz": "प्रश्न एका फलकावर येतात. बरोबर उत्तर असलेल्या लेनमधून धावा!",
  "set.class": "इयत्ता / काठिण्य", "set.grade": "इयत्ता {n}", "set.subjects": "विषय (एक किंवा अधिक निवडा)", "set.help": "मदत आणि सोय", "set.tts": "प्रश्न मोठ्याने वाचा", "set.tts.no": "(हा ब्राउझर यास समर्थन देत नाही)",
  "set.motion": "हालचाल आणि इफेक्ट कमी करा", "set.bigtext": "मोठे अक्षर", "set.trail": "धावण्याची खूण", "set.trail.hint": "(एकूण नाण्यांनी उघडतात: तुमच्याकडे {n} आहेत)", "set.report": "प्रगती अहवाल", "set.print": "अहवाल प्रिंट / सेव्ह करा",
  "set.tutorial": "ट्यूटोरियल पुन्हा दाखवा", "set.tutorial.done": "पुढच्या धावेत ट्यूटोरियल दिसेल", "set.reset": "सर्व प्रगती पुसा", "set.reset.confirm": "सर्व प्रगती (सर्वोत्तम गुण, नाणी, कामगिरी, अहवाल) पुसायची? हे परत आणता येणार नाही.", "set.ach": "कामगिरी {a}/{b}",
  "subj.math": "गणित", "subj.patterns": "नमुने", "subj.spelling": "स्पेलिंग (इंग्रजी शब्द)", "subj.science": "विज्ञान (इंग्रजी)", "subj.shapes": "आकार",
  "trail.none": "खूण नाही", "trail.gold": "सोनेरी धूळ", "trail.leaf": "पानांची चमक", "trail.rainbow": "इंद्रधनुष्य",
  "shape.triangle": "त्रिकोण", "shape.square": "चौरस", "shape.circle": "वर्तुळ", "shape.rectangle": "आयत", "shape.pentagon": "पंचकोन", "shape.hexagon": "षटकोन", "shape.octagon": "अष्टकोन", "shape.line": "रेषा",
  "exp.shape": "{shape} ला {n} बाजू असतात", "exp.pattern": "नमुना वाढत जातो: पुढचा क्रमांक {n} आहे", "exp.pattern.step": "नमुन्यात प्रत्येक वेळी {step} मिळवले जातात: पुढचा क्रमांक {n} आहे", "exp.spelling": "{word} - राहिलेले अक्षर {letter} आहे", "exp.compare.big": "{list} मध्ये सर्वात मोठा {n} आहे", "exp.compare.small": "{list} मध्ये सर्वात लहान {n} आहे",
  "rep.summary": "{games} धावा \u00b7 {q} प्रश्न ({acc}% बरोबर) \u00b7 सर्वात मोठी सलग मालिका {streak} \u00b7 सर्वोत्तम {best} गुण", "rep.none": "अजून एकही प्रश्न सोडवलेला नाही. काही धावा खेळा, मग इथे प्रगती दिसेल.", "rep.few": "खेळत राहा: योग्य सल्ल्यासाठी आणखी काही प्रश्न हवेत.",
  "rep.practise": "{subject} चा सराव करा: आतापर्यंत {acc}% बरोबर ({t} पैकी {r}).", "rep.great": "आतापर्यंत प्रत्येक विषयात उत्तम अचूकता आहे. सेटिंग्जमध्ये वरची इयत्ता वापरून पहा.",
  "pr.title": "लर्नक्वेस्ट जंगल रन - प्रगती अहवाल", "pr.line": "{date} \u00b7 {games} धावा \u00b7 {coins} नाणी \u00b7 सर्वोत्तम गुण {best} \u00b7 सर्वात लांब अंतर {dist} मीटर \u00b7 {ach} कामगिरी", "pr.subject": "विषय", "pr.right": "बरोबर", "pr.wrong": "चूक", "pr.acc": "अचूकता",
  "pr.advice": "सल्ला", "pr.strong": "सर्वात मजबूत विषय: {s}.", "pr.overall": "एकूण: {q} प्रश्न सोडवले, {acc}% बरोबर.",
  "pu.magnet.label": "नाणे चुंबक", "pu.magnet.blurb": "नाणी तुमच्याकडे उडतात!", "pu.shield.label": "ढाल", "pu.shield.blurb": "पुढच्या चुकीपासून वाचवते", "pu.slowmo.label": "मंद वेळ", "pu.slowmo.blurb": "सगळे हळू होते", "pu.double.label": "दुप्पट नाणी", "pu.double.blurb": "नाण्यांची किंमत x2",
  "biome.day": "उन्हाळी जंगल", "biome.sunset": "सोनेरी संध्याकाळ", "biome.night": "काजव्यांची रात्र", "biome.dawn": "धुक्याची पहाट",
  "ach.first_run.t": "पहिली पावले", "ach.first_run.d": "तुमची पहिली धाव पूर्ण करा", "ach.coins_50.t": "नाणी गोळा करणारा", "ach.coins_50.d": "एका धावेत 50 नाणी गोळा करा", "ach.coins_150.t": "खजिना शोधक", "ach.coins_150.d": "एका धावेत 150 नाणी गोळा करा",
  "ach.total_500.t": "श्रीमंत शोधक", "ach.total_500.d": "एकूण 500 नाणी गोळा करा", "ach.dist_500.t": "वेगवान पावले", "ach.dist_500.d": "एका धावेत 500 मीटर धावा", "ach.dist_1500.t": "जंगल मॅरेथॉन", "ach.dist_1500.d": "एका धावेत 1500 मीटर धावा",
  "ach.right_5.t": "तल्लख बुद्धी", "ach.right_5.d": "एका धावेत 5 प्रश्न बरोबर सोडवा", "ach.streak_5.t": "आग लागली", "ach.streak_5.d": "सलग 5 बरोबर उत्तरे", "ach.enigma_3.t": "रहस्य गुरू", "ach.enigma_3.d": "एका धावेत 3 सोनेरी रहस्ये गोळा करा",
  "ach.clean_300.t": "अजेय", "ach.clean_300.d": "धडक न बसता 300 मीटर धावा", "ach.combo_20.t": "कॉम्बो राजा", "ach.combo_20.d": "सलग 20 नाणी गोळा करा", "ach.all_rounder.t": "सर्वगुणसंपन्न", "ach.all_rounder.d": "3 वेगवेगळ्या विषयांत बरोबर उत्तर द्या",
  "sp.plus": "अधिक", "sp.minus": "वजा", "sp.times": "गुणिले", "sp.equals": "बरोबर", "sp.next": "पुढे काय येईल?", "sp.answer": "बरोबर उत्तर {x} आहे", "sp.on": "मोठ्याने वाचन सुरू आहे", "sp.spell": "{word} मध्ये कोणते अक्षर राहिले आहे?", "sp.biggest": "सर्वात मोठे कोणते?", "sp.smallest": "सर्वात लहान कोणते?", "sp.sides": "{shape} ला किती बाजू असतात?",
};

export const STRINGS = Object.freeze({ en, hi, mr });

class I18n {
  constructor() { this.lang = "en"; this.listeners = new Set(); }
  set(lang) { this.lang = lang in LANGS ? lang : "en"; if (typeof document !== "undefined") document.documentElement.lang = this.lang; this.listeners.forEach((fn) => fn(this.lang)); return this.lang; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  t(key, vars = {}) {
    let s = STRINGS[this.lang]?.[key] ?? STRINGS.en[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }
  /** Fill every [data-i18n] / [data-i18n-title] / [data-i18n-aria] element under root. */
  apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = this.t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = this.t(el.dataset.i18nTitle); });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", this.t(el.dataset.i18nAria)); });
  }
}
export const i18n = new I18n();
export const t = (key, vars) => i18n.t(key, vars);

/** Pick the starting language: ?lang=, saved choice, then the browser's language. */
export function detectLanguage(saved, search = "", navLang = "") {
  const q = new URLSearchParams(search).get("lang"); if (q in LANGS) return q;
  if (saved in LANGS) return saved;
  const n = String(navLang).toLowerCase(); return n.startsWith("hi") ? "hi" : n.startsWith("mr") ? "mr" : "en";
}
