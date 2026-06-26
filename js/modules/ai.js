(function() {
  // Cloudflare AI Gateway 配置（通过 gateway.ai.cloudflare.com 代理，国内可访问）
  const AI_GATEWAY_URL = 'https://gateway.ai.cloudflare.com/v1/45e8ad82bb9cbdcd3f6e4669591761fe/ai-proxy';
  // 阿里百炼 API Key（兼容 OpenAI 模式）
  // 请在下方填入你的 API Key（本地使用，不要提交到公开仓库）
  const DASHSCOPE_API_KEY = '';
  // AI Gateway 认证 Token — 请在 Cloudflare AI Gateway 设置中创建并填入
  const AI_GATEWAY_TOKEN = '';

  let aiChatHistory = [];

  function openAiChatPanel() {
    const inputArea = document.getElementById('aiChatInputArea');
    const configArea = document.getElementById('aiChatConfig');
    if (!AI_GATEWAY_TOKEN) {
      if (inputArea) inputArea.style.display = 'none';
      if (configArea) configArea.style.display = 'block';
    } else {
      if (inputArea) inputArea.style.display = 'flex';
      if (configArea) configArea.style.display = 'none';
    }
    const msgContainer = document.getElementById('aiChatMessages');
    if (msgContainer && msgContainer.children.length === 0) {
      renderAiMessage('ai', '你好！我是你的AI养生顾问，精通《黄帝内经》等14部中医经典。有任何养生问题都可以问我，比如：\n• 失眠怎么调理？\n• 夏天应该注意什么？\n• 久坐怎么保护身体？');
    }
    openPanel('aiChatPanel');
  }

  function renderAiMessage(role, text) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ai-msg ' + role;
    const avatar = role === 'ai' ? '🤖' : '👤';
    div.innerHTML = `<div class="ai-avatar">${avatar}</div><div class="ai-bubble">${text.replace(/\n/g, '<br>')}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function renderAiLoading() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.id = 'aiLoading';
    div.className = 'ai-msg ai';
    div.innerHTML = `<div class="ai-avatar">🤖</div><div class="ai-loading"><span></span><span></span><span></span></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeAiLoading() {
    const el = document.getElementById('aiLoading');
    if (el) el.remove();
  }

  async function sendAiMessage() {
    if (!AI_GATEWAY_TOKEN) return;
    const input = document.getElementById('aiChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    renderAiMessage('user', text);
    aiChatHistory.push({ role: 'user', content: text });
    renderAiLoading();

    try {
      const messages = [
        { role: 'system', content: '你是一位精通《黄帝内经》等14部中医养生经典的养生顾问。回答用户健康问题时，请结合中医经典理论给出建议，并尽可能注明引用的古籍出处（如《素问》《灵枢》等）。回答要简洁实用，适合普通用户理解，每次回答控制在200字以内。' },
        ...aiChatHistory
      ];

      // 通过 AI Gateway compat 端点调用（OpenAI 兼容格式）
      const response = await fetch(AI_GATEWAY_URL + '/compat/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + DASHSCOPE_API_KEY,
          'cf-aig-authorization': 'Bearer ' + AI_GATEWAY_TOKEN
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: messages,
          max_tokens: 500,
          temperature: 0.7
        })
      });

      removeAiLoading();

      if (!response.ok) {
        const errText = await response.text();
        console.error('AI Gateway error:', response.status, errText);
        renderAiMessage('ai', '抱歉，AI 服务暂时不可用。\n状态码: ' + response.status);
        return;
      }

      const data = await response.json();
      const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
        || '抱歉，没有获取到回答。';

      renderAiMessage('ai', reply);
      aiChatHistory.push({ role: 'assistant', content: reply });

      if (aiChatHistory.length > 20) {
        aiChatHistory = aiChatHistory.slice(-20);
      }
    } catch (err) {
      removeAiLoading();
      renderAiMessage('ai', '网络错误: ' + err.message);
    }
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.AI = {
    openAiChatPanel,
    renderAiMessage,
    renderAiLoading,
    removeAiLoading,
    sendAiMessage
  };
})();
