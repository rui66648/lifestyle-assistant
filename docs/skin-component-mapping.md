# 皮肤组件 → 实际UI位置对照表

## UIverse 三套完整风格

基于 uiverse.io 高质量组件设计，适配项目主题色和尺寸。

| 风格名称 | 风格ID | 特点描述 | 灵感来源 |
|:-------:|:------:|:--------:|:--------:|
| **极光 Aurora** | `aurora` | 渐变背景、发光边框、梦幻流动效果 | uiverse.io 渐变发光系列 |
| **拟态 Neumorphic** | `neu` | 柔和阴影、立体凸起、新拟态风格 | uiverse.io neumorphic 系列 |
| **极简 Minimal** | `minimal` | 细线条、极简设计、干净利落 | uiverse.io minimal 系列 |

**三套风格覆盖全部6大组件分类**：按钮、复选框、开关、卡片、输入框、徽章

**文件**: [uiverse-themes.css](file:///workspace/css/uiverse-themes.css)

---

## 一、按钮样式 (btn-*)

| 皮肤选项 | 样式特点 | 实际影响的UI元素 |
|:-------:|:--------:|:---------------|
| 圆角渐变 (btn-default) | 圆角16px + 主色渐变背景 | .checkin-btn 打卡按钮、.bnav-item 底部导航、.habit-card 习惯卡片、.profile-grid-item 个人中心宫格、.skin-tab 皮肤标签、.fab 悬浮按钮、.const-btn 确认按钮、.panel-close 关闭按钮、.mg-add-btn 添加按钮、.export-btn 导出按钮、.water-quick-btn 饮水快捷按钮等 |
| 胶囊 (btn-pill) | 胶囊形状 | 同上 |
| 毛玻璃 (btn-glass) | backdrop-filter模糊 + 半透明 | 同上 |
| 双色渐变 (btn-gradient) | accent+accent2双色渐变 + 高光 | 同上 |
| 3D立体 (btn-3d) | 按压下沉效果 | 同上 |

## 二、复选框样式 (cb-*)

| 皮肤选项 | 样式特点 | 实际影响的UI元素 |
|:-------:|:--------:|:---------------|
| 圆角 (cb-default) | 圆角矩形 | .theme-toggle 主题开关 |
| 圆形 (cb-round) | 圆形选中态 | .theme-toggle 主题开关 |
| 拟态 (cb-neu) | neumorphic内阴影 | .theme-toggle 主题开关 |

## 三、开关样式 (tg-*)

| 皮肤选项 | 样式特点 | 实际影响的UI元素 |
|:-------:|:--------:|:---------------|
| 标准 (tg-default) | 经典滑动开关 | .theme-toggle 主题开关、.toggle-switch 开关组件、.mg-item-toggle 习惯项开关 |
| 日夜切换 (tg-daynight) | 太阳/月亮动画 + 天空渐变 | 同上 |
| 霓虹 (tg-neon) | 发光边框 + 霓虹效果 | 同上 |

## 四、卡片样式 (cd-*)

| 皮肤选项 | 样式特点 | 实际影响的UI元素 |
|:-------:|:--------:|:---------------|
| 毛玻璃 (cd-glass) | backdrop-filter模糊 + 半透明 | .habit-card 习惯卡片、.stat-card 统计卡片、.lib-item 习惯库条目、.mini-quote 每日引言、.profile-stat-item 统计数据项、.ai-message-bubble AI消息气泡、.water-tracker 饮水追踪器、.diet-tip-card 饮食提示卡、.diet-meal-card 餐次建议卡、.diet-seasonal-card 时令养生卡 |
| 渐变边框 (cd-gradient) | accent+accent2渐变边框 | 同上 |
| 拟态 (cd-neu) | neumorphic凸起效果 | 同上 |

## 五、输入框样式 (in-*)

| 皮肤选项 | 样式特点 | 实际影响的UI元素 |
|:-------:|:--------:|:---------------|
| 毛玻璃 (in-glass) | backdrop-filter模糊 | input[type=text] 文本框、input[type=number] 数字框、input[type=password] 密码框、input[type=time] 时间框、textarea 文本域、select 下拉框、.mg-search 搜索框 |
| 浮动标签 (in-float) | 浮动动画效果 | 同上 |
| 下划线 (in-underline) | Material下划线风格 | 同上 |

## 六、徽章样式 (bd-*)

| 皮肤选项 | 样式特点 | 实际影响的UI元素 |
|:-------:|:--------:|:---------------|
| 药丸 (bd-pill) | 椭圆胶囊形状 | .level-badge 等级徽章、.streak-badge 连续徽章、.badge 通用徽章、.habit-tag 习惯标签 |
| 渐变 (bd-gradient) | accent+accent2渐变背景 | 同上 |
| 发光 (bd-glow) | box-shadow发光效果 | 同上 |
| 圆点 (bd-dot) | 左侧圆点指示器 | 同上 |

---

# UI架构优化建议

## 一、组件化架构优化

### 1. 当前架构问题
- 样式分散在 main.css 和 components.css 中，维护成本高
- 组件通过CSS类名直接控制，缺少统一的组件创建API
- 皮肤切换通过 body 类名全局控制，粒度较粗

### 2. 优化方向

#### 2.1 原子化CSS设计系统
参考 Tailwind CSS 思路，建立设计令牌系统：

```
设计令牌 (Design Tokens)
├── 颜色系统 (Color)
│   ├── 主色体系 (accent-50 ~ accent-900)
│   ├── 中性色 (neutral-50 ~ neutral-900)
│   └── 语义色 (success/warning/error/info)
├── 间距系统 (Spacing)
│   └── 4px基准: 4 8 12 16 20 24 32 48
├── 圆角系统 (Radius)
│   └── sm:8px md:12px lg:16px xl:24px full:9999px
├── 阴影系统 (Shadow)
│   └── sm md lg xl 2xl
└── 字体系统 (Typography)
    ├── 字号: 12 13 14 16 18 20 24 32
    └── 字重: 400 500 600 700
```

#### 2.2 组件分层架构
参考 Figma / Material Design 组件分层：

```
App UI Components
├── Foundations (基础层)
│   ├── CSS Variables (设计令牌)
│   ├── Reset & Base (基础重置)
│   └── Utility Classes (工具类)
├── Atoms (原子层)
│   ├── Button 按钮
│   ├── Input 输入框
│   ├── Checkbox 复选框
│   ├── Switch 开关
│   ├── Badge 徽章
│   ├── Icon 图标
│   └── Avatar 头像
├── Molecules (分子层)
│   ├── Card 卡片
│   ├── SearchBar 搜索栏
│   ├── NavItem 导航项
│   ├── StatItem 统计项
│   └── Tag 标签
├── Organisms (组织层)
│   ├── HabitCard 习惯卡片
│   ├── NavBar 导航栏
│   ├── Panel 面板
│   ├── Heatmap 热力图
│   └── ChatMessage 聊天消息
└── Templates (模板层)
    ├── CheckinPage 打卡页
    ├── ManagePage 管理页
    ├── StatsPage 统计页
    └── ProfilePage 个人中心
```

## 二、皮肤系统架构优化

### 1. 当前问题
- 皮肤通过 body class 全局切换，影响所有同类型组件
- 无法针对单个组件定制皮肤
- 皮肤配置和样式定义分离，不易扩展

### 2. 优化方案：主题引擎 (Theme Engine)

#### 2.1 皮肤配置数据化
```javascript
const THEME_CONFIG = {
  id: 'modern',
  name: '现代简约',
  colors: {
    accent: '#10B981',
    accent2: '#F59E0B',
    bg: '#F8FAFC',
    surface: 'rgba(255,255,255,.85)',
  },
  components: {
    button: {
      style: 'gradient',     // default | pill | glass | gradient | 3d
      radius: 'lg',
      shadow: 'md',
    },
    card: {
      style: 'glass',        // default | glass | gradient | neumorphic
      radius: 'xl',
      blur: 16,
    },
    input: {
      style: 'underlined',   // default | glass | underlined | outlined
      radius: 'md',
    },
  }
};
```

#### 2.2 CSS变量驱动
```css
/* 通过 data-theme 和 data-component-style 控制 */
[data-theme="modern"] [data-btn-style="gradient"] {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
}
```

## 三、交互体验优化

### 1. 微动效 (Micro-interactions)

| 交互 | 建议效果 | 应用场景 |
|-----|---------|---------|
| 点击反馈 | scale(0.97) + 200ms | 所有按钮 |
| 悬停状态 | translateY(-2px) + shadow增强 | 卡片、可点击项 |
| 状态切换 | cubic-bezier(.4,0,.2,1) 300ms | 开关、折叠 |
| 加载状态 | 三点跳动 / 旋转菊花 | 数据加载 |
| 成功反馈 | ✓ 勾选动画 + 绿色高亮 | 打卡成功 |

### 2. 手势支持

| 手势 | 功能 | 页面 |
|-----|------|------|
| 下拉刷新 | 刷新数据 | 打卡页 |
| 左滑操作 | 删除 / 编辑 | 习惯列表 |
| 双指缩放 | 缩放热力图 | 统计页 |
| 长按 | 快捷菜单 / 拖拽排序 | 习惯管理 |

## 四、性能优化建议

### 1. CSS优化
- 使用 `contain: layout paint` 隔离独立组件重绘
- 减少 `backdrop-filter` 使用（性能开销大）
- 用 `transform` 和 `opacity` 做动画，触发 GPU 加速

### 2. 渲染优化
- 虚拟列表：习惯库 > 50 条时启用
- 懒加载：统计图表延迟渲染
- 防抖/节流：搜索、滚动等高频操作

### 3. 皮肤切换性能
- 使用 CSS 变量切换，避免全量重排
- 预加载皮肤样式，切换零延迟
- 骨架屏过渡，避免闪烁

## 五、可访问性 (a11y) 优化

| 项目 | 建议 |
|-----|------|
| 对比度 | 文本与背景对比度 ≥ 4.5:1 |
| 键盘导航 | 所有可交互元素可通过 Tab 聚焦 |
| 语义化 | 使用正确的 HTML 标签 (button, nav, section) |
| ARIA标签 | 图标按钮添加 aria-label |
| 缩放支持 | 文字放大 200% 不破坏布局 |
| 减少动效 | 尊重 prefers-reduced-motion 设置 |

## 六、暗色模式深化

### 1. 当前状态
- 通过 `body.dark` 类名切换
- 基础色变量已覆盖

### 2. 优化方向
- 三级背景色：页面背景 / 卡片背景 / 弹窗背景
- 降低纯黑 (#000) 使用，改用深灰 (#1E293B)
- 图片/图标暗色模式适配
- 跟随系统：`prefers-color-scheme` 自动检测

---

## 七、已实施的架构优化

### 1. 设计令牌系统 (Design Tokens) ✅

| 类别 | 令牌数量 | 说明 |
|-----|---------|------|
| 颜色系统 | 50+ | 主色阶(accent-50~900)、次色阶、语义色、五行色 |
| 间距系统 | 11 | space-1 ~ space-16 (4px基准) |
| 圆角系统 | 8 | xs ~ 2xl + full |
| 阴影系统 | 7 | xs ~ xl + float |
| 字体系统 | 15 | 字号8级 + 字重4级 + 行高3级 |
| 动画系统 | 10 | 缓动4种 + 时长6级 |
| 层级系统 | 8 | base ~ tooltip |

**文件**: [main.css](file:///workspace/css/main.css#L1-L156) (`:root` 变量定义)

### 2. 工具类系统 (Utility Classes) ✅

| 类别 | 数量 | 示例 |
|-----|------|------|
| Flex布局 | 8 | `.u-flex`, `.u-flex-center`, `.u-flex-between` |
| 间距 | 16 | `.u-mt-4`, `.u-p-3`, `.u-gap-2` |
| 文字 | 10 | `.u-text-lg`, `.u-font-semibold`, `.u-text-muted` |
| 圆角 | 4 | `.u-rounded-sm`, `.u-rounded-full` |
| 阴影 | 2 | `.u-shadow-sm`, `.u-shadow-md` |
| 其他 | 5 | `.u-truncate`, `.u-text-center`, `.u-transition` |

**文件**: [main.css](file:///workspace/css/main.css#L164-L204) (Utility Classes)

### 3. 微动效系统 (Motion System) ✅

| 效果 | 说明 | 类名 |
|-----|------|------|
| 点击反馈 | scale(0.97) 150ms | 全局 button:active |
| 淡入动画 | 上移+淡入 | `.fade-in` |
| 滑入动画 | 从下方滑入 | `.slide-up` |
| 缩放动画 | 弹性缩放进入 | `.scale-in` |
| 呼吸动画 | 2s循环闪烁 | `.pulse` |
| 全局过渡 | 所有按钮统一过渡 | button, [role="button"] |

**文件**: [main.css](file:///workspace/css/main.css#L206-L239) (Motion System)

### 4. 性能优化 ✅

| 优化项 | 说明 | 影响元素 |
|-------|------|---------|
| contain: layout paint | 隔离重绘区域 | .habit-card, .stat-card, .lib-item |
| will-change: transform | 提前声明变化属性 | 同上 |
| GPU加速动画 | translateZ(0) 开启硬件加速 | .animate-transform |
| 统一过渡属性 | 只过渡transform/box-shadow/background-color/opacity | 所有按钮 |

**文件**: [main.css](file:///workspace/css/main.css#L241-L249) (Performance)

### 5. 可访问性优化 ✅

| 优化项 | 说明 |
|-------|------|
| prefers-reduced-motion | 尊重系统减少动效设置 |
| :focus-visible | 键盘焦点可见样式 |
| .sr-only | 屏幕阅读器专用隐藏类 |
| 语义化HTML | 使用正确的button/nav/section标签 |

**文件**: [main.css](file:///workspace/css/main.css#L251-L287) (Accessibility)

### 6. 暗色模式深化 ✅

| 优化项 | 说明 |
|-------|------|
| 完整色阶 | accent-50~900 暗色版 |
| 三级背景 | --bg / --bg2 / --surface / --surface-variant |
| 语义色暗色版 | success/warning/danger/info |
| 系统跟随 | `prefers-color-scheme` 自动检测 |
| 用户优先 | localStorage 手动设置优先级更高 |

**文件**: 
- [main.css](file:///workspace/css/main.css#L2523-L2591) (Dark Mode)
- [main.js](file:///workspace/js/main.js#L2-L24) (Dark Mode Init)

---

## 相关文件

| 文件 | 说明 |
|-----|------|
| css/main.css | 主样式文件，包含所有皮肤样式定义、设计令牌、工具类、动效系统 |
| css/components.css | UI组件库样式 |
| js/ui/panels.js | 皮肤系统配置与切换逻辑 |
| js/ui/components.js | UI组件创建函数 |
| js/ui/render.js | 页面渲染函数 |
| js/main.js | 应用入口，暗色模式初始化 |
| docs/skin-component-mapping.md | 本文档 |
