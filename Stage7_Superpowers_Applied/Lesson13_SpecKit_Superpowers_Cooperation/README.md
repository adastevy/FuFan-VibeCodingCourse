# Lesson 13: Spec-Kit × Superpowers — 9-Step Cooperative Workflow

<div align="center">

English | [中文](./README_CN.md)

</div>

The first session of the Spec-Kit ↔ Superpowers cooperative series. Build a Knowledge-Daily-News Agent as a real production workflow — from intent capture to TDD execution, code review, channel integration, and scheduled delivery.

## Topics

1. **Cooperation Mind-Map** — three integration points and the 9-step collaborative loop
2. **Demand-side vs Execution-side** — "spec is source of truth" × "workflow is source of truth" division of labor
3. **8 Reusable Workflow Rules** — from bare-Claude-Code to a 9-step engineered identity
4. **Hands-on**: `brainstorming` skill — probe requirements, lock MVP + risks + key decisions
5. **Hands-on**: Spec-Kit 4 steps — `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` (12–18 atomic tasks)
6. **Hands-on**: Superpowers 5 steps — worktree isolation + single handoff prompt dispatching 12–18 TDD subagents
7. **Hands-on**: 3-class wire-blocker code review + `finish-branch` merge with tag `v2.1.0-daily-news`
8. **Hands-on**: `add-wechat` channel + `schedule_task` MCP self-registration + closed-loop WeChat delivery + Dashboard surfacing

## Course Materials

- [11_SuperPowers-Spec-kit.pdf](./CourseWare/11_SuperPowers-Spec-kit.pdf)
- [11_SuperPower+Spec-Kit协同开发实战.excalidraw](./CourseWare/11_SuperPower+Spec-Kit协同开发实战.excalidraw)

## Project Assets

Two full project trees backing the live demo — frontend and backend, both ready to clone and run.

### Backend — [`nanoclaw-v2-backend/`](./nanoclaw-v2-backend/)

NanoClaw v2 backend, evolved with the multi-platform content generation pipeline.

- **5 NanoClaw agent groups** under `groups/`: `content-coordinator`, `content-researcher`, `gongzhonghao-writer`, `weibo-writer`, `xiaohongshu-writer` — each ships with its `CLAUDE.local.md` (force-included so students can reproduce the agent ACL)
- **Content-generation module** under `src/modules/content-generation/`: DB migration `015_content_generation.sql`, host-side `writer-interceptor.ts` that persists writer output into `content_articles`
- **Setup script**: `scripts/setup-content-agents.ts` provisions the 5 `agent_groups` rows plus the `agent_destinations` ACL
- AI workflow configs preserved: `.claude/`, `.specify/`, `.superpowers/`, `.omc/`
- Excluded from the repo: `node_modules/`, `dist/`, `logs/`, `data/`, `.env`, `.git/`

### Frontend — [`nanoclaw-dashboard-v2/`](./nanoclaw-dashboard-v2/)

Dashboard with the multi-platform content surfaces wired to the backend.

- **4 API routes** under `app/api/content-generation/`: `trigger`, `list`, `status`, `articles`
- **5 components** under `components/dashboard/`: `content-generation-*`, `content-history`, `content-showcase`
- **2 pages**: `app/(dashboard)/content-generation/page.tsx` plus the `showcase/` portfolio sub-page
- Backend contract typed in `lib/nanoclaw/contract.ts`

### Setup (Reproduce the End-to-End Demo)

```bash
# 1. Backend
cd nanoclaw-v2-backend
pnpm install
cp .env.example .env                  # fill in your own keys
pnpm tsx scripts/setup-content-agents.ts   # create 5 agent_groups + ACL
pnpm run dev

# 2. Frontend (new terminal)
cd nanoclaw-dashboard-v2
pnpm install
pnpm run dev -p 4001                  # open http://localhost:4001

# 3. Trigger a task from the dashboard and watch the 5 agents collaborate end-to-end
```

## About `.excalidraw` Files

The `.excalidraw` files are the **original editable courseware**. You can modify and customize them as needed.

**How to Open:**

1. Visit [https://excalidraw.com/](https://excalidraw.com/) (VPN required)
2. Click the menu icon (☰) → **Open** (Ctrl+O)
3. Select the `.excalidraw` file from your local drive

## Related

- [← Back to Stage 7](../README.md)
