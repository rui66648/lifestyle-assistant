# 防删除协作开发规范

## 问题根因

之前使用 `git checkout <旧commit> -- <文件>` 恢复文件时，直接**覆盖了**该文件在旧commit之后的所有修改，导致其他用户提交的功能被删除。

### 被删除的功能清单
| 功能 | 文件 | 删除原因 | 状态 |
|------|------|---------|------|
| 通知提醒模块 | `js/modules/notification.js` | 回滚时该文件不存在于旧commit | 已丢失，需手动恢复 |
| iOS安装引导弹窗 | `js/modules/constitution.js` | 回滚覆盖了showIosInstallGuide | 被showInstallGuideModal替代 |
| 体质入口卡片 | `js/ui/render.js` + `css/main.css` | 回滚后丢失 | 已手动补回 |

---

## 标准操作流程（SOP）

### 第一步：每次修改前，先同步云端

```bash
# 1. 获取云端最新代码（不合并）
git fetch origin

# 2. 查看本地与云端的差异
git diff HEAD origin/main --stat

# 3. 如果云端有更新，先合并到本地
git merge origin/main
# 或
git rebase origin/main
```

### 第二步：修改代码

### 第三步：推送前强制检查

```bash
# 运行检查脚本
bash .github/check-before-push.sh
```

### 第四步：安全推送

```bash
git push origin <分支名>:main
```

---

## 推送前检查脚本

创建文件 `.github/check-before-push.sh`：

```bash
#!/bin/bash
set -e

echo "===== 推送前安全检查 ====="

# 1. 获取云端最新状态
git fetch origin

# 2. 检查是否有文件被删除
echo "--- 检查文件删除 ---"
DELETED=$(git diff --name-status HEAD origin/main | grep "^D" || true)
if [ -n "$DELETED" ]; then
    echo "❌ 警告：以下文件在云端存在但本地将被删除："
    echo "$DELETED"
    echo "请确认是否故意删除，否则请先恢复。"
    exit 1
fi

# 3. 检查文件行数是否大幅减少（可能被覆盖）
echo "--- 检查文件行数变化 ---"
git diff --stat HEAD origin/main | while read line; do
    # 提取减少行数
    if echo "$line" | grep -E "\|.*\+.*-" > /dev/null; then
        FILE=$(echo "$line" | awk '{print $1}')
        REMOVED=$(echo "$line" | grep -oE "[0-9]+ deletions" | awk '{print $1}')
        ADDED=$(echo "$line" | grep -oE "[0-9]+ insertions" | awk '{print $1}')
        TOTAL=$(git show origin/main:"$FILE" 2>/dev/null | wc -l)
        
        if [ -n "$REMOVED" ] && [ "$TOTAL" -gt 0 ]; then
            RATIO=$((REMOVED * 100 / TOTAL))
            if [ "$RATIO" -gt 80 ]; then
                echo "⚠️  $FILE 删除了 ${RATIO}% 的代码（${REMOVED}/${TOTAL}行），可能被覆盖！"
            fi
        fi
    fi
done

# 4. 检查关键功能文件是否存在
echo "--- 检查关键功能文件 ---"
KEY_FILES=(
    "js/modules/notification.js"
    "js/modules/constitution.js"
    "js/ui/render.js"
    "css/main.css"
    "js/data/content.js"
)

for f in "${KEY_FILES[@]}"; do
    if [ ! -f "$f" ]; then
        echo "❌ 关键文件缺失: $f"
        exit 1
    fi
done

echo "✅ 检查通过，可以安全推送"
```

---

## 替代回滚的安全方法

### ❌ 不要这样做（会删除他人修改）

```bash
# 危险！会覆盖该文件的所有后续修改
git checkout <旧commit> -- js/modules/constitution.js
```

### ✅ 安全做法

**方法1：只恢复特定函数**
```bash
# 从旧commit提取代码，手动粘贴到当前文件
git show <旧commit>:js/modules/constitution.js | grep -A 50 "function openConstitutionPanel"
```

**方法2：使用git revert（推荐）**
```bash
# 撤销某次提交的修改，但保留后续提交
git revert <commit-hash>
```

**方法3：使用git checkout --patch**
```bash
# 交互式选择要恢复的代码片段
git checkout --patch <旧commit> -- js/modules/constitution.js
```

---

## 关键功能清单（发布前核对）

```markdown
- [ ] notification.js 存在且被 index.html 引用
- [ ] constitution.js 包含所有功能（海报/分享/安装引导/版本选择）
- [ ] render.js 包含 renderConstitutionEntry 和 renderConstitutionTips
- [ ] CSS 包含 .install-prompt-card 和 .constitution-entry-card 样式
- [ ] index.html 引用所有 JS/CSS 文件
```

---

## 分支保护建议

在 GitHub 设置中启用：
1. **Require pull request reviews** - 推送前需要审查
2. **Require status checks** - 强制通过检查脚本
3. **Restrict pushes** - 限制谁可以推送到 main

---

## 如果已经删除了怎么办

### 立即恢复（24小时内）
```bash
# 从GitHub直接拉取云端版本
git checkout origin/main -- js/modules/notification.js
```

### 如果已推送覆盖
```bash
# 强制回退到云端版本（会丢失本地修改，谨慎使用）
git reset --hard origin/main
```
