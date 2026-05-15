# Lesson 13: Spec-Kit × Superpowers · 9 步协同首讲

<div align="center">

[English](./README.md) | 中文

</div>

Spec-Kit ↔ Superpowers 协同系列首讲 —— 从零构建「知识日报 Agent」真实工作系统，覆盖意图捕获、TDD 执行、代码评审、渠道接入、定时投递全链路。

## 直播主题

Spec-kit + Superpowers 9 步协同首讲 —— 从零构建知识日报 Agent 真实工作系统

## 直播大纲

1. **协作心智地图** —— Spec-kit ↔ Superpowers 3 个接入点与 9 步协同流程全景
2. **需求侧 vs 执行侧** —— `spec is source of truth` × `workflow is source of truth` 的本质分工
3. **8 条工作流改造法则** —— 从「裸 CC 硬干」到「9 步协同」的工程师身份跃迁
4. **【实战】** `brainstorming` skill 探查需求边界 & 锁定 MVP + 风险 + 关键决策三件套
5. **【实战】** Spec-kit 4 步走完 —— `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks`（12–18 个原子任务）
6. **【实战】** Superpowers 5 步执行 —— worktree 物理隔离 + 一句 handoff prompt 派发 12–18 个 TDD subagent
7. **【实战】** code review 三类 wire blocker 兜底 + `finish-branch` 合并打 tag `v2.1.0-daily-news`
8. **【实战】** `add-wechat` 渠道接入 + `schedule_task` MCP 自助注册定时任务 + 真推 WeChat 闭环 + Dashboard 显形

## 课程资料

- [11_SuperPowers-Spec-kit.pdf](./CourseWare/11_SuperPowers-Spec-kit.pdf)
- [11_SuperPower+Spec-Kit协同开发实战.excalidraw](./CourseWare/11_SuperPower+Spec-Kit协同开发实战.excalidraw)

## 实战项目

直播配套的两份完整工程：前端 + 后端，开箱即可 clone 跑起来。

### 后端 —— [`nanoclaw-v2-backend/`](./nanoclaw-v2-backend/)

NanoClaw v2 后端，升级出多平台内容生成流水线。

- **5 个 NanoClaw agent group**（位于 `groups/`）：`content-coordinator`、`content-researcher`、`gongzhonghao-writer`、`weibo-writer`、`xiaohongshu-writer`，每个目录都带 `CLAUDE.local.md`（强制纳入仓库，保证学员可复现 agent ACL）
- **内容生成模块**（`src/modules/content-generation/`）：DB migration `015_content_generation.sql`、宿主侧 `writer-interceptor.ts`（把 writer 输出落库到 `content_articles`）
- **建表脚本** `scripts/setup-content-agents.ts`：初始化 5 个 `agent_groups` 记录 + `agent_destinations` ACL
- 保留的 AI 工作流配置：`.claude/`、`.specify/`、`.superpowers/`、`.omc/`
- 已从仓库排除：`node_modules/`、`dist/`、`logs/`、`data/`、`.env`、`.git/`

### 前端 —— [`nanoclaw-dashboard-v2/`](./nanoclaw-dashboard-v2/)

Dashboard 加入多平台内容生成相关界面，与后端打通。

- **4 个 API 路由**（`app/api/content-generation/`）：`trigger`、`list`、`status`、`articles`
- **5 个组件**（`components/dashboard/`）：`content-generation-*`、`content-history`、`content-showcase`
- **2 个页面**：`app/(dashboard)/content-generation/page.tsx` + `showcase/` 作品集子页
- 后端契约类型定义：`lib/nanoclaw/contract.ts`

### 启动步骤（复现端到端 Demo）

```bash
# 1. 启动后端
cd nanoclaw-v2-backend
pnpm install
cp .env.example .env                  # 填入自己的 key
pnpm tsx scripts/setup-content-agents.ts   # 创建 5 个 agent_groups + ACL
pnpm run dev

# 2. 启动前端（新开终端）
cd nanoclaw-dashboard-v2
pnpm install
pnpm run dev -p 4001                  # 浏览器打开 http://localhost:4001

# 3. 在 Dashboard 触发一个任务，观察 5 个 agent 协同跑完全链路
```

## 关于 `.excalidraw` 文件

`.excalidraw` 文件是**原始可编辑课件**，你可以根据需要进行修改和定制。

**打开方式：**

1. 访问 [https://excalidraw.com/](https://excalidraw.com/)（需要梯子）
2. 点击菜单图标 (☰) → **打开** (Ctrl+O)
3. 选择本地的 `.excalidraw` 文件

## 相关

- [← 返回阶段七目录](../README_CN.md)
