#!/usr/bin/env bash
set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          生活习惯小助手 - Cloudflare Worker 一键部署       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ============================================================
# 1. 检查环境
# ============================================================
echo "[1/6] 检查环境..."

if ! command -v npx &> /dev/null; then
    echo "❌ 请先安装 Node.js（包含 npx）"
    echo "   https://nodejs.org/ 下载 LTS 版本"
    exit 1
fi

if ! command -v wrangler &> /dev/null; then
    echo "📦 安装 wrangler..."
    npm install -g wrangler
fi

# ============================================================
# 2. 登录 Cloudflare
# ============================================================
echo ""
echo "[2/6] 登录 Cloudflare..."
echo "请在浏览器中完成登录授权"
wrangler login

# ============================================================
# 3. 创建 KV 命名空间
# ============================================================
echo ""
echo "[3/6] 创建 KV 命名空间..."

KV_ID=$(wrangler kv namespace create PUSH_KV 2>&1 | grep -o '"id": *"[^"]*"' | cut -d'"' -f4)

if [ -z "$KV_ID" ]; then
    echo "❌ 创建 KV 命名空间失败，请手动创建"
    exit 1
fi

echo "✅ KV 命名空间创建成功，ID: $KV_ID"

# ============================================================
# 4. 更新 wrangler.toml
# ============================================================
echo ""
echo "[4/6] 更新 wrangler.toml..."

sed -i.bak "s/id = \"REPLACE_WITH_KV_NAMESPACE_ID\"/id = \"$KV_ID\"/" wrangler.toml
rm -f wrangler.toml.bak

echo "✅ wrangler.toml 已更新"

# ============================================================
# 5. 设置 Secret
# ============================================================
echo ""
echo "[5/6] 设置 Secret..."

# VAPID_PRIVATE_KEY（固定值，与前端公钥配对）
VAPID_PRIVATE="USF9WDgcnN91ju5R-g5YZGzdf4mGwRmIejJErMLJAGI"
echo "$VAPID_PRIVATE" | wrangler secret put VAPID_PRIVATE_KEY

# QWEN_API_KEY（用户输入）
read -p "请输入阿里百炼 API Key（可选，按回车跳过）：" QWEN_KEY
if [ -n "$QWEN_KEY" ]; then
    echo "$QWEN_KEY" | wrangler secret put QWEN_API_KEY
else
    echo "⚠️  跳过设置 QWEN_API_KEY，AI 功能将不可用"
    echo "   后续可通过: wrangler secret put QWEN_API_KEY 设置"
fi

# ============================================================
# 6. 部署 Worker
# ============================================================
echo ""
echo "[6/6] 部署 Worker..."

wrangler deploy

# ============================================================
# 完成
# ============================================================
echo ""
echo "🎉 部署完成！"
echo ""
echo "请执行以下步骤完成前端配置："
echo "1. 打开 https://rui66648.github.io/lifestyle-assistant/"
echo "2. 点击「我的」→ 设置 → 🔔 后台推送提醒"
echo "3. 填入 Worker URL（如: https://ai-proxy.yourname.workers.dev）"
echo "4. 点击「💾 保存配置」→ 允许通知权限"
echo "5. 点击「🧪 测试推送」验证"
echo ""
echo "详细说明见: serverless/cloudflare-workers/部署说明.md"
