# Lesson 12: Superpowers 基础入门 · TDD 驱动开发

<div align="center">

[English](./README.md) | 中文

</div>

本课介绍 Superpowers 框架——以 TDD 为核心的规范驱动开发方法论，并通过 NanoClaw Dashboard 起步项目完整体验从规范到落地的全流程。

## 主题

- AI 规范化开发三大框架：OpenSpec → Spec-Kit → Superpowers
- Superpowers TDD 核心原则
- 规范驱动 + 测试优先的工作流
- NanoClaw Dashboard：从零打造 SaaS 级暗色 Dashboard

## 课程资料

- [10-Superpowers基础入门.pdf](./CourseWare/10-Superpowers基础入门.pdf)
- [10-Superpowers基础入门.excalidraw](./CourseWare/10-Superpowers基础入门.excalidraw)
- [10_Superwers项目案例.excalidraw](./CourseWare/10_Superwers项目案例.excalidraw)

## 实战项目

### 前端 v1 —— `nanoclaw-dashboard/`（v1.0.0）

SaaS 级暗色 Dashboard —— 入门段雏形版本。

- 技术栈：`Node.js（原生）` `原生 JS` `内联 CSS`
- 亮点：
  - 独立项目（不污染 NanoClaw fork）
  - 零外部依赖（仅 Node.js built-in，约 1500 行内联 CSS+JS）
  - 通过 `NANOCLAW_ROOT` 环境变量与后端解耦
  - 实跑功能：右下浮层按钮 → spawn `pnpm run chat` → 与 Andy 对话
- 边界（有意 YAGNI）：
  - 数据全部 mock（4 统计卡 / Agent 列表 / 工作流 / 日志 / 安全防线）
  - 后续 A0 案例段会重写为 Next.js 14 + Tailwind + 真接口（届时升级 v2.0.0）

### 前端 v2 —— [`nanoclaw-dashboard-v2/`](./nanoclaw-dashboard-v2/)（v0.2.1）

Next.js 生产版 Dashboard 重写 —— Phase 1 + 关键安全补丁。

- 技术栈：`Next.js` `TypeScript` `Tailwind CSS` `Vitest`
- 亮点：
  - 5 态面板状态机（closed / open / sending / received / error），配套 42 个 TDD 测试
  - `/api/chat` 路由打通 NanoClaw 后端契约
  - 错误状态可重试 / 关闭
- 运行：`pnpm install && pnpm dev`（需要本地后端先启动）

### 后端 —— [`nanoclaw-v2-backend/`](./nanoclaw-v2-backend/)

NanoClaw v2 后端（完整源码）—— Dashboard 通过 `pnpm run chat` 调用的 CLI 运行时。

- 含 `.claude/`、`.superpowers/`、`.omc/` 等 AI 工作流配置
- `node_modules/`、`dist/`、`logs/`、`data/`、`.env`、`.git/` 已从仓库中排除
- 运行前请将 `.env.example` 复制为 `.env` 并填入个人配置
- 本地运行时，将 Dashboard 的 `NANOCLAW_ROOT` 环境变量指向此目录

## 关于 `.excalidraw` 文件

`.excalidraw` 文件是**原始可编辑课件**，你可以根据需要进行修改和定制。

**打开方式：**

1. 访问 [https://excalidraw.com/](https://excalidraw.com/)（需要梯子）
2. 点击菜单图标 (☰) → **打开** (Ctrl+O)
3. 选择本地的 `.excalidraw` 文件

## 相关

- [← 返回阶段七目录](../README_CN.md)
