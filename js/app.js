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

  /* ==========================================================
     词库数据模型：grades(年级) > units(单元) > words(单词)
     设计见 README §6.2；数据结构与导入/添加/设置联动
     ========================================================== */
  const BANK_KEY = "wup_bank_v1";

  function defaultBank() {
    return {
      version: 1,
      name: "我的词库",
      grades: [
        {
          id: "g7", name: "七年级上",
          units: [
            { id: "g7u1", name: "Unit 1", title: "Making Friends", words: [
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
            ] },
            { id: "g7u2", name: "Unit 2", title: "School Life", words: [] }
          ]
        },
        {
          id: "g8", name: "八年级上",
          units: [
            { id: "g8u1", name: "Unit 1", title: "Vacation", words: [] }
          ]
        }
      ]
    };
  }

  let bank = loadBank();
  let curGradeId = bank.grades[0] ? bank.grades[0].id : "";
  let curUnitId = bank.grades[0] && bank.grades[0].units[0] ? bank.grades[0].units[0].id : "";
  let curIdx = 0;
  let memQueue = [];
  let memPos = 0;
  let memDone = 0;

  function loadBank() {
    try {
      const raw = localStorage.getItem(BANK_KEY);
      if (raw) {
        const b = JSON.parse(raw);
        if (b && b.grades && Array.isArray(b.grades)) return b;
      }
    } catch (e) {}
    return defaultBank();
  }
  function saveBank() { localStorage.setItem(BANK_KEY, JSON.stringify(bank)); }

  // 定位辅助
  function gradeOf(id) { return bank.grades.find((g) => g.id === id); }
  function unitOf(gradeId, unitId) {
    const g = gradeOf(gradeId);
    return g ? g.units.find((u) => u.id === unitId) : null;
  }
  function currentGrade() { return gradeOf(curGradeId); }
  function currentUnit() { return unitOf(curGradeId, curUnitId); }
  function currentWords() {
    const u = currentUnit();
    return u ? u.words : [];
  }
  function allWords() {
    return bank.grades.reduce((acc, g) =>
      acc.concat(g.units.reduce((a2, u) => a2.concat(u.words), [])), []);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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

  /* ---------- 单词本：从词库动态渲染年级/单元/单词 ---------- */
  function renderGradeTabs() {
    $("#gradeTabs").innerHTML = bank.grades.map((g) =>
      `<button class="seg ${g.id === curGradeId ? "active" : ""}" data-grade="${g.id}">${g.name}<small>${g.units.length} 单元</small></button>`
    ).join("") || '<span class="bank-empty">还没有年级，请到设置页创建</span>';
    $$("#gradeTabs .seg").forEach((b) => b.addEventListener("click", () => {
      curGradeId = b.dataset.grade;
      const g = gradeOf(curGradeId);
      curUnitId = g && g.units[0] ? g.units[0].id : "";
      curIdx = 0;
      renderGradeTabs(); renderUnitTabs(); renderWordList();
    }));
  }
  function renderUnitTabs() {
    const g = currentGrade();
    $("#unitTabs").innerHTML = g
      ? g.units.map((u) =>
          `<button class="seg ${u.id === curUnitId ? "active" : ""}" data-unit="${u.id}">${u.name}<small>${u.words.length} 词 · ${u.title || ""}</small></button>`
        ).join("")
      : "";
    $$("#unitTabs .seg").forEach((b) => b.addEventListener("click", () => {
      curUnitId = b.dataset.unit;
      curIdx = 0;
      renderUnitTabs(); renderWordList(); refreshMemQueue();
    }));
  }
  function renderWordList() {
    const list = currentWords();
    $("#wordList").innerHTML = list.map((w, i) => `
      <li><button class="word-item ${i === curIdx ? "active" : ""}" data-wi="${i}">
        <span class="state-dot ${w.state}"></span>
        <span class="w-main"><b>${w.word}</b><small>${w.phonetic}</small></span>
        <span class="pos-tag">${w.pos}</span>
      </button></li>`).join("") || '<li class="bank-empty">该单元还没有单词，点右上角「➕ 添加」试试</li>';
    $$(".word-item").forEach((b) => b.addEventListener("click", () => showCard(+b.dataset.wi)));
  }
  function safeWords() { return currentWords(); }
  function showCard(i) {
    const list = safeWords();
    if (!list.length) return;
    curIdx = ((i % list.length) + list.length) % list.length;
    const w = list[curIdx];
    renderWordList();
    $("#vcIndex").textContent = (curIdx + 1) + " / " + list.length;
    ["vcWord", "vcWord2"].forEach((id) => ($("#" + id).textContent = w.word));
    $("#vcPhonetic").textContent = w.phonetic;
    $("#vcPos").textContent = w.pos + " " + w.posCn;
    $("#vcMeaning").textContent = w.meaning;
    $("#vcExample").textContent = w.example;
    $("#vcExampleCn").textContent = w.exampleCn;
    $("#vcFlip").classList.remove("flipped");
  }
  $("#vcFlip")?.addEventListener("click", () => $("#vcFlip").classList.toggle("flipped"));
  $("#prevCard")?.addEventListener("click", () => showCard(curIdx - 1));
  $("#nextCard")?.addEventListener("click", () => showCard(curIdx + 1));
  $("#shuffleBtn")?.addEventListener("click", () => showCard(Math.floor(Math.random() * Math.max(safeWords().length, 1))));
  $("#viewCard")?.addEventListener("click", (e) => {
    if (e.target.closest(".speak-btn")) { e.stopPropagation(); const l = safeWords(); speak(l[curIdx] ? l[curIdx].word : ""); }
  });
  $$("#vcFlip .speak-btn").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); const l = safeWords(); speak(l[curIdx] ? l[curIdx].word : ""); });
  });
  /* ---------- 记忆模式（队列来自当前选中单元的单词） ---------- */
  function refreshMemQueue() {
    memQueue = [...currentWords()];
    memPos = 0; memDone = 0;
  }
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
  let lastWrong = null;   // 最近一次答错记录，供 AI 解析使用
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
      lastWrong = {
        qText: "选出 " + q.word + " 的中文释义：" + q.opts[q.answer].slice(3),
        userAnswer: q.opts[opt].slice(3),
        correctAnswer: q.opts[q.answer].slice(3)
      };
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
    const el = $("#aiExplain");
    el.classList.remove("hidden");
    if (!window.WordsAI) { el.innerHTML = "<p>🤖 AI 客户端未加载，请刷新页面</p>"; return; }
    if (!lastWrong) { el.innerHTML = "<p>先答错一道题，才能让 AI 帮你解析哦～</p>"; return; }
    if (!WordsAI.isConfigured()) {
      el.innerHTML = "<p>⚠️ 请先在「设置 → AI 配置」填写并保存 Base URL 与 API Key。</p>";
      return;
    }
    el.innerHTML = '<p class="ai-load">🤖 AI 正在解析错因…</p>';
    WordsAI.explainMistake(lastWrong.qText, lastWrong.userAnswer, lastWrong.correctAnswer)
      .then((text) => {
        const lines = text.split(/\n/).filter((s) => s.trim());
        el.innerHTML = lines.map((ln) => {
          const t = ln.trim();
          if (/^错因/.test(t)) return "<p><b>" + t.replace(/^错因[：: ]*/, "") + "</b>（错因）</p>";
          if (/^记忆方法|^记忆/.test(t)) return "<p><b>记忆方法：</b>" + t.replace(/^记忆方法[：: ]*/, "") + "</p>";
          return "<p>" + t + "</p>";
        }).join("") || "<p>" + text + "</p>";
      })
      .catch((err) => {
        el.innerHTML = "<p>⚠️ " + (err.message || "AI 解析失败") + "</p>";
      });
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

  /* ---------- 错词本（跨全部年级/单元汇总） ---------- */
  function renderWb() {
    const wb = allWords().filter((w) => w.wrong > 0);
    $("#wbTotal").textContent = wb.length;
    $("#wbList").innerHTML = wb.map((w) => `
      <li class="wb-item">
        <span class="state-dot wrong"></span>
        <div class="wb-main"><b>${w.word}</b><small>${w.phonetic} · ${w.pos} ${w.meaning}</small></div>
        <div class="wb-meta"><span>错 ${w.wrong} 次</span><button class="icon-btn wb-del" data-word="${w.word}" title="移除">✕</button></div>
      </li>`).join("");
    $$(".wb-del").forEach((b) => b.addEventListener("click", () => {
      const w = allWords().find((x) => x.word === b.dataset.word);
      if (w) w.wrong = 0;
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
    if (!window.WordsAI) {
      $("#reportLoading").classList.add("hidden");
      toast("AI 客户端未加载，请刷新页面");
      return;
    }
    if (!WordsAI.isConfigured()) {
      $("#reportLoading").classList.add("hidden");
      toast("⚠️ 请先在「设置 → AI 配置」保存 Base URL 与 API Key");
      return;
    }
    const wrongWords = allWords().filter((w) => w.wrong > 0).map((w) => w.word);
    WordsAI.generateReport({
      learned: 320, total: 480, accuracy: 0.82, streak: 7,
      wrongWords: wrongWords, todayDone: 18, todayGoal: 30
    }).then((text) => {
      $("#reportLoading").classList.add("hidden");
      $("#reportBody").classList.remove("hidden");
      const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
      const summary = lines.find((l) => /^总评/.test(l)) || lines[0] || "";
      const tips = lines.filter((l) => !/^总评/.test(l) && l !== lines[0]).slice(0, 6);
      $("#reportSummary").innerHTML = "<p><b>" + (summary.replace(/^总评[：: ]*/, "") || text) + "</b></p>";
      $("#reportTips").innerHTML = tips.map((l) => "<li>" + l.replace(/^[-•-]\s*/, "") + "</li>").join("");
      const exp = $("#exportReport");
      exp.classList.remove("hidden");
      exp.dataset.report = text;
    }).catch((err) => {
      $("#reportLoading").classList.add("hidden");
      toast("⚠️ " + (err.message || "报告生成失败"));
    });
  });
  $("#exportReport")?.addEventListener("click", () => {
    const data = {
      date: new Date().toISOString().slice(0, 10),
      report: $("#exportReport").dataset.report || "",
      learned: 320, accuracy: 0.82, streak: 7,
      wrongWords: allWords().filter((w) => w.wrong > 0).map((w) => w.word)
    };
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
          bank = normalizeBank(obj);
          saveBank();
          curGradeId = bank.grades.length ? bank.grades[0].id : "";
          curUnitId = bank.grades.length && bank.grades[0].units.length ? bank.grades[0].units[0].id : "";
          curIdx = 0;
          refreshAll();
          showImport("✅ 导入成功！词库「" + (bank.name || "未命名") + "」共 " + countWords() + " 词、" + bank.grades.length + " 个年级已入库", true);
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

  /* ---------- 词库归一化 / 统计 / 全局刷新 ---------- */
  function normalizeBank(obj) {
    const norm = { version: 1, name: obj.name || "导入词库", grades: [] };
    (obj.grades || []).forEach((g) => {
      const grade = { id: g.id || uid(), name: g.name || "未命名年级", units: [] };
      (g.units || []).forEach((u) => {
        const unit = { id: u.id || uid(), name: u.name || "未命名单元", title: u.title || "", words: [] };
        (u.words || []).forEach((w) => {
          if (w && w.word) {
            unit.words.push({
              word: String(w.word), phonetic: w.phonetic || "/?/", pos: w.pos || "n.", posCn: w.posCn || "其他",
              meaning: w.meaning || "", example: w.example || "", exampleCn: w.exampleCn || "",
              state: w.state || "new", wrong: Number(w.wrong) || 0
            });
          }
        });
        grade.units.push(unit);
      });
      if (grade.units.length || g.units) norm.grades.push(grade);
    });
    if (!norm.grades.length) norm.grades.push({ id: "g" + uid(), name: "默认年级", units: [{ id: "u" + uid(), name: "Unit 1", title: "", words: [] }] });
    return norm;
  }
  function countWords() {
    return allWords().length;
  }
  function refreshAll() {
    renderUnitProgress(); renderGradeTabs(); renderUnitTabs(); renderWordList(); renderWb();
    renderBankMgmt(); renderAiTarget(); carryUiSel();
  }
  $("#loadSample")?.addEventListener("click", () => {
    bank = defaultBank();
    curGradeId = bank.grades[0].id;
    curUnitId = bank.grades[0].units[0].id;
    curIdx = 0;
    saveBank();
    renderUnitProgress(); renderGradeTabs(); renderUnitTabs(); renderWordList(); renderWb();
    renderBankMgmt(); renderAiTarget();
    showImport("✨ 已载入内置示例词库（10 词）", true);
    toast("✨ 示例词库已载入");
  });

  // ---------- AI 词条生成（真实调用 OpenAI 兼容接口） ----------
  function showAiGenError(msg, hint) {
    const el = $("#aiGenError");
    el.innerHTML = "<b>⚠️ AI 生成失败</b>" + msg + (hint ? "<br><small>" + hint + "</small>" : "");
    el.classList.remove("hidden");
  }
  function clearAiGenError() { $("#aiGenError")?.classList.add("hidden"); }

  $("#addWordBtn")?.addEventListener("click", () => {
    go("settings");
    $("#aiForm").classList.add("hidden");
    clearAiGenError();
    $("#aiWordInput").value = "";
    $("#aiWordInput").focus();
  });
  $("#addWordCardBtn")?.addEventListener("click", () => {
    go("settings");
    $("#aiForm").classList.add("hidden");
    clearAiGenError();
    $("#aiWordInput").value = "";
    $("#aiWordInput").focus();
  });
  const genWord = () => {
    const w = $("#aiWordInput").value.trim();
    if (!w) { toast("请先输入一个单词 ✍️"); return; }
    if (!window.WordsAI) { toast("AI 客户端未加载，请刷新页面"); return; }
    if (!WordsAI.isConfigured()) {
      showAiGenError("请先在上方「AI 配置」填写 Base URL 与 API Key 并保存。", "Agnes 默认已填好 Base URL 与模型名，只需粘贴你的 API Key。");
      go("settings");
      return;
    }
    $("#aiGen").disabled = true;
    $("#aiGen").textContent = "⏳ 生成中…";
    clearAiGenError();
    WordsAI.generateWord(w)
      .then((f) => {
        $("#fWord").value = f.word;
        $("#fPhonetic").value = f.phonetic;
        $("#fPos").value = f.pos;
        $("#fMeaning").value = f.meaning;
        $("#fExample").value = f.example;
        $("#fExampleCn").value = f.exampleCn;
        $("#aiForm").classList.remove("hidden");
        $("#aiGenError").classList.add("hidden");
        toast("🤖 AI 已生成 " + f.word + "，请审阅后保存");
      })
      .catch((err) => {
        showAiGenError(err.message || "未知错误", err.hint || "");
      })
      .finally(() => {
        $("#aiGen").disabled = false;
        $("#aiGen").textContent = "🤖 AI 自动生成";
      });
  };
  $("#aiGen")?.addEventListener("click", genWord);
  $("#aiRegen")?.addEventListener("click", () => {
    $("#aiForm").classList.add("hidden");
    genWord();
  });
  const POS_CN = { "n.": "名词", "v.": "动词", "adj.": "形容词", "adv.": "副词", "prep.": "介词", "conj.": "连词", "pron.": "代词", "int.": "感叹词", "num.": "数词", "art.": "冠词" };
  $("#aiSave")?.addEventListener("click", () => {
    const w = $("#fWord").value.trim();
    if (!w) { toast("单词不能为空"); return; }
    const pos = $("#fPos").value.trim();
    const targetUnit = currentUnit();
    if (!targetUnit) { toast("⚠️ 请先选择要加入的年级和单元"); return; }
    const ww = {
      word: w, phonetic: $("#fPhonetic").value.trim(),
      pos: pos, posCn: POS_CN[pos] || "其他",
      meaning: $("#fMeaning").value.trim(),
      example: $("#fExample").value.trim(), exampleCn: $("#fExampleCn").value.trim(),
      state: "new", wrong: 0
    };
    targetUnit.words.unshift(ww);
    saveBank();
    curIdx = 0;
    $("#aiForm").classList.add("hidden");
    renderUnitTabs(); renderWordList(); renderWb(); renderUnitProgress(); renderBankMgmt(); carryUiSel();
    toast("✅ 已保存入库：" + w + "（" + (currentGrade() ? currentGrade().name : "") + " · " + (currentUnit() ? currentUnit().name : "") + "）");
  });

  // ---------- AI 配置：读取 / 保存 / 连接自检（真实） ----------
  function loadAiForm() {
    const c = window.WordsAI ? WordsAI.loadConfig() : null;
    if (!c) return;
    $("#aiBase").value = c.baseUrl;
    $("#aiKey").value = c.apiKey;
    $("#aiModel").value = c.model;
  }
  loadAiForm();
  $("#aiSaveCfg")?.addEventListener("click", () => {
    if (!window.WordsAI) { toast("AI 客户端未加载，请刷新页面"); return; }
    WordsAI.saveConfig({
      baseUrl: $("#aiBase").value.trim(),
      apiKey: $("#aiKey").value.trim(),
      model: $("#aiModel").value.trim()
    });
    const st = $("#aiTestStatus");
    st.className = "ai-test-status ok";
    st.textContent = "💾 配置已保存到本机浏览器（localStorage）";
    toast("💾 AI 配置已保存");
  });
  $("#aiTestCfg")?.addEventListener("click", () => {
    if (!window.WordsAI) { toast("AI 客户端未加载，请刷新页面"); return; }
    WordsAI.saveConfig({
      baseUrl: $("#aiBase").value.trim(),
      apiKey: $("#aiKey").value.trim(),
      model: $("#aiModel").value.trim()
    });
    const el = $("#aiTestStatus");
    el.className = "ai-test-status";
    el.textContent = "🔌 正在检测连接…";
    el.classList.remove("hidden");
    WordsAI.selfTest()
      .then((info) => {
        el.className = "ai-test-status ok";
        el.textContent = "✅ 连接成功！模型 " + info.model + " 延迟 " + info.ms + "ms，回复：「" + info.reply + "」";
      })
      .catch((err) => {
        el.className = "ai-test-status err";
        el.textContent = (err.message || "检测失败") + (err.hint ? " " + err.hint : "");
      });
  });

  // 数据管理
  $("#exportData")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(bank, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "words-up-data.json";
    a.click();
    toast("📄 学习数据已导出");
  });
  $("#resetData")?.addEventListener("click", () => {
    if (confirm("确定要恢复为默认示例词库吗？当前词库与进度将被覆盖。")) {
      bank = defaultBank();
      curGradeId = bank.grades[0].id;
      curUnitId = bank.grades[0].units[0].id;
      curIdx = 0;
      saveBank();
      renderUnitProgress(); renderGradeTabs(); renderUnitTabs(); renderWordList(); renderWb();
      renderBankMgmt(); renderAiTarget();
      toast("⚠️ 已恢复默认词库");
    }
  });


  /* ==========================================================
     年级与单元管理（设置页）+ 添加词目标下拉 + 首页进度
     ========================================================== */
  let mgmtGradeId = curGradeId;
  let mgmtUnitId = curUnitId;
  let selGradeId = curGradeId, selUnitId = curUnitId;

  // 首页单元进度列表
  function renderUnitProgress() {
    const list = $("#unitProgressList");
    if (!list) return;
    list.innerHTML = bank.grades.map((g) => g.units.map((u) => {
      const total = u.words.length;
      const learned = u.words.filter((w) => w.state !== "new").length;
      const rate = total ? Math.round(learned / total * 100) : 0;
      return `<div class="unit-progress">
        <div class="up-top"><span class="grade-badge g7">${g.name.replace("年级", "")}</span><span class="up-name">${u.name} · ${u.title || ""}</span><span class="up-rate">${rate}%</span></div>
        <div class="bar"><i style="width:${Math.max(rate, 3)}%"></i></div>
        <small>已学 ${learned} / ${total} 词</small>
      </div>`;
    }).join("")).join("") || '<span class="bank-empty">还没有年级单元，去设置页创建吧</span>';
  }

  // 添加单词：年级/单元下拉（跟随当前选中）
  function renderAiTarget() {
    const gs = $("#aiGradeSel"), us = $("#aiUnitSel");
    if (!gs || !us) return;
    gs.innerHTML = bank.grades.map((g) => `<option value="${g.id}" ${g.id === selGradeId ? "selected" : ""}>${g.name}</option>`).join("");
    const g = gradeOf(selGradeId);
    us.innerHTML = (g || { units: [] }).units.map((u) => `<option value="${u.id}" ${u.id === selUnitId ? "selected" : ""}>${u.name}</option>`).join("");
    gs.onchange = () => {
      selGradeId = gs.value; selUnitId = "";
      renderAiTarget();
    };
    us.onchange = () => { selUnitId = us.value; };
  }
  // aiSave 时切换到下拉选中的目标（把 curGradeId/curUnitId 同步，逻辑用 currentUnit 保存）
  function carryUiSel() {
    if (selGradeId) curGradeId = selGradeId;
    if (selUnitId) curUnitId = selUnitId;
  }

  // 设置页年级/单元管理
  function renderBankMgmt() {
    const gBox = $("#bankGrades"), uBox = $("#bankUnits");
    if (!gBox) return;
    gBox.innerHTML = bank.grades.map((g) =>
      `<button class="seg ${g.id === mgmtGradeId ? "active" : ""}" data-bg="${g.id}">${g.name}<small>${g.units.length} 单元</small></button>`
    ).join("");
    gBox.querySelectorAll(".seg").forEach((b) => b.addEventListener("click", () => {
      mgmtGradeId = b.dataset.bg;
      const g = gradeOf(mgmtGradeId);
      mgmtUnitId = g && g.units[0] ? g.units[0].id : "";
      // 同步选择到添加词下拉与选中单元
      selGradeId = mgmtGradeId; selUnitId = mgmtUnitId;
      curGradeId = mgmtGradeId; curUnitId = mgmtUnitId;
      carryUiSel();
      renderBankMgmt(); renderAiTarget(); renderUnitTabs(); renderWordList();
    }));
    const g = gradeOf(mgmtGradeId);
    uBox.innerHTML = (g && g.units.length)
      ? g.units.map((u) => `<div class="bank-unit-row ${u.id === mgmtUnitId ? "selected" : ""}" data-bu="${u.id}">
          <span class="bu-name">${u.name}<small style="color:var(--ink-3)"> · ${u.title || ""}</small></span>
          <span class="bu-meta">${u.words.length} 词</span>
        </div>`).join("")
      : '<div class="bank-empty">该年级还没有单元，点「➕ 新增单元」创建</div>';
    uBox.querySelectorAll(".bank-unit-row").forEach((r) => r.addEventListener("click", () => {
      mgmtUnitId = r.dataset.bu;
      selUnitId = mgmtUnitId; curUnitId = mgmtUnitId;
      carryUiSel();
      renderBankMgmt(); renderAiTarget(); renderUnitTabs(); renderWordList();
    }));
  }

  // 年级 CRUD
  $("#addGradeBtn")?.addEventListener("click", () => {
    const name = prompt("新年级名称（如：七年级上）");
    if (!name || !name.trim()) return;
    bank.grades.push({ id: "g" + uid(), name: name.trim(), units: [{ id: "u" + uid(), name: "Unit 1", title: "", words: [] }] });
    mgmtGradeId = bank.grades[bank.grades.length - 1].id;
    mgmtUnitId = bank.grades[bank.grades.length - 1].units[0].id;
    selGradeId = mgmtGradeId; selUnitId = mgmtUnitId;
    curGradeId = mgmtGradeId; curUnitId = mgmtUnitId;
    saveBank(); refreshAll(); toast("✅ 已新增年级：" + name.trim());
  });
  $("#renameGradeBtn")?.addEventListener("click", () => {
    const g = gradeOf(mgmtGradeId);
    if (!g) return;
    const name = prompt("重命名年级为：", g.name);
    if (name && name.trim()) { g.name = name.trim(); saveBank(); refreshAll(); toast("✅ 已重命名"); }
  });
  $("#delGradeBtn")?.addEventListener("click", () => {
    const g = gradeOf(mgmtGradeId);
    if (!g) return;
    if (!confirm("删除年级「" + g.name + "」及其全部单元与单词？")) return;
    bank.grades = bank.grades.filter((x) => x.id !== mgmtGradeId);
    mgmtGradeId = bank.grades.length ? bank.grades[0].id : "";
    mgmtUnitId = bank.grades.length && bank.grades[0].units.length ? bank.grades[0].units[0].id : "";
    selGradeId = mgmtGradeId; selUnitId = mgmtUnitId;
    curGradeId = mgmtGradeId; curUnitId = mgmtUnitId;
    saveBank(); refreshAll(); toast("🗑️ 已删除年级");
  });

  // 单元 CRUD
  $("#addUnitBtn")?.addEventListener("click", () => {
    const g = gradeOf(mgmtGradeId);
    if (!g) { toast("请先选择或新增一个年级"); return; }
    const name = prompt("新单元名称（如：Unit 2）：", "Unit " + (g.units.length + 1));
    const title = prompt("单元标题（如：My Family，可留空）：", "");
    if (!name || !name.trim()) return;
    g.units.push({ id: "u" + uid(), name: name.trim(), title: (title || "").trim(), words: [] });
    mgmtUnitId = g.units[g.units.length - 1].id;
    selUnitId = mgmtUnitId; curUnitId = mgmtUnitId;
    carryUiSel();
    saveBank(); refreshAll(); toast("✅ 已新增单元：" + name.trim());
  });
  $("#renameUnitBtn")?.addEventListener("click", () => {
    const g = gradeOf(mgmtGradeId), u = unitOf(mgmtGradeId, mgmtUnitId);
    if (!g || !u) return;
    const name = prompt("重命名单元为：", u.name);
    const title = prompt("单元标题为（可留空）：", u.title || "");
    if (name && name.trim()) { u.name = name.trim(); }
    if (title !== null) u.title = title.trim();
    saveBank(); refreshAll(); toast("✅ 已更新单元");
  });
  $("#delUnitBtn")?.addEventListener("click", () => {
    const g = gradeOf(mgmtGradeId), u = unitOf(mgmtGradeId, mgmtUnitId);
    if (!g || !u) return;
    if (!confirm("删除单元「" + u.name + "」及其全部单词？")) return;
    g.units = g.units.filter((x) => x.id !== mgmtUnitId);
    mgmtUnitId = g.units.length ? g.units[0].id : "";
    selUnitId = mgmtUnitId; curUnitId = mgmtUnitId;
    carryUiSel();
    saveBank(); refreshAll(); toast("🗑️ 已删除单元");
  });

  /* ---------- 初始化 ---------- */
  renderUnitProgress();
  renderGradeTabs();
  renderUnitTabs();
  renderWordList();
  renderWb();
  renderBankMgmt();
  renderAiTarget();
  carryUiSel();
  refreshMemQueue();
  nextMemCard();
  showCard(0);
})();
