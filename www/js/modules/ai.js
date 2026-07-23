(function() {
  'use strict';

  // ============================================================
// 配置说明
// ============================================================
// 安全策略：不内置任何 API Key / 代理地址，避免密钥泄露。
// 首次使用请在「设置」中填写你自己的阿里百炼 API Key，
// 并部署自己的 Cloudflare Worker 代理（或留空 Worker 走本地模型）。
// ============================================================

const DEFAULT_MODEL = 'qwen-turbo';

// 内置 Worker 地址：部署你自己的 serverless/cloudflare-workers/ai-proxy.js 后填入（例如 https://ai-proxy.xxx.workers.dev）。
// 仅放”你自己的” Worker 端点（不含任何密钥）；AI Key 由 Worker 服务端持有（环境变量 QWEN_API_KEY）。
// 留空则用户需自行在「设置」中填写；填入后即实现 AI / 推送”开箱即用”。
const DEFAULT_WORKER_URL = '';

// 自动初始化配置：确保有可用配置
function autoInitConfig() {
  try {
    let cfg = {};
    const saved = localStorage.getItem('ai_config');
    if (saved) {
      try { cfg = JSON.parse(saved); } catch(e){}
    }
    // App 内置云端配置（构建时由 Gradle 注入；纯 Web/PWA 环境为空对象）
    const builtin = (typeof window.__APP_CONFIG__ !== 'undefined' && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : {};
    // 补全缺省值；若内置提供了云端 Key / Worker，则一并注入（实现 App 内置 AI 零配置）
    const needsUpdate = !cfg.workerUrl || cfg.workerUrl.trim() === '' ||
                        !cfg.model || cfg.model.trim() === '' ||
                        (!cfg.apiKey || cfg.apiKey.trim() === '') && builtin.cloudAiKey;
    if (needsUpdate) {
      localStorage.setItem('ai_config', JSON.stringify({
        workerUrl: cfg.workerUrl || builtin.cloudAiUrl || DEFAULT_WORKER_URL,
        apiKey: cfg.apiKey || builtin.cloudAiKey || '',
        model: cfg.model || builtin.cloudAiModel || DEFAULT_MODEL
      }));
      console.log('[AI] 已补全默认配置' + (builtin.cloudAiKey ? '（含内置云端 Key）' : '（未注入密钥）'));
    }
  } catch (e) {
    console.warn('[AI] 自动初始化配置失败:', e);
  }
}
// 从 localStorage 读取配置
function getConfig() {
  try {
    const saved = localStorage.getItem('ai_config');
    if (saved) {
      const config = JSON.parse(saved);
      return {
        workerUrl: config.workerUrl || '',
        apiKey: config.apiKey || '',
        model: config.model || DEFAULT_MODEL
      };
    }
  } catch (e) {
    console.warn('[AI] 读取配置失败:', e);
  }
  // 兜底：localStorage 无配置时，使用 App 内置云端配置（如有）
  const builtin = (typeof window.__APP_CONFIG__ !== 'undefined' && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : {};
  return {
    workerUrl: builtin.cloudAiUrl || '',
    apiKey: builtin.cloudAiKey || '',
    model: builtin.cloudAiModel || DEFAULT_MODEL
  };
}

  function saveConfig(workerUrl, apiKey, model) {
    try {
      localStorage.setItem('ai_config', JSON.stringify({
        workerUrl: workerUrl || '',
        apiKey: apiKey || '',
        model: model || DEFAULT_MODEL
      }));
    } catch (e) {
      console.warn('[AI] 保存配置失败:', e);
    }
  }

  // 获取当前配置
  let currentConfig = getConfig();

  // 动态获取 Worker URL
  function getWorkerUrl() {
    currentConfig = getConfig();
    return currentConfig.workerUrl;
  }

  // 动态获取 API Key
  function getApiKey() {
    currentConfig = getConfig();
    return currentConfig.apiKey;
  }

  // ============================================================
  // MCP 工具调用（通过 Worker 代理）
  // ============================================================
  async function callWorkerMcp(route, action, params) {
    const workerUrl = getWorkerUrl();
    if (!workerUrl) return null;
    try {
      const response = await fetch(workerUrl.replace(/\/$/, '') + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params })
      });
      const data = await response.json();
      if (data.error) {
        console.warn('[AI MCP] 调用失败:', data.error);
        return null;
      }
      return data.data || data;
    } catch (e) {
      console.warn('[AI MCP] 请求异常:', e);
      return null;
    }
  }

  function callHowToCookMCP(action, params) {
    return callWorkerMcp('/mcp/howtocook', action, params);
  }

  function callKnowledgeMCP(action, params) {
    return callWorkerMcp('/mcp/knowledge', action, params);
  }

  function callStravaMCP(action, params) {
    return callWorkerMcp('/mcp/strava', action, params);
  }

  // 简单意图识别
  function detectHowToCookIntent(text) {
    const t = text.toLowerCase();
    const cookKeywords = ['菜', '菜谱', '食谱', '吃什么', '菜单', '做饭', '做饭', '晚餐', '午餐', '早餐', '一周菜谱', '推荐菜', ' dietary', 'recipe'];
    return cookKeywords.some(k => t.includes(k));
  }

  function detectKnowledgeIntent(text) {
    const t = text.toLowerCase();
    const healthKeywords = ['黄帝内经', '养生', '中医', '体质', '经络', '食疗', '节气', '阴阳', '脏腑', '睡眠', '失眠', '疲劳', '进补', '季节养生'];
    return healthKeywords.some(k => t.includes(k));
  }

  function detectStravaIntent(text) {
    const t = text.toLowerCase();
    const sportsKeywords = ['跑步', '骑行', '骑行', '游泳', '活动', '锻炼', '心率', '功率', '踏频', '海拔', '路段', '路线', 'gpx', 'tcx', '训练', 'strava'];
    return sportsKeywords.some(k => t.includes(k));
  }

  function extractCategory(text) {
    const categories = ['水产', '早餐', '荤菜', '素菜', '主食', '汤', '粥', '面食', '米饭'];
    for (const c of categories) if (text.includes(c)) return c;
    return '';
  }

  // AI 系统提示词（CREATE 框架优化版 v2.0）
  const SYSTEM_PROMPT = `【角色】
你是「养生小助手」AI 养生顾问，精通中医养生经典与现代健康科学，以「治未病」为核心理念，为用户提供实用、安全、有依据的养生建议。

你的说话风格：温和亲切、条理清晰、像一位经验丰富的养生师，不说空话套话，每条建议都具体可操作。

---

【核心原则 · 必须遵守】
1. 安全第一：不提供医疗诊断，不开处方药物，涉及疾病问题务必建议就医
2. 言必有据：每条养生建议至少标注一个引用出处（典籍或著作名称）
3. 实用至上：建议要具体到「做什么、做多久、什么时候做」，不泛泛而谈
4. 因人而异：结合体质、季节、时段给出差异化建议
5. 简洁高效：回答控制在 200 字以内，重点突出

---

【知识范围】
精通 9 部中医古籍与 15 部现代养生著作，涵盖：
- 中医基础：阴阳五行、脏腑经络、九种体质、二十四节气
- 生活方式：饮食营养、运动健身、睡眠调理、情志调养
- 道家养生：导引吐纳、形神兼养、不伤为本
- 现代科学：运动生理、营养科学、睡眠医学、正念冥想、肠道健康

主要典籍：《黄帝内经》《遵生八笺》《老老恒言》《饮膳正要》《养生论》《寿世青编》《备急千金要方·养性》《抱朴子》《闲情偶寄》
现代著作：《你是你吃出来的》《九种体质养生全书》《科学休息》《求医不如求己》《拉伸》《人体运动生理学》《高级运动营养学》《力量训练基础》《运动医学与康复》《睡眠革命》《运动改造大脑》《正念的奇迹》《抗炎生活》《肠子的小心思》《深度营养》

---

【能力边界 · 明确不能做的事】
- 不诊断疾病、不开药方、不替代专业医疗建议
- 不推荐具体药物、保健品品牌
- 对严重症状（持续疼痛、高烧、呼吸困难等）立即建议就医
- 不确定的知识坦诚说明，不编造理论或引用
- 不讨论与养生健康无关的话题

---

【回答格式】
按以下结构组织回答（用简短的小标题，不用 Markdown 标记）：

1. 核心建议（1-2 句点明主旨）
2. 具体方法（分点列出 2-3 条可操作建议）
3. 引用出处（标注参考的典籍或著作）

如果问题涉及疾病风险，在末尾加一行：⚠️ 以上建议仅供参考，症状持续请及时就医。

---

【输出前自检清单】
回答前请逐条检查，不满足的立即修正：
□ 是否给出了具体可操作的建议（不是空话）
□ 是否标注了至少一个引用出处
□ 字数是否控制在 200 字以内
□ 涉及健康风险是否有免责提醒
□ 是否超出了能力边界（如涉及医疗诊断）

---

【MCP 工具使用规则】
如果上下文提供了工具检索结果，请按以下规则使用：

1. HowToCook 菜谱数据：用户问饮食/菜谱时优先结合，推荐具体菜品和做法
2. 养生知识库检索结果：作为权威引用来源，优先使用检索到的内容
3. Strava 运动数据：结合用户实际运动数据给出个性化建议，如运动强度调整、恢复建议

工具结果是补充，不是全部。结合你的专业知识整合输出，不要原样堆砌工具返回的数据。如果没有提供工具结果，按你的知识正常回答，不要编造。

---

【最后提醒】
记住：你是养生顾问，不是医生。安全永远是第一位的。用你的专业知识帮助用户建立健康的生活习惯，这才是「治未病」的真谛。`;

  // MCP 上下文提示词（动态插入）
  function buildMcpContextPrompt(howtocookResult, knowledgeResult, stravaResult) {
    let parts = [];
    if (howtocookResult) {
      parts.push('【HowToCook 菜谱参考】\n' + JSON.stringify(howtocookResult).slice(0, 1200));
    }
    if (knowledgeResult) {
      parts.push('【养生知识库参考】\n' + JSON.stringify(knowledgeResult).slice(0, 1200));
    }
    if (stravaResult) {
      parts.push('【Strava 运动数据】\n' + JSON.stringify(stravaResult).slice(0, 1500));
    }
    return parts.join('\n\n');
  }

  // 配置参数
  const MAX_INPUT_LENGTH = 500;      // 最大输入长度
  const MAX_HISTORY_ROUNDS = 10;     // 对话历史保留轮数（1轮=用户+AI各1条）
  const MAX_HISTORY = MAX_HISTORY_ROUNDS * 2; // 消息条数（每轮2条）
  const MAX_TOKENS = 500;           // AI 回复最大 token 数
  const TEMPERATURE = 0.7;          // 创造性参数
  const MAX_RETRIES = 1;            // 网络错误自动重试次数
  const TYPING_SPEED = 15;          // 打字机效果速度（毫秒/字符）

  // 可用模型列表
  const MODEL_OPTIONS = [
    { value: 'qwen-turbo', label: 'qwen-turbo（轻量快速）' },
    { value: 'qwen-plus', label: 'qwen-plus（标准推荐）' },
    { value: 'qwen-max', label: 'qwen-max（最强智能）' },
    { value: 'qwen-coder-plus', label: 'qwen-coder-plus（编程专用）' },
    { value: 'deepseek-v3', label: 'deepseek-v3（深度推理）' },
    { value: 'deepseek-r1', label: 'deepseek-r1（推理增强）' },
    { value: 'local', label: '📱 本地模型（离线运行）' }
  ];

  // 本地模型配置
  const LOCAL_MODEL_CONFIG = {
    modelPath: '/data/data/com.rui66648.lifestyle/files/model.gguf',
    maxTokens: 512,
    temperature: 0.7
  };

  // 检测本地模型插件是否可用
  function isLocalModelAvailable() {
    try {
      return typeof Capacitor !== 'undefined' &&
        Capacitor.Plugins &&
        Capacitor.Plugins.LocalModel;
    } catch (e) { return false; }
  }

  // 本地模型调用
  async function callLocalModel(messages) {
    if (!isLocalModelAvailable()) {
      throw new Error('本地模型插件未安装，请在设置中切换到云端模型');
    }
    try {
      const result = await Capacitor.Plugins.LocalModel.chat({
        messages: messages,
        maxTokens: LOCAL_MODEL_CONFIG.maxTokens,
        temperature: LOCAL_MODEL_CONFIG.temperature
      });
      return result.response || '本地模型未返回内容';
    } catch (e) {
      throw new Error('本地模型调用失败: ' + (e.message || e));
    }
  }

  // 状态
  let aiChatHistory = [];
  let isLoading = false;
  let abortController = null;

  // ============================================================
  // API 用量监控
  // ============================================================
  const USAGE_KEY = 'ai_usage_stats';
  const USAGE_WARN_THRESHOLD = 50; // 每日提醒阈值（次）

  function loadUsageStats() {
    try {
      const saved = localStorage.getItem(USAGE_KEY);
      if (saved) {
        const stats = JSON.parse(saved);
        const today = new Date().toDateString();
        if (stats.date !== today) {
          return { date: today, count: 0, totalTokens: 0 };
        }
        return stats;
      }
    } catch (e) {}
    return { date: new Date().toDateString(), count: 0, totalTokens: 0 };
  }

  function saveUsageStats(stats) {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function recordApiUsage(tokens = 0) {
    const stats = loadUsageStats();
    stats.count++;
    stats.totalTokens += tokens;
    saveUsageStats(stats);
    return stats;
  }

  function checkUsageWarning() {
    const stats = loadUsageStats();
    if (stats.count >= USAGE_WARN_THRESHOLD && stats.count % USAGE_WARN_THRESHOLD === 0) {
      return `今日已使用 ${stats.count} 次 AI 对话，请注意用量。`;
    }
    return null;
  }

  // ============================================================
  // 内容安全过滤
  // ============================================================
  const UNSAFE_KEYWORDS = [
    '处方', '开药', '剂量', 'mg', '毫克', '注射',
    '诊断', '治疗方案', '手术', '化疗', '放疗',
    '自杀', '自残', '毒品', '违禁'
  ];

  function filterUnsafeContent(text) {
    let filtered = text;
    for (const kw of UNSAFE_KEYWORDS) {
      const regex = new RegExp(kw, 'gi');
      filtered = filtered.replace(regex, '***');
    }
    return filtered;
  }

  function hasUnsafeUserInput(text) {
    const lower = text.toLowerCase();
    const highRisk = ['自杀', '自残', '毒品'];
    return highRisk.some(k => lower.includes(k));
  }

  // ============================================================
  // 存储管理
  // ============================================================
  const STORAGE_KEY = 'ai_chat_history';

  function loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        aiChatHistory = JSON.parse(saved);
        if (!Array.isArray(aiChatHistory)) {
          aiChatHistory = [];
        }
      }
    } catch (e) {
      console.warn('[AI] 加载历史记录失败:', e);
      aiChatHistory = [];
    }
  }

  function saveHistory() {
    try {
      // 只保存最近的消息，避免 localStorage 溢出
      const toSave = aiChatHistory.slice(-MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[AI] 保存历史记录失败:', e);
    }
  }

  function clearHistory() {
    aiChatHistory = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // ============================================================
  // 验证配置
  // ============================================================
  function isConfigured() {
    const cfg = getConfig();
    // Worker 代理模式只需 workerUrl 即可（密钥在服务端），无需客户端 apiKey
    return (cfg.workerUrl && cfg.workerUrl.trim() !== '') || (cfg.apiKey && cfg.apiKey.trim() !== '');
  }

  function isUsingWorker() {
    const cfg = getConfig();
    return cfg.workerUrl.trim() !== '';
  }

  // ============================================================
  // UI 渲染（使用 textContent 防止 XSS）
  // ============================================================
  function renderAiPage() {
    const inputBar = document.querySelector('.ai-input-bar');
    const unconfiguredArea = document.getElementById('aiUnconfigured');
    const msgContainer = document.getElementById('aiChatMessages');

    // 检查配置状态
    if (!isConfigured()) {
      if (inputBar) inputBar.style.display = 'none';
      if (unconfiguredArea) unconfiguredArea.style.display = 'flex';
      if (msgContainer) msgContainer.innerHTML = '';
    } else {
      if (inputBar) inputBar.style.display = 'flex';
      if (unconfiguredArea) unconfiguredArea.style.display = 'none';
    }

    // 渲染历史消息或欢迎语
    if (msgContainer) {
      msgContainer.innerHTML = '';

      if (aiChatHistory.length === 0) {
        // 添加日期分隔线
        renderDateDivider();
        // 欢迎语（带特殊样式）
        renderAiMessage('ai', '你好！我是你的 AI 养生顾问 🌿\n\n以「治未病」为核心理念，精通24部中医经典与现代养生著作，为你提供实用、安全的养生建议。\n\n试试问我这些问题：\n• 失眠怎么调理？\n• 夏天吃什么好？\n• 久坐族怎么养生？\n• 气虚体质怎么补？', true);
      } else {
        // 渲染历史消息
        renderDateDivider();
        aiChatHistory.forEach(msg => {
          renderAiMessage(msg.role === 'user' ? 'user' : 'ai', msg.content, false);
        });
      }
    }

    // 聚焦输入框
    setTimeout(() => {
      const input = document.getElementById('aiChatInput');
      if (input) input.focus();
    }, 300);
  }

  // 日期分隔线
  function renderDateDivider() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'ai-divider';
    const now = new Date();
    const hours = now.getHours();
    let timeStr = '今天 ';
    if (hours < 6) timeStr += '凌晨';
    else if (hours < 12) timeStr += '上午';
    else if (hours < 14) timeStr += '中午';
    else if (hours < 18) timeStr += '下午';
    else timeStr += '晚上';
    div.innerHTML = '<span>' + timeStr + '</span>';
    container.appendChild(div);
  }

  function renderAiMessage(role, text, isWelcome = false) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return null;

    const div = document.createElement('div');
    div.className = 'ai-msg ' + role + (isWelcome ? ' welcome-msg' : '');

    const avatar = role === 'ai' ? '🤖' : '👤';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = avatar;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    bubbleEl.textContent = text;

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);

    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);

    return { div, bubbleEl };
  }

  function updateAiBubble(bubbleEl, text, isStreaming = false) {
    if (!bubbleEl) return;
    bubbleEl.textContent = text;
    if (isStreaming) {
      bubbleEl.classList.add('typing');
    } else {
      bubbleEl.classList.remove('typing');
    }
    const container = document.getElementById('aiChatMessages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function renderAiError(text) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'ai-msg ai ai-error';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = '🤖';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    bubbleEl.textContent = '⚠️ ' + text;

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function renderAiLoading() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.id = 'aiLoading';
    div.className = 'ai-msg ai';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = '🤖';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    bubbleEl.innerHTML = '<div class="ai-loading"><span></span><span></span><span></span></div>';

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeAiLoading() {
    const el = document.getElementById('aiLoading');
    if (el) el.remove();
  }

  // ============================================================
  // SSE 流式响应解析
  // ============================================================
  async function parseSSEStream(reader, onChunk, onDone, onError) {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            onDone && onDone();
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices && data.choices[0] &&
              (data.choices[0].delta && data.choices[0].delta.content ||
               data.choices[0].message && data.choices[0].message.content);
            if (content) {
              onChunk && onChunk(content);
            }
          } catch (e) {
          }
        }
      }

      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr !== '[DONE]') {
            try {
              const data = JSON.parse(dataStr);
              const content = data.choices && data.choices[0] &&
                (data.choices[0].delta && data.choices[0].delta.content ||
                 data.choices[0].message && data.choices[0].message.content);
              if (content) {
                onChunk && onChunk(content);
              }
            } catch (e) {}
          }
        }
      }

      onDone && onDone();
    } catch (err) {
      onError && onError(err);
    }
  }

  // ============================================================
  // 打字机效果
  // ============================================================
  function typewriterEffect(bubbleEl, fullText, speed = TYPING_SPEED) {
    return new Promise((resolve) => {
      let index = 0;
      const totalLen = fullText.length;

      function typeNext() {
        if (index < totalLen) {
          const chunkSize = Math.min(3, totalLen - index);
          index += chunkSize;
          updateAiBubble(bubbleEl, fullText.slice(0, index), true);
          setTimeout(typeNext, speed);
        } else {
          updateAiBubble(bubbleEl, fullText, false);
          resolve();
        }
      }

      typeNext();
    });
  }

  // ============================================================
  // 滑动窗口：截断对话上下文（保留最近 N 轮）
  // ============================================================
  function trimConversationHistory(history) {
    if (history.length <= MAX_HISTORY) return history;
    return history.slice(-MAX_HISTORY);
  }

  // ============================================================
  // 发送消息
  // ============================================================
  async function sendAiMessage() {
    if (!isConfigured()) {
      return;
    }

    if (isLoading) {
      return;
    }

    const input = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiSendBtn');
    if (!input) return;

    let text = input.value.trim();

    if (text.length === 0) {
      return;
    }

    if (text.length > MAX_INPUT_LENGTH) {
      renderAiError('输入太长了，请控制在 ' + MAX_INPUT_LENGTH + ' 字以内。');
      return;
    }

    if (hasUnsafeUserInput(text)) {
      renderAiError('您的问题涉及敏感内容，请调整后再试。如有紧急情况，请立即寻求专业帮助。');
      return;
    }

    input.value = '';
    isLoading = true;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn._originalHTML = sendBtn.innerHTML;
      sendBtn.innerHTML = '⏳';
    }

    renderAiMessage('user', text);
    aiChatHistory.push({ role: 'user', content: text, timestamp: Date.now() });

    const usageWarn = checkUsageWarning();

    renderAiLoading();

    let reply = '';
    let aiBubbleEl = null;
    let retryCount = 0;

    try {
      const model = currentConfig.model || DEFAULT_MODEL;

      let mcpContext = '';
      if (isUsingWorker()) {
        const [howtocookResult, knowledgeResult, stravaResult] = await Promise.all([
          detectHowToCookIntent(text)
            ? callHowToCookMCP(extractCategory(text) ? 'search' : 'today', {
                category: extractCategory(text),
                peopleCount: 2
              })
            : Promise.resolve(null),
          detectKnowledgeIntent(text)
            ? callKnowledgeMCP('search', { query: text, limit: 3 })
            : Promise.resolve(null),
          detectStravaIntent(text)
            ? callStravaMCP('recent-activities', { perPage: 5 })
            : Promise.resolve(null)
        ]);
        mcpContext = buildMcpContextPrompt(howtocookResult, knowledgeResult, stravaResult);
      }

      // 体质+季节+打卡数据联动注入（v2.2 增强）
      const constitution = JSON.parse(localStorage.getItem('constitution_result') || 'null');
      const ctype = constitution && window.App && App.Data && App.Data.CONSTITUTION_TYPES
        ? App.Data.CONSTITUTION_TYPES.find(c => c.id === constitution.typeId) : null;
      const solarTerm = (typeof getCurrentSolarTerm === 'function') ? getCurrentSolarTerm() : null;
      const season = (typeof getCurrentSeason === 'function') ? getCurrentSeason() : null;
      const seasonPack = (typeof getSeasonPack === 'function') ? getSeasonPack(season) : null;

      // 打卡数据统计
      let streak = 0, totalCheckins = 0, todayDone = 0, todayTotal = 0, levelName = '新手';
      if (typeof getCurrentStreak === 'function') streak = getCurrentStreak();
      if (typeof getTotalCheckins === 'function') totalCheckins = getTotalCheckins();
      if (typeof getTodayDone === 'function') todayDone = getTodayDone();
      if (typeof getTodayTotal === 'function') todayTotal = getTodayTotal();
      if (typeof getCurrentLevel === 'function') {
        const lv = getCurrentLevel();
        levelName = lv.name;
      }

      // 最近7天打卡趋势
      let weeklyTrend = [];
      try {
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
          const rec = (typeof checkinRecords !== 'undefined' && checkinRecords[key]) || {};
          let done = 0, total = 0;
          if (typeof habitsConfig !== 'undefined' && Array.isArray(habitsConfig)) {
            habitsConfig.forEach(h => {
              if (h.enabled === false) return;
              total++;
              if (App.Core.Storage && App.Core.Storage.isHabitChecked && App.Core.Storage.isHabitChecked(h, rec)) done++;
            });
          }
          weeklyTrend.push({ date: key, done, total, rate: total > 0 ? Math.round((done/total)*100) : 0 });
        }
      } catch(e) {}

      // 习惯分类统计
      let habitCategories = {};
      try {
        if (typeof habitsConfig !== 'undefined' && Array.isArray(habitsConfig)) {
          habitsConfig.forEach(h => {
            if (h.enabled === false) return;
            const cat = h.category || '其他';
            habitCategories[cat] = (habitCategories[cat] || 0) + 1;
          });
        }
      } catch(e) {}

      let userContext = '';
      if (ctype || solarTerm || season || streak > 0 || totalCheckins > 0) {
        userContext = '\n\n【用户上下文 · 必须融入建议】\n';
        
        // 体质信息
        if (ctype) {
          userContext += '体质：' + ctype.name + '（' + ctype.desc + '）\n';
          userContext += '体质特征：' + ctype.features + '\n';
          userContext += '调理方向：' + ctype.advice + '\n';
          if (ctype.foods) userContext += '宜食食物：' + ctype.foods + '\n';
          if (ctype.avoid) userContext += '忌食食物：' + ctype.avoid + '\n';
        }
        
        // 季节节气
        if (seasonPack) userContext += '季节：' + seasonPack.name + seasonPack.emoji + ' · ' + seasonPack.focus + '\n';
        if (solarTerm) userContext += '当前节气：' + solarTerm.emoji + solarTerm.name + (solarTerm.tip ? ' · ' + solarTerm.tip : '') + '\n';
        
        // 打卡数据
        userContext += '养生等级：' + levelName + '\n';
        userContext += '连续打卡：' + streak + '天\n';
        userContext += '累计打卡：' + totalCheckins + '次\n';
        userContext += '今日进度：' + todayDone + '/' + todayTotal + '（' + (todayTotal > 0 ? Math.round((todayDone/todayTotal)*100) : 0) + '%）\n';
        
        // 习惯分类
        if (Object.keys(habitCategories).length > 0) {
          userContext += '习惯分类：';
          Object.keys(habitCategories).forEach(cat => {
            userContext += cat + '(' + habitCategories[cat] + ')、';
          });
          userContext = userContext.slice(0, -1) + '\n';
        }
        
        // 周趋势（如果有数据）
        if (weeklyTrend.length === 7) {
          const avgRate = Math.round(weeklyTrend.reduce((sum, d) => sum + d.rate, 0) / 7);
          const bestDay = weeklyTrend.reduce((best, d) => d.rate > best.rate ? d : best, weeklyTrend[0]);
          const worstDay = weeklyTrend.reduce((worst, d) => d.rate < worst.rate ? d : worst, weeklyTrend[0]);
          userContext += '本周平均完成率：' + avgRate + '%\n';
          userContext += '最佳：' + bestDay.date + '（' + bestDay.rate + '%）\n';
          if (worstDay.rate < 100) userContext += '需加油：' + worstDay.date + '（' + worstDay.rate + '%）\n';
        }
        
        userContext += '\n请基于以上用户上下文给出针对性建议，结合用户的体质特点、当前季节养生要点和打卡数据，给出个性化的养生指导。';
      }
      const systemContent = SYSTEM_PROMPT + userContext + (mcpContext ? '\n\n' + mcpContext : '');

      const trimmedHistory = trimConversationHistory(aiChatHistory);
      const messagesForApi = [
        { role: 'system', content: systemContent },
        ...trimmedHistory.map(m => ({ role: m.role, content: m.content }))
      ];

      const executeRequest = async () => {
        if (model === 'local') {
          const result = await callLocalModel(messagesForApi);
          return { text: result, streamed: false };
        } else if (isUsingWorker()) {
          const workerUrl = getWorkerUrl();
          abortController = new AbortController();

          const response = await fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              max_tokens: MAX_TOKENS,
              temperature: TEMPERATURE,
              stream: true
            }),
            signal: abortController.signal
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const errMsg = data.error ? (typeof data.error === 'string' ? data.error : (data.error.message || data.error)) : '请求失败';
            const error = new Error(errMsg || 'AI 服务返回错误');
            error.status = response.status;
            throw error;
          }

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/event-stream') && response.body) {
            const reader = response.body.getReader();
            let fullText = '';

            removeAiLoading();
            const rendered = renderAiMessage('ai', '');
            aiBubbleEl = rendered.bubbleEl;
            updateAiBubble(aiBubbleEl, '', true);

            await new Promise((resolve, reject) => {
              parseSSEStream(
                reader,
                (chunk) => {
                  fullText += chunk;
                  updateAiBubble(aiBubbleEl, fullText, true);
                },
                () => resolve(),
                (err) => reject(err)
              );
            });

            return { text: fullText, streamed: true };
          } else {
            const data = await response.json();
            if (data.error) {
              const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || data.error);
              throw new Error(errMsg || 'AI 服务返回错误');
            }
            const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (!content) throw new Error('AI 没有返回有效回答');
            return { text: content, streamed: false };
          }
        } else {
          const apiKey = getApiKey();
          abortController = new AbortController();

          const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              max_tokens: MAX_TOKENS,
              temperature: TEMPERATURE,
              stream: true
            }),
            signal: abortController.signal
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const errMsg = data.error ? data.error.message || 'API 错误' : '请求失败';
            const error = new Error(errMsg);
            error.status = response.status;
            throw error;
          }

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/event-stream') && response.body) {
            const reader = response.body.getReader();
            let fullText = '';

            removeAiLoading();
            const rendered = renderAiMessage('ai', '');
            aiBubbleEl = rendered.bubbleEl;
            updateAiBubble(aiBubbleEl, '', true);

            await new Promise((resolve, reject) => {
              parseSSEStream(
                reader,
                (chunk) => {
                  fullText += chunk;
                  updateAiBubble(aiBubbleEl, fullText, true);
                },
                () => resolve(),
                (err) => reject(err)
              );
            });

            return { text: fullText, streamed: true };
          } else {
            const data = await response.json();
            if (data.error) throw new Error(data.error.message || 'API 错误');
            const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (!content) throw new Error('AI 没有返回有效回答');
            return { text: content, streamed: false };
          }
        }
      };

      while (retryCount <= MAX_RETRIES) {
        try {
          const result = await executeRequest();
          reply = result.text;

          if (!result.streamed) {
            removeAiLoading();
            const filteredReply = filterUnsafeContent(reply);
            const rendered = renderAiMessage('ai', '');
            aiBubbleEl = rendered.bubbleEl;
            await typewriterEffect(aiBubbleEl, filteredReply);
            reply = filteredReply;
          } else {
            const filteredReply = filterUnsafeContent(reply);
            if (filteredReply !== reply) {
              updateAiBubble(aiBubbleEl, filteredReply, false);
              reply = filteredReply;
            } else {
              updateAiBubble(aiBubbleEl, reply, false);
            }
          }

          break;
        } catch (err) {
          if (retryCount < MAX_RETRIES &&
              (err.message.includes('Failed to fetch') ||
               err.message.includes('NetworkError') ||
               err.message.includes('网络请求失败') ||
               (err.status && err.status >= 500))) {
            retryCount++;
            console.warn('[AI] 第 ' + retryCount + ' 次重试...');
            await new Promise(r => setTimeout(r, 1000 * retryCount));
            continue;
          }
          throw err;
        }
      }

      aiChatHistory.push({ role: 'assistant', content: reply, timestamp: Date.now() });
      saveHistory();

      recordApiUsage(Math.round(reply.length / 2));

      if (usageWarn) {
        setTimeout(() => {
          renderAiError(usageWarn);
        }, 500);
      }

    } catch (err) {
      removeAiLoading();
      if (aiBubbleEl) {
        aiBubbleEl.parentElement && aiBubbleEl.parentElement.remove();
      }
      console.error('[AI] 请求失败:', err);

      let errorMsg = '网络错误，请检查网络连接。';
      let showConfigButton = false;

      if (err.name === 'AbortError') {
        errorMsg = '请求已取消。';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('网络请求失败')) {
        errorMsg = '网络连接失败，请检查网络后重试。';
      } else if (err.message.includes('429') || err.status === 429) {
        errorMsg = '请求太频繁，请稍后再试。';
      } else if (err.message.includes('401') || err.message.includes('403') || err.status === 401 || err.status === 403) {
        errorMsg = 'API 认证失败，请检查配置或前往设置重新配置。';
        showConfigButton = true;
      } else if (err.message.includes('500') || (err.status && err.status >= 500)) {
        errorMsg = 'AI 服务暂时不可用，请稍后再试。';
      } else if (err.message) {
        errorMsg = err.message;
      }

      renderAiError(errorMsg);

      if (showConfigButton) {
        setTimeout(() => {
          const container = document.getElementById('aiChatMessages');
          if (container) {
            const btnDiv = document.createElement('div');
            btnDiv.style.textAlign = 'center';
            btnDiv.style.padding = '8px 0';
            btnDiv.innerHTML = '<button class="const-btn" onclick="closeAllPanels();openSettingsPanel()">前往设置</button>';
            container.appendChild(btnDiv);
            container.scrollTop = container.scrollHeight;
          }
        }, 100);
      }
    } finally {
      isLoading = false;
      abortController = null;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = sendBtn._originalHTML || '➤';
      }
      if (input) input.focus();
    }
  }

  // ============================================================
  // 清空对话
  // ============================================================
  function clearAiChat() {
    if (confirm('确定要清空所有对话记录吗？')) {
      clearHistory();
      const msgContainer = document.getElementById('aiChatMessages');
      if (msgContainer) {
        msgContainer.innerHTML = '';
        renderDateDivider();
        renderAiMessage('ai', '对话记录已清空，有任何养生问题都可以问我！', true);
      }
    }
  }

  // ============================================================
  // 保存用户配置
  // ============================================================
  function saveAiConfig() {
    const workerUrl = document.getElementById('configWorkerUrl');
    const apiKey = document.getElementById('configApiKey');
    const modelEl = document.getElementById('configModel');

    const url = workerUrl ? workerUrl.value.trim() : '';
    const key = apiKey ? apiKey.value.trim() : '';
    const model = modelEl ? modelEl.value : DEFAULT_MODEL;

    if (!key) {
      alert('请填写 API Key');
      return;
    }

    saveConfig(url, key, model);
    currentConfig = getConfig();

    // 更新设置面板状态
    const statusEl = document.getElementById('settingsAiStatus');
    if (statusEl) {
      statusEl.textContent = '✅ 已配置 · API Key: ****' + key.slice(-4);
      statusEl.style.color = 'var(--accent)';
    }
    updateProfileAiStatus();

    alert('配置已保存！AI 养生顾问已就绪。');
  }

  // ============================================================
  // 更新"我的"页面设置入口状态
  // ============================================================
  function updateProfileAiStatus() {
    const cfg = getConfig();
    const el = document.getElementById('profileAiStatus');
    if (!el) return;
    if (cfg.apiKey) {
      el.textContent = '✨ AI 已配置';
      el.style.color = 'var(--accent)';
    } else {
      el.textContent = '🤖 AI 未配置';
      el.style.color = 'var(--muted)';
    }
  }

  // ============================================================
  // 设置面板
  // ============================================================
  function openSettingsPanel() {
    // 回填已保存的配置
    const cfg = getConfig();
    const workerEl = document.getElementById('configWorkerUrl');
    const apiKeyEl = document.getElementById('configApiKey');
    const modelEl = document.getElementById('configModel');
    if (workerEl) workerEl.value = cfg.workerUrl || '';
    if (apiKeyEl) apiKeyEl.value = cfg.apiKey || '';
    if (modelEl) modelEl.value = cfg.model || DEFAULT_MODEL;

    // 同步提醒方式
    if (typeof habitsConfig !== 'undefined' && habitsConfig.length > 0) {
      const firstHabit = habitsConfig[0];
      const method = (firstHabit.reminder && firstHabit.reminder.method) ? firstHabit.reminder.method : 'in-app';
      if (window.updateReminderSegment) updateReminderSegment(method);
    }

    // 更新 AI 配置摘要
    const summaryEl = document.getElementById('settingsAiSummary');
    if (summaryEl) {
      if (cfg.apiKey) {
        const modelLabel = MODEL_OPTIONS.find(m => m.value === (cfg.model || DEFAULT_MODEL));
        summaryEl.textContent = '已配置 · ' + (modelLabel ? modelLabel.label : cfg.model);
      } else {
        summaryEl.textContent = '未配置';
      }
    }

    // 显示配置状态
    const statusEl = document.getElementById('settingsAiStatus');
    if (statusEl) {
      if (cfg.apiKey) {
        const modelLabel = MODEL_OPTIONS.find(m => m.value === (cfg.model || DEFAULT_MODEL));
        statusEl.textContent = '✅ 已配置 · ' + (modelLabel ? modelLabel.label : cfg.model) + ' · API Key: ****' + cfg.apiKey.slice(-4);
        statusEl.style.color = 'var(--accent)';
      } else {
        statusEl.textContent = '⚠️ 尚未配置 API Key';
        statusEl.style.color = 'var(--muted)';
      }
    }

    // 同步免打扰设置 UI
    if (typeof updateQuietHoursUI === 'function') updateQuietHoursUI();

    // 更新账号区域（APK 环境）
    if (typeof window.updateAccountUI === 'function') window.updateAccountUI();

    // 更新自动打卡区域（APK 环境）
    if (typeof window.updateAutoCheckinUI === 'function') window.updateAutoCheckinUI();

    openPanel('settingsPanel');
  }

  function openAiConfigPanel() {
    // 回填配置到二级页面
    const cfg = getConfig();
    const workerEl = document.getElementById('configWorkerUrl');
    const apiKeyEl = document.getElementById('configApiKey');
    const modelEl = document.getElementById('configModel');
    if (workerEl) workerEl.value = cfg.workerUrl || '';
    if (apiKeyEl) apiKeyEl.value = cfg.apiKey || '';
    if (modelEl) modelEl.value = cfg.model || DEFAULT_MODEL;

    openPanel('aiConfigPanel');
  }

  // ============================================================
  // AI 成长闭环：周报分析引擎
  // ============================================================
  const ANALYSIS_SYSTEM_PROMPT = `你是一位专业的习惯养成教练，擅长从数据中发现行为模式并给出实用建议。

【核心原则】
1. 语气温和，用"我们发现..."代替"你应该..."
2. 洞察要有数据支撑，不说空话
3. 建议要可执行，具体到"做什么、什么时候做、做多久"
4. 优先推荐"调整现有习惯"而非"新增习惯"
5. 周报最多2条建议，宁缺毋滥

【输出格式】
必须返回纯JSON格式，不要包含markdown代码块标记：

{
  "summary": {
    "overallRate": 72,
    "trend": "up|down|stable",
    "trendText": "比上周提升8% 👍",
    "bestHabit": {"id": "habit_id", "name": "习惯名称", "streak": 21},
    "weakestHabit": {"id": "habit_id", "name": "习惯名称", "rate": 40}
  },
  "insights": [
    {
      "id": "ins_001",
      "type": "correlation|milestone|warning|encouragement",
      "icon": "emoji",
      "title": "一句话洞察",
      "description": "详细说明（含数据支撑）",
      "confidence": 0.87,
      "dataSource": ["数据来源1", "数据来源2"]
    }
  ],
  "suggestions": [
    {
      "id": "sug_001",
      "insightId": "ins_001",
      "type": "adjust_existing|new_habit",
      "title": "建议标题",
      "description": "为什么给这个建议",
      "action": "adjust_habit|create_habit",
      "targetHabitId": "string|null",
      "adjustment": {"name": "新名称", "timePeriod": "noon", "reminderTime": "12:30"} | null,
      "newHabit": {
        "name": "习惯名称",
        "icon": "📋",
        "category": "sport|diet|study|sleep|mind|protect|care|home|social",
        "frequency": "daily",
        "timePeriod": "morning|noon|evening|night",
        "reminderTime": "07:00",
        "type": "boolean|number|time|water",
        "tip": "提示文字",
        "linkedData": ["data_source1", "data_source2"]
      } | null,
      "confidence": 0.82,
      "expectedImpact": "预期效果描述"
    }
  ]
}`;

  async function analyzeWeeklyData(weeklyData, onProgress) {
    if (!isConfigured()) {
      return generateFallbackAnalysis(weeklyData);
    }

    try {
      onProgress && onProgress('正在分析本周数据...');

      const promptData = {
        period: weeklyData.periodLabel,
        dateRange: weeklyData.startDate + ' ~ ' + weeklyData.endDate,
        summary: weeklyData.summary,
        userContext: weeklyData.userContext,
        bestHabit: weeklyData.bestHabit,
        weakestHabit: weeklyData.weakestHabit,
        highFailDay: weeklyData.highFailDay,
        categoryStats: weeklyData.categoryStats,
        waterStats: weeklyData.waterStats,
        emotionDist: weeklyData.emotionDist
      };

      const userPrompt = JSON.stringify(promptData, null, 2);

      const messages = [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ];

      onProgress && onProgress('AI正在生成建议...');

      const response = await callAiApi(messages);

      onProgress && onProgress('整理分析结果...');

      return parseAnalysisResponse(response);
    } catch (err) {
      console.error('[AI Growth] 分析失败:', err);
      return generateFallbackAnalysis(weeklyData);
    }
  }

  async function callAiApi(messages) {
    const cfg = getConfig();
    const model = cfg.model || DEFAULT_MODEL;

    if (model === 'local') {
      return await callLocalModel(messages);
    }

    const workerUrl = getWorkerUrl();
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error('AI服务返回错误: ' + response.status);
    }

    const data = await response.json();
    return data.choices && data.choices[0] &&
      (data.choices[0].message && data.choices[0].message.content ||
       data.choices[0].text) || '';
  }

  function parseAnalysisResponse(response) {
    try {
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const result = JSON.parse(jsonStr);
      return validateAnalysisResult(result);
    } catch (e) {
      console.warn('[AI Growth] JSON解析失败，使用fallback:', e);
      return null;
    }
  }

  function validateAnalysisResult(result) {
    if (!result || typeof result !== 'object') return null;

    const validResult = {
      summary: result.summary || {},
      insights: Array.isArray(result.insights) ? result.insights : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 2) : []
    };

    validResult.suggestions.forEach((sug, idx) => {
      if (!sug.id) sug.id = 'sug_' + Date.now() + '_' + idx;
      if (!sug.insightId && validResult.insights[0]) sug.insightId = validResult.insights[0].id;
      if (!sug.confidence) sug.confidence = 0.7;
    });

    return validResult;
  }

  function generateFallbackAnalysis(weeklyData) {
    const suggestions = [];
    const insights = [];

    if (weeklyData.weakestHabit && weeklyData.weakestHabit.rate < 60) {
      insights.push({
        id: 'ins_fallback_1',
        type: 'warning',
        icon: '⚠️',
        title: `${weeklyData.weakestHabit.name}完成率偏低`,
        description: `本周${weeklyData.weakestHabit.name}完成率仅${weeklyData.weakestHabit.rate}%，建议加强这方面的习惯养成`,
        confidence: 0.85,
        dataSource: ['本周打卡记录']
      });

      suggestions.push({
        id: 'sug_fallback_1',
        insightId: 'ins_fallback_1',
        type: 'adjust_existing',
        title: '调整习惯执行时间',
        description: `我们发现${weeklyData.weakestHabit.name}完成率偏低，可能是时间安排不太合适。建议尝试调整到更适合的时间段。`,
        action: 'adjust_habit',
        targetHabitId: weeklyData.weakestHabit.id,
        adjustment: { name: weeklyData.weakestHabit.name, timePeriod: 'morning' },
        newHabit: null,
        confidence: 0.75,
        expectedImpact: '预计完成率提升20%'
      });
    }

    if (weeklyData.bestHabit && weeklyData.bestHabit.streak >= 7) {
      insights.push({
        id: 'ins_fallback_2',
        type: 'milestone',
        icon: '🎉',
        title: `${weeklyData.bestHabit.name}已连续${weeklyData.bestHabit.streak}天`,
        description: `太棒了！${weeklyData.bestHabit.name}已经形成了稳定的习惯回路`,
        confidence: 0.95,
        dataSource: ['打卡记录']
      });
    }

    if (weeklyData.highFailDay) {
      insights.push({
        id: 'ins_fallback_3',
        type: 'correlation',
        icon: '🔍',
        title: `${weeklyData.highFailDay.dayName}是你的低谷日`,
        description: `${weeklyData.highFailDay.dayName}的失败率高达${weeklyData.highFailDay.failRate}%，建议在这一天减少任务量或调整计划`,
        confidence: 0.8,
        dataSource: ['本周打卡记录']
      });
    }

    return {
      summary: weeklyData.summary || {},
      insights: insights,
      suggestions: suggestions.slice(0, 2)
    };
  }

  // ============================================================
  // 导出模块
  // ============================================================
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.AI = {
    openSettingsPanel,
    openAiConfigPanel,
    sendAiMessage,
    clearAiChat,
    saveAiConfig,
    isConfigured,
    isUsingWorker,
    analyzeWeeklyData
  };

  // 全局暴露（兼容 HTML onclick）
  window.renderAiPage = renderAiPage;
  window.openSettingsPanel = openSettingsPanel;
  window.openAiConfigPanel = openAiConfigPanel;
  window.sendAiMessage = sendAiMessage;
  window.clearAiChat = clearAiChat;
  window.saveAiConfig = saveAiConfig;

  // ============================================================
  // 键盘弹出自动滚动与输入框上移
  // ============================================================
  function initKeyboardScroll() {
    const input = document.getElementById('aiChatInput');
    const inputBar = document.querySelector('.ai-input-bar');
    const container = document.getElementById('aiChatMessages');
    if (!input) return;

    function scrollToBottom() {
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }

    function updateInputBarPosition() {
      if (!inputBar || !window.visualViewport) return;
      const keyboardHeight = window.innerHeight - window.visualViewport.height;
      if (keyboardHeight > 50) {
        inputBar.style.bottom = (keyboardHeight + 20) + 'px';
      } else {
        inputBar.style.bottom = '70px';
      }
    }

    input.addEventListener('focus', function() {
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
      setTimeout(scrollToBottom, 500);
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        updateInputBarPosition();
        scrollToBottom();
      });
      window.visualViewport.addEventListener('scroll', scrollToBottom);
    }

    window.addEventListener('resize', function() {
      updateInputBarPosition();
      scrollToBottom();
    });
  }

  // 初始化：自动补全配置 + 加载历史记录 + 更新状态
autoInitConfig();
loadHistory();
updateProfileAiStatus();
initKeyboardScroll();

  if (App.registerModule) {
    App.registerModule('modules.ai', 'modules', null);
  }
})();