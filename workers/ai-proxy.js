// Cloudflare Workers - AI 养生顾问代理
// 部署步骤：
// 1. 注册 Cloudflare 账号 https://dash.cloudflare.com
// 2. 注册阿里百炼 https://bailian.console.aliyun.com 获取 API Key
// 3. 在 Cloudflare Workers 控制台创建新 Worker，粘贴此代码
// 4. 在 Worker 设置中添加环境变量 QWEN_API_KEY = 你的阿里百炼API Key
// 5. 部署后复制 Worker URL，填入 index.html 的 AI_WORKER_URL 配置

export default {
  async fetch(request, env, ctx) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const { messages } = body;

      if (!env.QWEN_API_KEY) {
        return new Response(JSON.stringify({ error: 'API Key not configured' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // 调用通义千问 API（阿里百炼）
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.QWEN_API_KEY}`
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              {
                role: 'system',
                content: '你是一位精通《黄帝内经》等14部中医养生经典的养生顾问。回答用户健康问题时，请结合中医经典理论给出建议，并尽可能注明引用的古籍出处（如《素问》《灵枢》等）。回答要简洁实用，适合普通用户理解，每次回答控制在200字以内。'
              },
              ...messages
            ]
          },
          parameters: {
            result_format: 'message',
            max_tokens: 500,
            temperature: 0.7
          }
        })
      });

      const data = await response.json();
      
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
