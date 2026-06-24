#!/bin/bash
# 部署到GitHub Pages脚本
# 使用方法：
# 1. 修改下面的GITHUB_USER和GITHUB_TOKEN
# 2. 运行：chmod +x deploy-to-github.sh && ./deploy-to-github.sh

GITHUB_USER="YOUR_GITHUB_USERNAME"
GITHUB_TOKEN="YOUR_GITHUB_TOKEN"
REPO_NAME="lifestyle-assistant"

# 检查凭据是否已修改
if [ "$GITHUB_USER" = "YOUR_GITHUB_USERNAME" ] || [ "$GITHUB_TOKEN" = "YOUR_GITHUB_TOKEN" ]; then
    echo "错误：请先修改脚本中的 GITHUB_USER 和 GITHUB_TOKEN"
    echo "获取Token: https://github.com/settings/tokens (勾选repo权限)"
    exit 1
fi

cd /workspace

# 初始化git仓库
git init
git config user.name "Lifestyle Assistant"
git config user.email "assistant@example.com"

# 创建.gitignore
cat > .gitignore << 'EOF'
.uploads/
.trae/
lifestyle-assistant/.git/
EOF

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Lifestyle Assistant v1 + 14 health reference guides"

# 添加远程仓库
git remote add origin "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git"

# 推送到main分支
git branch -M main
git push -u origin main --force

echo ""
echo "========================================"
echo "推送完成！"
echo "仓库地址: https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo ""
echo "下一步：在GitHub仓库设置中启用GitHub Pages"
echo "1. 访问: https://github.com/${GITHUB_USER}/${REPO_NAME}/settings/pages"
echo "2. Source选择: Deploy from a branch"
echo "3. Branch选择: main / (root)"
echo "4. 点击Save"
echo ""
echo "访问地址将是: https://${GITHUB_USER}.github.io/${REPO_NAME}/"
echo "========================================"
