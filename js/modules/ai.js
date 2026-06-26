(function() {
  const AI_WORKER_URL = 'https://ai-proxy.3487331518.workers.dev';
  let aiChatHistory = [];

  function openAiChatPanel() {
    if (!AI_WORKER_URL) {
      document.getElementById('aiChatInputArea').style.display = 'none';
      document.getElementById('aiChatConfig').style.display = 'block';
    } else {
      document.getElementById('aiChatInputArea').style.display = 'flex';
      document.getElementById('aiChatConfig').style.display = 'none';
    }
    const msgContainer = document.getElementById('aiChatMessages');
    if (msgContainer.children.length === 0) {
      renderAiMessage('ai', '你好！我是你的AI养生顾问，精通《黄帝内经》等14部中医经典。有任何养生问题都可以问我，比如：\n• 失眠怎么调理？\n• 夏天应该注意什么？\n• 久坐怎么保护身体？');
    }
    openPanel('aiChatPanel');
  }

  function renderAiMessage(role, text) {
    const container = document.getElementById('aiChatMessages');
    const div = document.createElement('div');
    div.className = 'ai-msg ' + role;
    const avatar = role === 'ai' ? '🤖' : '👤';
    div.innerHTML = `<div class="ai-avatar">${avatar}</div><div class="ai-bubble">${text.replace(/\n/g, '<br>')}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function renderAiLoading() {
    const container = document.getElementById('aiChatMessages');
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
    if (!AI_WORKER_URL) return;
    const input = document.getElementById('aiChatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    renderAiMessage('user', text);
    aiChatHistory.push({ role: 'user', content: text });
    renderAiLoading();

    try {
      const response = await fetch(AI_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: aiChatHistory })
      });

      removeAiLoading();

      if (!response.ok) {
        renderAiMessage('ai', '抱歉，服务暂时不可用，请检查 Cloudflare Workers 配置。');
        return;
      }

      const data = await response.json();
      const reply = (data.output && data.output.choices && data.output.choices[0] && data.output.choices[0].message && data.output.choices[0].message.content) || (data.output && data.output.text) || '抱歉，没有获取到回答。';

      renderAiMessage('ai', reply);
      aiChatHistory.push({ role: 'assistant', content: reply });

      if (aiChatHistory.length > 20) {
        aiChatHistory = aiChatHistory.slice(-20);
      }
    } catch (err) {
      removeAiLoading();
      renderAiMessage('ai', '网络错误，请检查 Workers URL 是否正确配置。\n错误：' + err.message);
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
