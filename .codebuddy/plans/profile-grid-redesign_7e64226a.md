---
name: profile-grid-redesign
overview: 将「我的」页面从列表式改为图标宫格排列，全屏显示，隐藏参考文献，新增统计入口图标
design:
  architecture:
    framework: html
  styleKeywords:
    - 图标宫格
    - 圆角卡片
    - 渐变色背景
    - 全屏滚动
    - 统计面板
  fontSystem:
    fontFamily: Instrument Sans
    heading:
      size: 18px
      weight: 700
    subheading:
      size: 15px
      weight: 600
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#5BB98A"
      - "#FF9F67"
    background:
      - "#FFFCF7"
      - "#F7F3ED"
    text:
      - "#2C2C2C"
      - "#5A5A5A"
    functional:
      - "#5BB98A"
      - "#FF9F67"
      - "#9A9A9A"
todos:
  - id: restructure-html
    content: "重构 index.html：移除参考文献和列表式菜单，新增图标宫格容器 #profileGrid 和统计详情面板 #statsDetailPanel"
    status: completed
  - id: add-profile-grid-styles
    content: "修改 css/main.css：新增 .profile-grid 和 .profile-grid-item 图标宫格样式，修改 #sec-profile 为全屏布局，暗色模式适配"
    status: completed
    dependencies:
      - restructure-html
  - id: implement-render-logic
    content: 修改 js/ui/render.js：新增 renderProfileGrid()、openStatsDetailPanel()、renderStatsDetail()，修改 renderProfile() 调用逻辑
    status: completed
    dependencies:
      - add-profile-grid-styles
  - id: update-sw-cache
    content: 更新 sw.js 缓存版本号 v10 → v11，确保 PWA 更新生效
    status: completed
    dependencies:
      - implement-render-logic
---

## 用户需求

1. 「我的」界面从列表式改为**图标宫格排列**（类似 iOS 设置图标风格）
2. 「我的」界面**占全屏**（移除内边距限制，内容可完整滚动）
3. **参考文献不显示**（隐藏或移除入口）
4. **新增统计图标**，点击进入统计详情，包含本周趋势等内容

## 功能范围

- 重构「我的」页面布局：顶部保留个人信息卡片+统计数字+环形进度，中间改为图标宫格，底部保留导出按钮
- 图标宫格包含：数据回顾（月/年）、养生工具（子午流注/五劳防护/体质测试/健康报告）、设置与管理（数据管理/使用教程）、**统计**（新入口）
- 参考文献入口完全移除
- 统计入口点击后展示本周趋势柱状图、习惯完成率排行、月度热力图

## 技术方案

### 架构策略

- **HTML 结构重构**：将 `#sec-profile` 内的列表式 `.menu-section` 替换为动态渲染的图标宫格 `.profile-grid`
- **CSS 新增样式**：`.profile-grid`（3列宫格）、`.profile-grid-item`（图标+标签）、全屏适配样式
- **JS 动态渲染**：新增 `renderProfileGrid()` 函数，定义宫格项配置数组，动态生成 HTML
- **统计面板**：复用现有 `#reportPanel` 或新增 `#statsDetailPanel`，将 `#sec-profile` 中的统计内容（weekBarChart、rankingList、heatmapSection）移入面板

### 实现细节

**1. index.html 修改**

- 移除：参考文献按钮（第188-192行）、所有 `.menu-section` 列表项（第146-207行）
- 保留：`.profile-card`、`#profileStats`、 `.ring-container`、`#achievements`、`#dailyCardsEntry`、导出CSV按钮
- 新增：`<div class="profile-grid" id="profileGrid">` 图标宫格容器（放在环形进度之后、成就徽章之前）
- 新增：`<div class="panel" id="statsDetailPanel">` 统计详情面板（放在其他面板区域）
- 将 `#weekBarChart`、`#rankingList`、`#heatmapSection` 从 `#sec-profile` 中移除，改为在 `statsDetailPanel` 中动态渲染

**2. css/main.css 修改**

- 新增 `.profile-grid`：`grid-template-columns: repeat(3, 1fr)`、`gap: 12px`、`padding: 16px 0`
- 新增 `.profile-grid-item`：圆形图标背景、标签文字、居中排列、active 态
- 修改 `#sec-profile.section`：移除 `padding:16px`，改为 `padding: 0 16px calc(env(safe-area-inset-bottom) + 70px)`，实现全屏
- 暗色模式适配：`.profile-grid-item` 背景色

**3. js/ui/render.js 修改**

- 新增 `renderProfileGrid()`：定义宫格项数组（icon、label、onClick），动态生成 HTML 插入 `#profileGrid`
- 修改 `renderProfile()`：调用 `renderProfileGrid()`，移除对 `renderStats()` 的直接调用（改为点击统计图标后展示）
- 新增 `openStatsDetailPanel()`：打开统计详情面板，内部调用 `renderStatsDetail()`
- 新增 `renderStatsDetail()`：渲染本周趋势柱状图、习惯完成率排行、月度热力图（从现有 `renderStats()` 中提取逻辑）

**4. sw.js 修改**

- 缓存版本号：`lifestyle-assistant-v10` → `lifestyle-assistant-v11`

### 性能考虑

- 图标宫格使用 CSS Grid 渲染，性能优于 flex 换行
- 统计面板内容懒加载（点击时才渲染），减少初始加载时间
- 复用现有 `renderStats()` 中的 `renderWeekBarChart()`、`renderHeatmap()` 等函数

### 向后兼容

- 保留现有 `renderStats()` 函数（管理页面也可能调用）
- 新增函数不影响其他页面逻辑

## 设计风格

参考 iOS 设置应用和「小日常」App 的图标宫格设计，采用**圆角卡片+大图标+标签**的风格。

## 布局结构

「我的」页面从上到下：

1. **顶部**：个人信息卡片（头像+等级+进度条）—— 保留现有渐变背景
2. **统计数字**：4宫格（连续打卡/累计打卡/完成率/习惯数）—— 保留现有样式
3. **环形进度**：今日完成率 —— 保留现有样式
4. **图标宫格**：3列网格，每个图标为圆形/圆角矩形背景+大图标+文字标签
5. **成就徽章**：横向滚动或换行排列
6. **每日卡片收藏**：横向滚动预览
7. **底部**：导出CSV按钮

## 图标宫格设计

- 每个格子：圆形图标背景（渐变色）、48px 大图标、12px 文字标签
- 3列排列，间距 12px
- 点击态：缩放 0.95 + 背景色变化
- 图标项包括：
- 📊 统计（新入口，点击展示本周趋势等）
- 📅 月回顾
- 🗓️ 年回顾
- 📊 养生总结
- ⏳ 子午流注
- 🛡️ 五劳防护
- 🩺 体质测试
- 📊 健康报告
- 💾 数据管理
- 📖 使用教程

## 统计详情面板

- 底部弹出面板（复用现有 panel 样式）
- 内容：本周趋势柱状图、习惯完成率排行、月度热力图
- 可滚动查看