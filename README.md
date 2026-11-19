# Antigravity Token & Cache Monitor (`token-monitor`)

一个用于 **Antigravity 2.0** 的 Sidecar UI 面板插件（`v2.0.0`），直接解析本地 `~/.gemini/antigravity/brain/<conversationId>/.system_generated/logs/transcript.jsonl`，实时展示全局与单会话的 Token 消耗、Prompt 缓存命中率、每日趋势图以及分模型参考费用。

## 主要功能

- **全局概览 & 单会话步骤明细**
  - 按「全部 / 今天 / 昨天 / 近 7 天 / 自定义日期」筛选统计。
  - 展示总输入、缓存命中（Cache Read）、生成输出、整体命中率与每日柱状趋势图。
  - 对话列表支持关键词搜索、按总用量 / 最近时间 / 预估费用 / 命中率排序，以及按模型筛选。
  - 单会话视图展示每一步的轮次、识别模型、输入 / 缓存 / 输出、命中率与单步估算费用。
- **多模型目录与分期/阶梯费率（`sidecars/panel/pricing.mjs`）**
  - 支持 **Gemini 4**（Neon / Argon / Carbon / Hydrogen，含 Orchestrator 规划轮与 Worker 执行轮识别）、**Gemini 3.x / 2.5**（3.8 Flash / 3.5 Flash-Lite / 3.1 Pro / 2.5 Pro）、**Claude**（Opus 5.5 / Sonnet 5.5 / Opus 4.6 / Sonnet 4.x）与 **GPT-OSS 120B**。
  - 支持按生效日期自动切换调价费率，以及 `>200K` 上下文高阶梯费率；也支持切换统一指定模型折算及自定义 USD/CNY 汇率。
- **增量解析缓存**
  - 后端基于日志文件的 `mtimeMs + size` 维护内存增量缓存，刷新面板响应更快。

## 环境要求

1. **Antigravity**（带 Sidecar UI 面板支持）。
2. **Node.js**（已加入系统 `PATH`，用于通过 `node main.mjs` 启动 Sidecar 后端）。
3. **无需 `npm install`**：`sidecar_sdk` 由 Antigravity 运行时自动提供，插件目录不依赖第三方 `node_modules`。

## 安装方法

### 方式一：`git clone` 到全局插件目录（推荐）

将仓库克隆到 Antigravity 的全局 `plugins/token-monitor` 目录（目录名建议保持为 `token-monitor`）：

**Windows (PowerShell):**
```powershell
git clone https://github.com/x1051445024/antigravity-token-monitor.git "$env:USERPROFILE\.gemini\config\plugins\token-monitor"
```

**macOS / Linux:**
```bash
git clone https://github.com/x1051445024/antigravity-token-monitor.git ~/.gemini/config/plugins/token-monitor
```

### 方式二：下载 ZIP 压缩包手动安装

1. 在仓库页面点击 **Code ➔ Download ZIP** 并解压。
2. 将解压后的目录重命名为 `token-monitor`（确保该目录下直接包含 `plugin.json`，不要多套一层目录）。
3. 放到全局插件目录：
   - **Windows**: `C:\Users\<你的用户名>\.gemini\config\plugins\token-monitor\`
   - **macOS / Linux**: `~/.gemini/config/plugins/token-monitor/`

### 方式三：项目内团队共享

如果希望只在某个 Git 项目内生效，可将插件目录放到该项目的 `.agents/plugins/token-monitor/` 下提交到仓库，协作者拉取项目后会自动发现。

## 启用与更新

1. **启用插件**：安装完成后重启 Antigravity（或进入左侧 **Customizations ➔ Plugins** 确认 `token-monitor` 已开启），即可在右侧辅助面板打开 **Token Monitor**（也可在对话中让 Agent 输出 `[Token Monitor](sidecar://token-monitor/panel/)` 入口）。
2. **更新插件**：在插件目录执行 `git pull`，然后在 **Customizations ➔ Plugins** 中将 `token-monitor` **禁用后再重新启用**（或重启 Antigravity），让新版 `main.mjs` 后端重新加载生效。

## 目录结构

```text
token-monitor/
├── plugin.json                 # 插件清单
├── README.md                   # 说明文档
├── assets/
│   └── logo.svg                # 插件图标
└── sidecars/
    └── panel/
        ├── sidecar.json        # Sidecar 启动与 AUX_PANE 视图配置
        ├── package.json        # ESM 模块声明
        ├── main.mjs            # Node.js 后端与日志解析 API
        ├── pricing.mjs         # 模型归一化与费率目录
        ├── index.html          # 面板页面结构
        ├── app.js              # 前端交互与图表渲染
        └── styles.css          # 面板样式
```
