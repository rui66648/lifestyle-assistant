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

  // AI 系统提示词
  const SYSTEM_PROMPT = `你是一位精通以下9部中医古籍和15部现代养生著作的养生顾问。

【古籍经典】
1.《黄帝内经》（《素问》《灵枢》）——中医养生理论之源，阴阳五行、脏腑经络、治未病
2.《遵生八笺》明·高濂——四时调摄、起居安乐、饮馔服食
3.《老老恒言》清·曹庭栋——老年养生，饮食起居导引
4.《饮膳正要》元·忽思慧——宫廷营养学，食疗配方
5.《养生论》三国·嵇康——形神相亲、导引吐纳
6.《寿世青编》清·尤乘——五脏养生，养心为本
7.《备急千金要方·养性》唐·孙思邈——养性之道，饮食药饵
8.《抱朴子》晋·葛洪——道家养生，不伤为本
9.《闲情偶寄》清·李渔——生活美学，颐养之道

【现代著作】
10.《你是你吃出来的》夏萌——细胞营养饮食
11.《九种体质养生全书》王琦——体质分类与调养
12.《科学休息》亚历克斯·索勇-庞——高效休息科学
13.《求医不如求己》中里巴人——经络穴位自愈法
14.《拉伸》鲍勃·安德森——科学拉伸运动
15.《人体运动生理学》——运动科学基础
16.《高级运动营养学》——科学运动营养
17.《力量训练基础》——力量训练方法
18.《运动医学与康复》——运动损伤与康复
19.《睡眠革命》Nick Littlehales——R90睡眠方案
20.《运动改造大脑》John Ratey——运动与脑科学
21.《正念的奇迹》一行禅师——正念冥想
22.《抗炎生活》池谷敏郎——慢性炎症预防
23.《肠子的小心思》朱莉娅·恩德斯——肠道菌群
24.《深度营养》凯瑟琳·沙纳汉——传统饮食智慧

回答时请结合以上经典理论给出建议，并注明引用出处。回答简洁实用，每次控制在200字以内。

【MCP 工具上下文】
如果系统提供了 HowToCook 菜谱、kb-mcp-server 知识库检索结果或 Strava 运动数据，请结合这些结果回答；如果没有提供，请按你的知识回答，不要编造工具结果。`;

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
  const MAX_HISTORY = 20;           // 对话历史保留条数
  const MAX_TOKENS = 500;           // AI 回复最大 token 数
  const TEMPERATURE = 0.7;          // 创造性参数

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
  function openAiChatPanel() {
    const inputArea = document.getElementById('aiChatInputArea');
    const unconfiguredArea = document.getElementById('aiChatUnconfigured');
    const msgContainer = document.getElementById('aiChatMessages');

    // 检查配置状态
    if (!isConfigured()) {
      if (inputArea) inputArea.style.display = 'none';
      if (unconfiguredArea) unconfiguredArea.style.display = 'block';
      if (msgContainer) msgContainer.innerHTML = '';
    } else {
      if (inputArea) inputArea.style.display = 'flex';
      if (unconfiguredArea) unconfiguredArea.style.display = 'none';
    }

    // 渲染历史消息或欢迎语
    if (msgContainer) {
      msgContainer.innerHTML = '';

      if (aiChatHistory.length === 0) {
        // 添加日期分隔线
        renderDateDivider();
        // 欢迎语（带特殊样式）
        renderAiMessage('ai', '你好！我是你的 AI 养生顾问 🌿\n\n精通《黄帝内经》等24部中医经典与现代养生著作，有任何养生问题都可以问我：\n\n• 失眠怎么调理？\n• 夏天应该注意什么？\n• 久坐怎么保护身体？', true);
      } else {
        // 渲染历史消息
        renderDateDivider();
        aiChatHistory.forEach(msg => {
          renderAiMessage(msg.role === 'user' ? 'user' : 'ai', msg.content, false);
        });
      }
    }

    openPanel('aiChatPanel');

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
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'ai-msg ' + role + (isWelcome ? ' welcome-msg' : '');

    // XSS 安全：使用 textContent 转义用户内容和 AI 回复
    const avatar = role === 'ai' ? '🤖' : '👤';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = avatar;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    // textContent 会自动转义 HTML 标签
    bubbleEl.textContent = text;
    // 使用 CSS white-space: pre-wrap 处理换行，避免 innerHTML 操作

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);

    // 滚动到底部
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
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

    // 检查输入长度
    if (text.length === 0) {
      return;
    }

    if (text.length > MAX_INPUT_LENGTH) {
      renderAiError('输入太长了，请控制在 ' + MAX_INPUT_LENGTH + ' 字以内。');
      return;
    }

    // 清空输入框并禁用按钮
    input.value = '';
    isLoading = true;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn._originalHTML = sendBtn.innerHTML;
      sendBtn.innerHTML = '⏳';
    }

    // 显示用户消息
    renderAiMessage('user', text);
    aiChatHistory.push({ role: 'user', content: text });

    // 显示加载动画
    renderAiLoading();

    try {
      let reply;
      const model = currentConfig.model || DEFAULT_MODEL;

      // MCP 增强上下文（仅在使用 Worker 代理时调用）
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

      const systemContent = mcpContext
        ? SYSTEM_PROMPT + '\n\n' + mcpContext
        : SYSTEM_PROMPT;

      if (model === 'local') {
        // 方式0：本地模型（离线运行）
        const messages = [
          { role: 'system', content: systemContent },
          ...aiChatHistory
        ];
        reply = await callLocalModel(messages);
      } else if (isUsingWorker()) {
        // 方式1：使用 Worker 代理（安全）
        const workerUrl = getWorkerUrl();
        const userMessages = [
          { role: 'system', content: systemContent },
          ...aiChatHistory
        ];

        const response = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: userMessages,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE
          })
        });

        const data = await response.json();

        // 检查业务错误
        if (data.error) {
          const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || data.error);
          throw new Error(errMsg || 'AI 服务返回错误');
        }

        // 解析 OpenAI 格式响应
        reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

        if (!reply) {
          throw new Error('AI 没有返回有效回答');
        }
      } else {
        // 方式2：直接调用阿里百炼 API
        const apiKey = getApiKey();
        const messages = [
          { role: 'system', content: systemContent },
          ...aiChatHistory
        ];

        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE
          })
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || 'API 错误');
        }

        reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

        if (!reply) {
          throw new Error('AI 没有返回有效回答');
        }
      }

      removeAiLoading();
      renderAiMessage('ai', reply);
      aiChatHistory.push({ role: 'assistant', content: reply });

      // 保存历史
      saveHistory();

      // 限制历史长度
      if (aiChatHistory.length > MAX_HISTORY * 2) {
        aiChatHistory = aiChatHistory.slice(-MAX_HISTORY * 2);
      }

    } catch (err) {
      removeAiLoading();
      console.error('[AI] 请求失败:', err);

      let errorMsg = '网络错误，请检查网络连接。';
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMsg = '网络连接失败，请检查网络后重试。';
      } else if (err.message.includes('429')) {
        errorMsg = '请求太频繁，请稍后再试。';
      } else if (err.message.includes('401') || err.message.includes('403')) {
        errorMsg = 'API 认证失败，请检查配置。';
      } else if (err.message.includes('500')) {
        errorMsg = 'AI 服务暂时不可用，请稍后再试。';
      } else if (err.message) {
        errorMsg = err.message;
      }

      renderAiError(errorMsg);
    } finally {
      isLoading = false;
      // 恢复发送按钮（使用函数开头已获取的 sendBtn 变量）
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = sendBtn._originalHTML || '➤';
      }
      // 重新聚焦输入框
      if (input) input.focus();
    }
  }

  // 滚动到底部
  function scrollAiToBottom() {
    const container = document.getElementById('aiChatMessages');
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
    // 隐藏滚动按钮
    const btn = document.getElementById('aiScrollBottom');
    if (btn) btn.classList.remove('show');
  }

  // 监听滚动，显示/隐藏"回到底部"按钮
  function initAiScrollListener() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    container.addEventListener('scroll', function() {
      const btn = document.getElementById('aiScrollBottom');
      if (!btn) return;

      const threshold = 100;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

      if (isNearBottom) {
        btn.classList.remove('show');
      } else {
        btn.classList.add('show');
      }
    });
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
    const el = document.getElementById('pseAiStatus');
    if (!el) return;
    if (cfg.apiKey) {
      el.textContent = 'AI 已配置 ✅';
      el.style.color = 'var(--accent)';
    } else {
      el.textContent = 'AI 未配置';
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
    const reminderMethodEl = document.getElementById('settingsReminderMethod');
    if (reminderMethodEl && typeof habitsConfig !== 'undefined' && habitsConfig.length > 0) {
      const firstHabit = habitsConfig[0];
      const method = (firstHabit.reminder && firstHabit.reminder.method) ? firstHabit.reminder.method : 'in-app';
      reminderMethodEl.value = method;
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

    openPanel('settingsPanel');
  }

  // ============================================================
  // 导出模块
  // ============================================================
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.AI = {
    openAiChatPanel,
    openSettingsPanel,
    sendAiMessage,
    clearAiChat,
    saveAiConfig,
    isConfigured,
    isUsingWorker
  };

  // 全局暴露（兼容 HTML onclick）
  window.openAiChatPanel = openAiChatPanel;
  window.openSettingsPanel = openSettingsPanel;
  window.sendAiMessage = sendAiMessage;
  window.clearAiChat = clearAiChat;
  window.saveAiConfig = saveAiConfig;
  window.scrollAiToBottom = scrollAiToBottom;

  // 初始化：加载历史记录 + 滚动监听 + 更新状态
loadHistory();
initAiScrollListener();
updateProfileAiStatus();

  if (App.registerModule) {
    App.registerModule('modules.ai', 'modules', null);
  }
})();