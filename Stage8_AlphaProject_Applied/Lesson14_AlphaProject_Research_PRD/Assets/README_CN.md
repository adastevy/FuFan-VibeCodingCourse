# Lesson 14 课程资产

<div align="center">

[English](./README.md) | 中文

</div>

AlphaProject 全程使用的课程资产 —— Claude Code 技能、MCP 服务、以及编辑器配置预设，共同支撑「调研 → PRD」工作流。

## 技能（Skills）

将每个文件夹放入本地 `.claude/skills/` 即可安装使用。

| 技能 | 用途 |
|------|------|
| [`skills/prd-writer/`](./skills/prd-writer/) | 从结构化意图生成生产级 PRD —— 含 `SKILL.md`、references、evals |
| [`skills/product-research-kickoff/`](./skills/product-research-kickoff/) | 启动深度产品调研 —— 竞品全景、目标用户、待办任务（JTBD）|
| [`skills/speckit-design-injection/`](./skills/speckit-design-injection/) | 将设计意图注入 Spec-Kit 工作流，让 spec 真正反映具体的 UI/UX 决策 |
| [`skills/adversarial-architecture-selection/`](./skills/adversarial-architecture-selection/) | 多视角对抗式架构评审与选型 |

## MCP 服务

| 服务 | 用途 |
|------|------|
| [`mcp/muyu-search-mcp/`](./mcp/muyu-search-mcp/) | 多源 Web 搜索 MCP 服务（Python）。通过 `pyproject.toml` 配置；详见目录内 `README.md` |

## 配置文件

| 文件 | 用途 |
|------|------|
| [`configs/claude-hud-config.json`](./configs/claude-hud-config.json) | 推荐的 `claude-hud` 状态栏预设 —— 展示 cost / duration / tokens / todos / agents / tools |

## 相关

- [← 返回 Lesson 14](../README_CN.md)
