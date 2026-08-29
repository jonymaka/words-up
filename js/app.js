/* ============================================================
   Words Up · 原型阶段交互脚本
   说明：本文件为"界面原型"演示逻辑（示例数据 + 视图切换 + 模拟交互）。
   正式实现阶段将按设计方案拆分为 data/storage/cards/memorize/quiz/
   dictation/wrongbook/stats/tts/ai 等模块。发音为浏览器 Web Speech 演示。
   ============================================================ */

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------- 示例词库（原型用） ---------- */
  const SAMPLE = [
    { word: "friend",   phonetic: "/frend/",           pos: "n.", posCn: "名词", meaning: "朋友；友人",                  example: "My friend is from China.",        exampleCn: "我的朋友来自中国。",       state: "mastered", wrong: 1 },
    { word: "phone",    phonetic: "/fəʊn/",            pos: "n.", posCn: "名词", meaning: "电话；手机",                  example: "My phone number is 1234567.",    exampleCn: "我的电话号码是 1234567。",  state: "learning", wrong: 3 },
    { word: "teacher",  phonetic: "/ˈtiːtʃə(r)/",      pos: "n.", posCn: "名词", meaning: "老师；教师",                  example: "Our English teacher is kind.",    exampleCn: "我们的英语老师很和蔼。",    state: "mastered", wrong: 0 },
    { word: "name",     phonetic: "/neɪm/",            pos: "n.", posCn: "名词", meaning: "名字；姓名",                  example: "What's your name?",              exampleCn: "你叫什么名字？",             state: "mastered", wrong: 0 },
    { word: "morning",  phonetic: "/ˈmɔːnɪŋ/",         pos: "n.", posCn: "名词", meaning: "早晨；上午",                  example: "Good morning, class!",           exampleCn: "同学们，早上好！",            state: "learning", wrong: 1 },
    { word: "afternoon",phonetic: "/ˌɑːftəˈnuːn/",     pos: "n.", posCn: "名词", meaning: "下午",                        example: "We have PE in the afternoon.",    exampleCn: "我们下午上体育课。",          state: "new", wrong: 0 },
    { word: "hello",    phonetic: "/həˈləʊ/",          pos: "int.", posCn: "感叹词", meaning: "你好",                    example: "Hello, everyone!",               exampleCn: "大家好！",                    state: "mastered", wrong: 0 },
    { word: "goodbye",  phonetic: "/ˌɡʊdˈbaɪ/",        pos: "int.", posCn: "感叹词", meaning: "再见",                    example: "Goodbye, see you tomorrow.",     exampleCn: "再见，明天见。",              state: "learning", wrong: 2 },
    { word: "meet",     phonetic: "/miːt/",            pos: "v.", posCn: "动词", meaning: "遇见；结识",                  example: "Nice to meet you.",              exampleCn: "很高兴认识你。",              state: "new", wrong: 0 },
    { word: "family",   phonetic: "/ˈfæməli/",         pos: "n.", posCn: "名词", meaning: "家；家庭",                    example: "This is my family photo.",       exampleCn: "这是我的全家福。",            state: "new", wrong: 1 }
  ];

  let words = [...SAMPLE];
  let curIdx = 0;
  let memQueue = [...words];
  let memPos = 0;
  let memDone = 0;

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------- 视图路由 ---------- */
  function go(viewId) {
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + viewId));
    $$("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === viewId));
    $("#moreSheet").classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (btn) go(btn.dataset.view);
  });
  $("#moreBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    $("#moreSheet").classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!$("#moreSheet").classList.contains("hidden") && !e.target.closest("#moreSheet") && !e.target.closest("#moreBtn")) {
      $("#moreSheet").classList.add("hidden");
    }
  });

  /* ---------- 发音（浏览器语音演示） ---------- */
  function speak(text) {
    if (!("speechSynthesis" in window)) { toast("当前浏览器不支持语音 😢"); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* ---------- 首页：本周打卡 ---------- */
  (function renderWeek() {
    const days = ["一", "二", "三", "四", "五", "六", "日"];
    const week = [
      { done: true }, { done: true }, { done: true }, { done: true },
      { done: true }, { done: true }, { done: true, today: true }, { tomorrow: true }
    ];
    $("#weekStrip").innerHTML = week.map((d, i) =>
      `<div class="day ${d.done ? "done" : ""} ${d.today ? "today" : ""} ${d.tomorrow ? "tomorrow" : ""}"><span>${days[i]}</span><i>${d.done ? "✓" : (d.today ? "今" : d.tomorrow ? "明" : "")}</i></div>`
    ).join("");
  })();

  /* ---------- 单词本 ---------- */
  const gradeTabs = { g7: { name: "七年级上", units: ["Unit 1", "Unit 2", "Unit 3"] }, g8: { name: "八年级上", units: ["Unit 1"] } };
  let curGrade = "g7", curUnit = "u1";

  function renderWordList() {
    $("#wordList").innerHTML = words.map((w, i) => `
      <li><button class="word-item ${i === curIdx ? "active" : ""}" data-wi="${i}">
        <span class="state-dot ${w.state}"></span>
        <span class="w-main"><b>${w.word}</b><small>${w.phonetic}</small></span>
        <span class="pos-tag">${w.pos}</span>
      </button></li>`).join("");
    $$(".word-item").forEach((b) => b.addEventListener("click", () => showCard(+b.dataset.wi)));
  }

  function showCard(i) {
    curIdx = i;
    const w = words[i];
    renderWordList();
    $("#vcIndex").textContent = (i + 1) + " / " + words.length;
    ["vcWord", "vcWord2"].forEach((id) => ($("#" + id).textContent = w.word));
    $("#vcPhonetic").textContent = w.phonetic;
    $("#vcPos").textContent = w.pos + " " + w.posCn;
    $("#vcMeaning").textContent = w.meaning;
    $("#vcExample").textContent = w.example;
    $("#vcExampleCn").textContent = w.exampleCn;
    $("#vcFlip").classList.remove("flipped");
  }
  $("#vcFlip")?.addEventListener("click", () => $("#vcFlip").classList.toggle("flipped"));
  $("#prevCard")?.addEventListener("click", () => showCard((curIdx - 1 + words.length) % words.length));
  $("#nextCard")?.addEventListener("click", () => showCard((curIdx + 1) % words.length));
  $("#shuffleBtn")?.addEventListener("click", () => showCard(Math.floor(Math.random() * words.length)));
  $("#viewCard")?.addEventListener("click", (e) => {
    if (e.target.closest(".speak-btn")) { e.stopPropagation(); speak(words[curIdx].word); }
  });
  $$("#vcFlip .speak-btn").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); speak(words[curIdx].word); });
  });
  $$("#gradeTabs .seg").forEach((b) => b.addEventListener("click", () => {
    curGrade = b.dataset.grade;
    $$("#gradeTabs .seg").forEach((s) => s.classList.toggle("active", s === b));
  }));
  $$("#unitTabs .seg").forEach((b) => b.addEventListener("click", () => {
    curUnit = b.dataset.unit;
    $$("#unitTabs .seg").forEach((s) => s.classList.toggle("active", s === b));
  }));

  /* ---------- 记忆模式 ---------- */
  function nextMemCard() {
    if (memPos >= memQueue.length) {
      $("#memCard").classList.add("hidden");
      $("#memActions").classList.add("hidden");
      $("#memComplete").classList.remove("hidden");
      return;
    }
    const w = memQueue[memPos++];
    $("#memWord").textContent = w.word;
    $("#memPhonetic").textContent = w.phonetic;
    const reveal = $("#memReveal");
    reveal.querySelector(".vc-pos").textContent = w.pos + " " + w.posCn;
    reveal.querySelector(".mem-meaning").textContent = w.meaning;
    reveal.querySelector("p").textContent = w.example;
    reveal.querySelector("span").textContent = w.exampleCn;
    reveal.classList.add("hidden");
    $("#revealBtn").classList.remove("hidden");
    $("#memCard").classList.remove("hidden");
    $("#memActions").classList.remove("hidden");
    $("#memComplete").classList.add("hidden");
  }
  $("#revealBtn")?.addEventListener("click", () => {
    $("#memReveal").classList.remove("hidden");
    $("#revealBtn").classList.add("hidden");
  });
  $("#knowBtn")?.addEventListener("click", () => {
    memDone++;
    toast("✨ 认识！10 分钟后自动安排复习");
    nextMemCard();
  });
  $("#forgetBtn")?.addEventListener("click", () => {
    toast("😵 没关系，这个词会立即再学一遍");
    nextMemCard();
  });
  $("#memAgainBtn")?.addEventListener("click", () => {
    memPos = 0; memDone = 0;
    nextMemCard();
  });
  nextMemCard();

  /* ---------- 自测 ---------- */
  const QUIZZES = [
    { label: "选出与下列单词对应的中文释义：", word: "friend", answer: 1,
      opts: ["A. 老师", "B. 朋友", "C. 电话", "D. 名字"] },
    { label: "选出与下列单词对应的中文释义：", word: "family", answer: 3,
      opts: ["A. 操场", "B. 教室", "C. 图书馆", "D. 家；家庭"] },
    { label: "选出与下列单词对应的中文释义：", word: "goodbye", answer: 2,
      opts: ["A. 你好", "B. 谢谢", "C. 再见", "D. 早上好"] }
  ];
  let qIdx = 0, qRight = 2, qWrong = 0;
  let curQMode = "en2cn";

  function renderQuiz() {
    const q = QUIZZES[qIdx % QUIZZES.length];
    $("#qLabel").textContent = q.label;
    $("#qWord").innerHTML = q.word + ' <button class="speak-btn" id="qSpeak">🔊</button>';
    $("#qSpeak").addEventListener("click", () => speak(q.word));
    $("#qOptions").innerHTML = q.opts.map((o, i) =>
      `<button class="option" data-opt="${i}">${o}</button>`).join("");
    $("#qNum").textContent = qIdx + 1;
    $("#qRight").textContent = qRight;
    $("#qWrong").textContent = qWrong;
    $("#qBar").style.width = ((qIdx / QUIZZES.length) * 100) + "%";
    $("#quizFb").classList.add("hidden");
    $("#aiExplain").classList.add("hidden");
    $$("#qOptions .option").forEach((b) => b.addEventListener("click", () => checkQuiz(+b.dataset.opt)));
  }
  function checkQuiz(opt) {
    const q = QUIZZES[qIdx % QUIZZES.length];
    const btns = $$("#qOptions .option");
    btns.forEach((b) => (b.disabled = true));
    btns[q.answer].classList.add("correct");
    const fb = $("#quizFb");
    if (opt === q.answer) {
      qRight++;
      fb.querySelector(".fb-correct").style.display = "block";
      fb.querySelector(".fb-wrong").style.display = "none";
      toast("🎉 答对啦！");
    } else {
      qWrong++;
      btns[opt].classList.add("wrong");
      fb.querySelector(".fb-correct").style.display = "none";
      fb.querySelector(".fb-wrong").style.display = "block";
      $("#fbAnswer").textContent = q.opts[q.answer].slice(3);
      toast("❌ 已加入错词本");
    }
    $("#qRight").textContent = qRight;
    $("#qWrong").textContent = qWrong;
    fb.classList.remove("hidden");
  }
  $("#quizNext")?.addEventListener("click", () => { qIdx++; renderQuiz(); });
  $$("#quizModes .seg").forEach((b) => b.addEventListener("click", () => {
    curQMode = b.dataset.qmode;
    $$("#quizModes .seg").forEach((s) => s.classList.toggle("active", s === b));
    $("#quizCard").classList.toggle("hidden", curQMode === "spell");
    $("#spellCard").classList.toggle("hidden", curQMode !== "spell");
  }));
  $("#aiExplainBtn")?.addEventListener("click", () => {
    $("#aiExplain").classList.remove("hidden");
    toast("🤖 AI 已生成错因解析");
  });
  $("#spellSpeak")?.addEventListener("click", () => speak("friend"));
  $("#spellCheck")?.addEventListener("click", () => {
    const v = $("#spellInput").value.trim().toLowerCase();
    const fb = $("#spellFb");
    if (v === "friend") {
      $("#spellInput").classList.add("ok");
      fb.innerHTML = '<p class="fb-correct">🎉 拼写正确！</p>';
    } else {
      $("#spellInput").classList.add("bad");
      fb.innerHTML = '<p class="fb-wrong">❌ 正确答案是 <b>friend</b></p>';
    }
    fb.classList.remove("hidden");
  });
  renderQuiz();

  /* ---------- 听写 ---------- */
  const DICT = ["hello", "friend", "teacher", "phone", "morning"];
  let dictIdx = 1, dictSpeed = 0.9;
  function speakDict() {
    const u = new SpeechSynthesisUtterance(DICT[dictIdx]);
    u.lang = "en-US"; u.rate = dictSpeed;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    const btn = $("#dictPlay");
    btn.classList.add("playing");
    setTimeout(() => btn.classList.remove("playing"), 1500);
  }
  $("#dictPlay")?.addEventListener("click", speakDict);
  $("#dictReplay")?.addEventListener("click", speakDict);
  $$("#view-dictation .dict-speed .seg").forEach((b) => b.addEventListener("click", () => {
    dictSpeed = parseFloat(b.dataset.speed);
    $$("#view-dictation .dict-speed .seg").forEach((s) => s.classList.toggle("active", s === b));
  }));
  $("#dictCheck")?.addEventListener("click", () => {
    const v = $("#dictInput").value.trim().toLowerCase();
    const fb = $("#dictFb");
    if (v === DICT[dictIdx]) {
      $("#dictInput").classList.add("ok");
      fb.innerHTML = '<p class="fb-correct">🎉 写对啦！</p>';
    } else {
      $("#dictInput").classList.add("bad");
      fb.innerHTML = `<p class="fb-wrong">❌ 正确答案是 <b>${DICT[dictIdx]}</b></p>`;
    }
    fb.classList.remove("hidden");
  });

  /* ---------- 错词本 ---------- */
  function renderWb() {
    const wb = words.filter((w) => w.wrong > 0);
    $("#wbTotal").textContent = wb.length;
    $("#wbList").innerHTML = wb.map((w) => `
      <li class="wb-item">
        <span class="state-dot wrong"></span>
        <div class="wb-main"><b>${w.word}</b><small>${w.phonetic} · ${w.pos} ${w.meaning}</small></div>
        <div class="wb-meta"><span>错 ${w.wrong} 次</span><button class="icon-btn wb-del" data-word="${w.word}" title="移除">✕</button></div>
      </li>`).join("");
    $$(".wb-del").forEach((b) => b.addEventListener("click", () => {
      const wi = words.findIndex((x) => x.word === b.dataset.word);
      if (wi >= 0) words[wi].wrong = 0;
      renderWb();
      toast("已从错词本移除");
    }));
  }
  $("#retrainAll")?.addEventListener("click", () => go("memorize"));
  renderWb();

  /* ---------- 统计：打卡日历 + 徽章 ---------- */
  (function renderCalendar() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const lead = first.getDay() === 0 ? 6 : first.getDay() - 1; // 周一为第一天
    const today = now.getDate();
    let cells = '<span class="cal-w">一</span><span class="cal-w">二</span><span class="cal-w">三</span><span class="cal-w">四</span><span class="cal-w">五</span><span class="cal-w">六</span><span class="cal-w">日</span>';
    for (let i = 0; i < lead; i++) cells += '<span class="cal-d empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      let cls = "cal-d";
      if (d < today) cls += " done";
      if (d <= today && d > today - 7) cls += " streak";
      if (d === today) cls += " today done";
      cells += `<span class="${cls}">${d}</span>`;
    }
    $("#calMonth").innerHTML = cells;
  })();
  (function renderBadges() {
    const badges = [
      { e: "🔥", n: "坚持 7 天", on: true }, { e: "💯", n: "百词斩", on: true },
      { e: "🎯", n: "神射手", on: false }, { e: "🧹", n: "大扫除", on: false },
      { e: "🌙", n: "夜猫子", on: false }, { e: "🏆", n: "单元冠军", on: false }
    ];
    $("#badgeGrid").innerHTML = badges.map((b) =>
      `<div class="badge-cell ${b.on ? "unlocked" : ""}"><span>${b.e}</span><small>${b.n}</small></div>`).join("");
  })();
  $("#genReport")?.addEventListener("click", () => {
    $("#reportLoading").classList.remove("hidden");
    $("#reportBody").classList.add("hidden");
    setTimeout(() => {
      $("#reportLoading").classList.add("hidden");
      $("#reportBody").classList.remove("hidden");
    }, 900);
  });
  $("#exportReport")?.addEventListener("click", () => {
    const data = { date: new Date().toISOString().slice(0, 10), learned: 320, accuracy: 0.82, streak: 7, wrongWords: ["phone", "goodbye", "family"] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "words-up-report.json";
    a.click();
    toast("📄 学习报告已导出");
  });

  /* ---------- 设置 ---------- */
  // 发音引擎检测（模拟：浏览器语音可用）
  function checkTts() {
    const el = $("#ttsStatus");
    if ("speechSynthesis" in window) {
      el.className = "tts-status fallback";
      el.innerHTML = '<span class="status-dot">●</span> 浏览器语音可用（本地微软代理未检测到，自动降级）';
    } else {
      el.className = "tts-status";
      el.innerHTML = '<span class="status-dot">●</span> 当前浏览器不支持发音';
    }
  }
  checkTts();
  $("#ttsCheck")?.addEventListener("click", checkTts);
  $("#ttsTest")?.addEventListener("click", () => {
    const u = new SpeechSynthesisUtterance("Hello! Let's learn English with Words Up.");
    u.lang = "en-US";
    speechSynthesis.speak(u);
  });

  // 导入 JSON
  $("#dropzone")?.addEventListener("click", () => $("#jsonFile").click());
  ["dragover", "dragleave"].forEach((ev) =>
    $("#dropzone")?.addEventListener(ev, (e) => { e.preventDefault(); $("#dropzone").classList.toggle("over", ev === "dragover"); }));
  $("#dropzone")?.addEventListener("drop", (e) => {
    e.preventDefault();
    $("#dropzone").classList.remove("over");
    handleJson(e.dataTransfer.files[0]);
  });
  $("#jsonFile")?.addEventListener("change", (e) => handleJson(e.target.files[0]));
  function handleJson(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const obj = JSON.parse(r.result);
        if (obj && obj.grades && Array.isArray(obj.grades)) {
          showImport("✅ 导入成功！词库「" + (obj.name || "未命名") + "」已就绪", true);
        } else {
          showImport("❌ 格式不正确：缺少 grades 字段，请检查 JSON 结构", false);
        }
      } catch (err) {
        showImport("❌ JSON 解析失败：" + err.message, false);
      }
    };
    r.readAsText(file);
  }
  function showImport(msg, ok) {
    const el = $("#importStatus");
    el.textContent = msg;
    el.className = "import-status " + (ok ? "ok" : "err");
  }
  $("#loadSample")?.addEventListener("click", () => {
    words = [...SAMPLE];
    showImport("✨ 已载入内置示例词库（10 词）", true);
    renderWordList(); renderWb();
    toast("✨ 示例词库已载入");
  });

  // AI 词条生成（模拟流程：生成 → 预览 → 保存）
  $("#addWordBtn")?.addEventListener("click", () => {
    go("settings");
    $("#aiForm").classList.add("hidden");
    $("#aiWordInput").value = "";
    $("#aiWordInput").focus();
  });
  $("#addWordCardBtn")?.addEventListener("click", () => {
    go("settings");
    $("#aiForm").classList.add("hidden");
    $("#aiWordInput").value = "";
    $("#aiWordInput").focus();
  });
  $("#aiGen")?.addEventListener("click", () => {
    const w = $("#aiWordInput").value.trim();
    if (!w) { toast("请先输入一个单词 ✍️"); return; }
    toast("🤖 AI 正在生成词条…");
    $("#aiGen").disabled = true;
    setTimeout(() => {
      // 模拟 AI 返回（正式版将调用 OpenAI 兼容接口并强制 JSON 解析）
      const fake = {
        umbrella:  { phonetic: "/ʌmˈbrelə/", pos: "n.", meaning: "雨伞；伞", example: "Take an umbrella with you.", exampleCn: "随身带把伞吧。" },
        happy:     { phonetic: "/ˈhæpi/", pos: "adj.", meaning: "快乐的；开心的", example: "I am very happy today.", exampleCn: "我今天很开心。" },
        library:   { phonetic: "/ˈlaɪbrəri/", pos: "n.", meaning: "图书馆；书库", example: "We read in the library.", exampleCn: "我们在图书馆看书。" }
      };
      const f = fake[w.toLowerCase()] || { phonetic: "/?/", pos: "n.", meaning: "（示例释义，正式版由 AI 生成）", example: "Example sentence.", exampleCn: "示例翻译。" };
      $("#fWord").value = w;
      $("#fPhonetic").value = f.phonetic;
      $("#fPos").value = f.pos;
      $("#fMeaning").value = f.meaning;
      $("#fExample").value = f.example;
      $("#fExampleCn").value = f.exampleCn;
      $("#aiForm").classList.remove("hidden");
      $("#aiGen").disabled = false;
    }, 1000);
  });
  $("#aiRegen")?.addEventListener("click", () => $("#aiGen").click());
  $("#aiSave")?.addEventListener("click", () => {
    const w = $("#fWord").value.trim();
    if (!w) { toast("单词不能为空"); return; }
    words.unshift({
      word: w, phonetic: $("#fPhonetic").value.trim(),
      pos: $("#fPos").value.trim(), posCn: "名词",
      meaning: $("#fMeaning").value.trim(),
      example: $("#fExample").value.trim(), exampleCn: $("#fExampleCn").value.trim(),
      state: "new", wrong: 0
    });
    curIdx = 0;
    $("#aiForm").classList.add("hidden");
    renderWordList(); renderWb();
    toast("✅ 已保存入库：" + w);
  });

  // AI 配置
  $("#aiSaveCfg")?.addEventListener("click", () => toast("💾 AI 配置已保存（原型演示）"));
  $("#aiTestCfg")?.addEventListener("click", () => {
    const el = $("#aiTestStatus");
    el.className = "ai-test-status";
    el.textContent = "🔌 正在检测连接…";
    setTimeout(() => {
      el.className = "ai-test-status ok";
      el.textContent = "✅ 连接成功！延迟 320ms（原型演示，正式版将真实请求 /chat/completions）";
    }, 900);
  });

  // 数据管理
  $("#exportData")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ words, progress: { learned: 320, accuracy: 0.82 } }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "words-up-data.json";
    a.click();
    toast("📄 学习数据已导出");
  });
  $("#resetData")?.addEventListener("click", () => {
    if (confirm("确定要清空全部学习进度吗？此操作不可恢复。")) {
      words = [...SAMPLE];
      renderWordList(); renderWb();
      toast("⚠️ 已重置为初始状态（原型演示）");
    }
  });

  /* ---------- 初始化 ---------- */
  renderWordList();
  showCard(0);
})();
