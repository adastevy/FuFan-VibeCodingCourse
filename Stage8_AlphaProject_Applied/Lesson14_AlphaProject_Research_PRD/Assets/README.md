# Lesson 14 Assets

<div align="center">

English | [中文](./README_CN.md)

</div>

Course assets used throughout AlphaProject — Claude Code skills, an MCP server, and editor config presets that power the research-to-PRD workflow.

## Skills

Drop each folder under your local `.claude/skills/` to install.

| Skill | Purpose |
|-------|---------|
| [`skills/prd-writer/`](./skills/prd-writer/) | Generate production-grade PRDs from structured intent — bundled with `SKILL.md`, references, and evals |
| [`skills/product-research-kickoff/`](./skills/product-research-kickoff/) | Kick off deep product research — competitive landscape, target users, jobs-to-be-done |
| [`skills/speckit-design-injection/`](./skills/speckit-design-injection/) | Inject design intent into Spec-Kit workflows so specs reflect concrete UI/UX decisions |
| [`skills/adversarial-architecture-selection/`](./skills/adversarial-architecture-selection/) | Adversarial multi-perspective architecture review and selection |

## MCP Servers

| Server | Purpose |
|--------|---------|
| [`mcp/muyu-search-mcp/`](./mcp/muyu-search-mcp/) | Multi-provider web search MCP server (Python). Configure via `pyproject.toml`; see its `README.md` for setup |

## Configs

| File | Purpose |
|------|---------|
| [`configs/claude-hud-config.json`](./configs/claude-hud-config.json) | Recommended `claude-hud` statusline preset — surfaces cost, duration, tokens, todos, agents, and tools |

## Related

- [← Back to Lesson 14](../README.md)
