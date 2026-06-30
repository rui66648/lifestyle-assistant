#!/bin/bash
set -e

echo "===== 推送前安全检查 ====="

# 1. 获取云端最新状态
git fetch origin

# 2. 检查是否有文件被删除（本地相对于云端）
echo "--- 检查文件删除 ---"
DELETED=$(git diff --name-status HEAD origin/main | grep "^D" || true)
if [ -n "$DELETED" ]; then
    echo "❌ 警告：以下文件在云端存在但本地将被删除："
    echo "$DELETED"
    echo ""
    echo "请确认是否故意删除。"
    echo "如果不是，请运行：git checkout origin/main -- <文件名>"
    exit 1
fi

# 3. 检查是否有新增文件未提交
echo "--- 检查未跟踪文件 ---"
UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -n "$UNTRACKED" ]; then
    echo "⚠️  存在未跟踪文件（可能忘记git add）："
    echo "$UNTRACKED"
fi

# 4. 检查关键功能文件是否存在
echo "--- 检查关键功能文件 ---"
KEY_FILES=(
    "js/modules/notification.js"
    "js/modules/constitution.js"
    "js/ui/render.js"
    "css/main.css"
    "js/data/content.js"
    "index.html"
)

for f in "${KEY_FILES[@]}"; do
    if [ ! -f "$f" ]; then
        echo "❌ 关键文件缺失: $f"
        echo "该文件可能已被误删除，请从云端恢复：git checkout origin/main -- $f"
        exit 1
    fi
done

# 5. 检查文件行数是否大幅减少（可能被覆盖）
echo "--- 检查文件行数大幅变化 ---"
git diff --stat HEAD origin/main | grep -E "\.js|\.css" | while read line; do
    FILE=$(echo "$line" | awk '{print $1}')
    # 解析删除行数
    REMOVED=$(echo "$line" | grep -oE "[0-9]+ deletions" | awk '{print $1}' || echo "0")
    TOTAL=$(git show origin/main:"$FILE" 2>/dev/null | wc -l || echo "0")
    
    if [ "$TOTAL" -gt 0 ] && [ "$REMOVED" -gt 0 ]; then
        RATIO=$((REMOVED * 100 / TOTAL))
        if [ "$RATIO" -gt 50 ]; then
            echo "⚠️  $FILE 删除了 ${RATIO}% 的代码（${REMOVED}/${TOTAL}行），可能被覆盖！"
        fi
    fi
done

echo ""
echo "✅ 检查通过，可以安全推送"
echo "如需推送，运行：git push origin $(git branch --show-current):main"
