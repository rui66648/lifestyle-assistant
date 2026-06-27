(function() {
  'use strict';

  // ============================================================
  // 配置说明
  // ============================================================
  // 方式1（推荐）：使用 Cloudflare Workers 代理
  //   1. 按 workers/部署说明.md 部署 ai-proxy.js
  //   2. 获取 Worker URL，填入 AI_WORKER_URL
  //   3. 不需要填 API Key（Key 在 Worker 环境变量里，更安全）
  //
  // 方式2（临时测试）：直接调用阿里百炼 API
  //   1. 在阿里百炼获取 API Key
  //   2. 填入 DASHSCOPE_API_KEY
  //   ⚠️ 注意：API Key 会暴露在前端代码中，仅限临时测试！
  // ============================================================

  // 方式1：Worker 代理 URL（推荐）
  // 部署 ai-proxy.js 后填入，如：'https://ai-proxy.3487331518.workers.dev'
  const AI_WORKER_URL = 'https://ai-proxy.3487331518.workers.dev';

  // 方式2：直接调用 API（仅临时测试用）
  // ⚠️ API Key 会暴露在前端，不要在正式环境使用！
  const DASHSCOPE_API_KEY = '';

  // AI 系统提示词
  const SYSTEM_PROMPT = '你是一位精通《黄帝内经》等14部中医养生经典的养生顾问。回答用户健康问题时，请结合中医经典理论给出建议，并尽可能注明引用的古籍出处（如《素问》《灵枢》等）。回答要简洁实用，适合普通用户理解，每次回答控制在200字以内。';

  // 配置参数
  const MAX_INPUT_LENGTH = 500;      // 最大输入长度
  const MAX_HISTORY = 20;           // 对话历史保留条数
  const MAX_TOKENS = 500;           // AI 回复最大 token 数
  const TEMPERATURE = 0.7;          // 创造性参数
  const MODEL = 'qwen-turbo';       // 模型

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
  // XSS 安全：转义 HTML 特殊字符
  // ============================================================
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // 验证配置
  // ============================================================
  function isConfigured() {
    return AI_WORKER_URL.trim() !== '' || DASHSCOPE_API_KEY.trim() !== '';
  }

  function isUsingWorker() {
    return AI_WORKER_URL.trim() !== '';
  }

  // ============================================================
  // UI 渲染（使用 textContent 防止 XSS）
  // ============================================================
  function openAiChatPanel() {
    const inputArea = document.getElementById('aiChatInputArea');
    const configArea = document.getElementById('aiChatConfig');
    const msgContainer = document.getElementById('aiChatMessages');

    // 检查配置状态
    if (!isConfigured()) {
      if (inputArea) inputArea.style.display = 'none';
      if (configArea) configArea.style.display = 'block';
    } else {
      if (inputArea) inputArea.style.display = 'flex';
      if (configArea) configArea.style.display = 'none';
    }

    // 渲染历史消息或欢迎语
    if (msgContainer) {
      msgContainer.innerHTML = '';

      if (aiChatHistory.length === 0) {
        // 欢迎语
        renderAiMessage('ai', '你好！我是你的AI养生顾问，精通《黄帝内经》等14部中医经典。有任何养生问题都可以问我，比如：\n• 失眠怎么调理？\n• 夏天应该注意什么？\n• 久坐怎么保护身体？');
      } else {
        // 渲染历史消息
        aiChatHistory.forEach(msg => {
          renderAiMessage(msg.role === 'user' ? 'user' : 'ai', msg.content);
        });
      }
    }

    openPanel('aiChatPanel');
  }

  function renderAiMessage(role, text) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'ai-msg ' + role;

    // XSS 安全：使用 textContent 转义用户内容和 AI 回复
    const avatar = role === 'ai' ? '🤖' : '👤';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = avatar;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    // textContent 会自动转义 HTML 标签
    bubbleEl.textContent = text;
    // 把换行符转回 <br>
    bubbleEl.innerHTML = bubbleEl.innerHTML.replace(/\n/g, '<br>');

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);

    // 滚动到底部
    container.scrollTop = container.scrollHeight;
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
    bubbleEl.className = 'ai-bubble ai-error-text';
    bubbleEl.textContent = text;
    bubbleEl.innerHTML = bubbleEl.innerHTML.replace(/\n/g, '<br>');

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

    // 清空输入框
    input.value = '';
    isLoading = true;

    // 显示用户消息
    renderAiMessage('user', text);
    aiChatHistory.push({ role: 'user', content: text });

    // 显示加载动画
    renderAiLoading();

    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...aiChatHistory
      ];

      let response;
      let data;

      if (isUsingWorker()) {
        // 方式1：使用 Worker 代理（安全）
        response = await fetch(AI_WORKER_URL + '/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: MODEL,
            messages: messages,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE
          })
        });

        data = await response.json();

        // 检查业务错误
        if (data.error) {
          throw new Error(data.error.message || 'AI 服务返回错误');
        }

        // 解析 OpenAI 格式响应
        const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

        if (!reply) {
          throw new Error('AI 没有返回有效回答');
        }

        removeAiLoading();
        renderAiMessage('ai', reply);
        aiChatHistory.push({ role: 'assistant', content: reply });

      } else {
        // 方式2：直接调用 API（仅测试用）
        response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + DASHSCOPE_API_KEY
          },
          body: JSON.stringify({
            model: MODEL,
            messages: messages,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE
          })
        });

        data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || 'API 错误');
        }

        const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

        if (!reply) {
          throw new Error('AI 没有返回有效回答');
        }

        removeAiLoading();
        renderAiMessage('ai', reply);
        aiChatHistory.push({ role: 'assistant', content: reply });
      }

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
        renderAiMessage('ai', '对话记录已清空。有任何养生问题都可以问我！');
      }
    }
  }

  // ============================================================
  // 导出模块
  // ============================================================
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.AI = {
    openAiChatPanel,
    sendAiMessage,
    clearAiChat,
    isConfigured,
    isUsingWorker
  };

  // 全局暴露（兼容 HTML onclick）
  window.openAiChatPanel = openAiChatPanel;
  window.sendAiMessage = sendAiMessage;
  window.clearAiChat = clearAiChat;

  // 初始化：加载历史记录
  loadHistory();

  if (App.registerModule) {
    App.registerModule('modules.ai', 'modules', null);
  }
})();
