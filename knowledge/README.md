# 养生知识库

本目录存放 AI 养生顾问的知识库源文件，用于构建 `kb-mcp-server` 可加载的向量知识库。

## 目录结构

```
knowledge/
├── README.md           # 本说明
└── classics/           # 24 部养生经典著作摘要
    ├── 黄帝内经.md
    ├── 遵生八笺.md
    ├── 老老恒言.md
    ├── 饮膳正要.md
    ├── 养生论.md
    ├── 寿世青编.md
    ├── 备急千金要方·养性.md
    ├── 抱朴子.md
    ├── 闲情偶寄.md
    ├── 你是你吃出来的.md
    ├── 九种体质养生全书.md
    ├── 科学休息.md
    ├── 求医不如求己.md
    ├── 拉伸.md
    ├── 人体运动生理学.md
    ├── 高级运动营养学.md
    ├── 力量训练基础.md
    ├── 运动医学与康复.md
    ├── 睡眠革命.md
    ├── 运动改造大脑.md
    ├── 正念的奇迹.md
    ├── 抗炎生活.md
    ├── 肠子的小心思.md
    └── 深度营养.md
```

## 使用 kb-mcp-server 构建知识库

### 1. 安装

```bash
pip install kb-mcp-server
```

或使用 uv：

```bash
uv pip install kb-mcp-server
```

### 2. 构建索引

```bash
kb-build --input knowledge/classics --output knowledge/kb_index
```

或指定模型：

```bash
kb-build --input knowledge/classics --output knowledge/kb_index --model bge-m3
```

### 3. 本地启动 MCP 服务

```bash
kb-mcp-server --embeddings knowledge/kb_index
```

### 4. 部署到 ModelScope MCP

将 `knowledge/kb_index` 打包为 tar.gz 后，可部署到 ModelScope 创空间或本地运行，
供 `serverless/cloudflare-workers/ai-proxy.js` 中的 `/mcp/knowledge` 路由调用。

## 文件格式

每部著作一个 Markdown 文件，包含 YAML frontmatter：

```yaml
---
title: 书名
author: 作者
dynasty: 朝代/时代
category: 分类
tags: [标签1, 标签2]
---
```

正文包含核心思想、主要观点和养生应用，便于 kb-mcp-server 进行语义检索。
