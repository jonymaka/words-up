/* ============================================================
   Words Up · AI 客户端（OpenAI 兼容 · 可直连服务商）
   - 配置：base_url + api_key + model 存 localStorage
   - 接口：POST {base_url}/chat/completions
   - 已验证：Agnes 2.5 Flash（api.agnes-ai.cn/v1, agnes-2.5-flash）
     CORS 允许 *（浏览器直连可用）；也兼容 DeepSeek/OpenAI/通义/智谱等
   - 错误分类：CORS 拦截 / 鉴权失败 / 模型不存在 / JSON 解析失败
   - 原则：AI 失败只提示、绝不污染词库、不影响学习功能
   ============================================================ */
(function (global) {
  "use strict";

  var CFG_KEY = "wup_ai_config";

  function defaultConfig() {
    return { baseUrl: "https://api.agnes-ai.cn/v1", apiKey: "", model: "agnes-2.5-flash" };
  }

  function loadConfig() {
    try {
      var raw = localStorage.getItem(CFG_KEY);
      if (!raw) return defaultConfig();
      return Object.assign(defaultConfig(), JSON.parse(raw));
    } catch (e) { return defaultConfig(); }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  function isConfigured() {
    var c = loadConfig();
    return !!(c.baseUrl && c.apiKey && c.model);
  }

  /* ---------- 错误类型 ---------- */
  function AiError(code, message, hint) {
    this.code = code;
    this.message = message;
    this.hint = hint || "";
  }
  AiError.prototype = Object.create(Error.prototype);
  AiError.prototype.constructor = AiError;

  function httpStatusText(status) {
    switch (status) {
      case 400: return "请求格式有误（400），请检查模型名是否正确";
      case 401: return "API Key 无效或未授权（401），请检查 Key 是否正确";
      case 403: return "没有访问权限（403），请检查 Key 权限或服务商限制";
      case 404: return "接口地址不存在（404），请检查 Base URL 是否完整";
      case 429: return "请求过于频繁或额度不足（429），请稍后重试或检查余额";
      case 500: case 502: case 503: return "服务商服务器异常（" + status + "），请稍后重试";
      default: return "请求失败（HTTP " + status + "）";
    }
  }

  /* ---------- 核心：chat 调用 ---------- */
  function chat(messages, opts) {
    opts = opts || {};
    var cfg = loadConfig();
    var base = String(cfg.baseUrl || "").replace(/\/+$/, "");
    var url = base + "/chat/completions";
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (cfg.apiKey || "")
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        temperature: opts.temperature != null ? opts.temperature : 0.3,
        max_tokens: opts.maxTokens != null ? opts.maxTokens : 800,
        stream: false
      })
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.json().catch(function () { return {}; }).then(function (j) {
          var detail = (j.error && (j.error.message || "")) || "";
          if (resp.status === 401 && /token|key|令牌|鉴权/i.test(detail)) {
            throw new AiError("auth", "API Key 无效（401）：" + detail, "请到设置页检查 API Key 是否正确。");
          }
          throw new AiError("http", httpStatusText(resp.status) + (detail ? "（" + detail + "）" : ""), "请检查 Base URL 与 API Key 配置。");
        });
      }
      return resp.json();
    }).then(function (data) {
      var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content || !content.trim()) throw new AiError("empty", "AI 返回内容为空，请重试");
      return String(content);
    });
  }

  /* ---------- 从文本中提取 JSON（容忍 markdown 包裹、前后杂文） ---------- */
  function extractJson(text) {
    if (!text) return null;
    var t = String(text).trim();
    var m = t.match(/[`]{3}(?:json)?\s*([\s\S]*?)[`]{3}/i);
    if (m) t = m[1].trim();
    var s = t.indexOf("{");
    var e = t.lastIndexOf("}");
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    try { return JSON.parse(t); } catch (err) { return null; }
  }

  /* ============ 1. 连接自检 ============ */
  function selfTest() {
    var cfg = loadConfig();
    if (!cfg.baseUrl) return Promise.reject(new AiError("noconf", "请先填写 Base URL"));
    if (!cfg.apiKey) return Promise.reject(new AiError("noconf", "请先填写 API Key"));
    var t0 = Date.now();
    return chat([{ role: "user", content: "只回复两个字：正常" }], { temperature: 0, maxTokens: 10 })
      .then(function (content) {
        return { ms: Date.now() - t0, model: cfg.model, reply: content.trim().slice(0, 24) };
      });
  }

  /* ============ 2. AI 词条自动生成 ============ */
  function generateWord(word) {
    var prompt = [
      "你是一名初中英语词汇专家。请为单词「" + word + "」生成中考词汇学习词条。",
      "要求：",
      "1. 只输出一个 JSON 对象，禁止输出任何其他文字或解释；",
      "2. 字段必须为：phonetic（音标，带斜杠，如 /frend/）、pos（词性缩写，如 n./v./adj./int.）、meaning（中文释义，1-3 个义项用“；”分隔）、example（一个简短地道的英文例句，适合初中生）、exampleCn（例句中文翻译）；",
      "3. example 控制在 12 个单词以内；",
      "4. JSON 必须合法，键名严格为：phonetic, pos, meaning, example, exampleCn。"
    ].join("\n");
    return chat([{ role: "user", content: prompt }], { temperature: 0.3, maxTokens: 600 })
      .then(function (content) {
        var obj = extractJson(content);
        if (!obj || typeof obj !== "object") {
          throw new AiError("parse", "AI 返回无法解析为词条 JSON", "返回内容：" + content.slice(0, 100) + "… 请点击「重新生成」重试。");
        }
        var keys = ["phonetic", "pos", "meaning", "example", "exampleCn"];
        var missing = keys.filter(function (k) { return !obj[k] || !String(obj[k]).trim(); });
        if (missing.length) {
          throw new AiError("parse", "AI 词条缺少字段：" + missing.join("、"), "请点击「重新生成」重试。");
        }
        return {
          word: word,
          phonetic: String(obj.phonetic).trim(),
          pos: String(obj.pos).trim(),
          meaning: String(obj.meaning).trim(),
          example: String(obj.example).trim(),
          exampleCn: String(obj.exampleCn).trim()
        };
      });
  }

  /* ============ 3. 答题智能解析 ============ */
  function explainMistake(qText, userAnswer, correctAnswer) {
    var prompt = [
      "你是初中英语老师。学生答错了以下题目，请用中文给出：错因分析 + 记忆方法。",
      "题目：" + qText,
      "学生答案：" + userAnswer,
      "正确答案：" + correctAnswer,
      "要求：总字数不超过 120 字，分两行：第一行以「错因：」开头，第二行以「记忆方法：」开头。"
    ].join("\n");
    return chat([{ role: "user", content: prompt }], { temperature: 0.4, maxTokens: 250 })
      .then(function (c) { return c.trim(); });
  }

  /* ============ 4. 学情分析报告 ============ */
  function generateReport(data) {
    var prompt = [
      "你是初中英语学习规划师。请根据以下学生数据生成中文学习报告（不超过 200 字）：",
      "数据：" + JSON.stringify(data),
      "输出格式：第一行以「总评：」开头给出总体评价；随后用「- 强项：」「- 薄弱点：」「- 建议：」各一行。"
    ].join("\n");
    return chat([{ role: "user", content: prompt }], { temperature: 0.4, maxTokens: 350 })
      .then(function (c) { return c.trim(); });
  }

  global.WordsAI = {
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    isConfigured: isConfigured,
    selfTest: selfTest,
    generateWord: generateWord,
    explainMistake: explainMistake,
    generateReport: generateReport,
    AiError: AiError
  };
})(window);
