# Lesson 12: Superpowers Getting Started — TDD-Driven Development

<div align="center">

English | [中文](./README_CN.md)

</div>

This lesson introduces the Superpowers framework — a TDD-first specification-driven methodology — and walks through the NanoClaw Dashboard starter project as a hands-on showcase.

## Topics

- The three frameworks of AI-driven development: OpenSpec → Spec-Kit → Superpowers
- Superpowers TDD core principles
- Specification-driven test-first workflow
- NanoClaw Dashboard: SaaS-grade dark dashboard from scratch

## Course Materials

- [10-Superpowers基础入门.pdf](./CourseWare/10-Superpowers基础入门.pdf)
- [10-Superpowers基础入门.excalidraw](./CourseWare/10-Superpowers基础入门.excalidraw)
- [10_Superwers项目案例.excalidraw](./CourseWare/10_Superwers项目案例.excalidraw)

## Project Assets

### Frontend (v1) — `nanoclaw-dashboard/` (v1.0.0)

SaaS-grade dark dashboard — entry-point version.

- Tech stack: `Node.js (built-in)` `Vanilla JS` `inline CSS`
- Highlights:
  - Independent project (no NanoClaw fork pollution)
  - Zero external dependencies (~1500 lines inline CSS+JS)
  - Decoupled from backend via `NANOCLAW_ROOT` env var
  - Live demo: floating button → spawns `pnpm run chat` → talks to Andy
- Scope (intentional YAGNI):
  - All data is mocked (4 stat cards, agent list, workflow, logs, security panel)
  - The A0 case section will be rewritten as Next.js 14 + Tailwind with real APIs (upgraded to v2.0.0 later)

### Frontend (v2) — [`nanoclaw-dashboard-v2/`](./nanoclaw-dashboard-v2/) (v0.2.1)

Next.js production rewrite of the dashboard — Phase 1 + critical security patches.

- Tech stack: `Next.js` `TypeScript` `Tailwind CSS` `Vitest`
- Highlights:
  - 5-state panel machine (closed / open / sending / received / error) with 42 TDD tests
  - Wired `/api/chat` route to the NanoClaw backend contract
  - Surfaces error state with retry / dismiss
- Run: `pnpm install && pnpm dev` (requires backend running locally)

### Backend — [`nanoclaw-v2-backend/`](./nanoclaw-v2-backend/)

NanoClaw v2 backend (full source) — the CLI runtime that the dashboard talks to via `pnpm run chat`.

- Includes `.claude/`, `.superpowers/`, `.omc/` AI workflow configurations
- `node_modules/`, `dist/`, `logs/`, `data/`, `.env`, `.git/` are excluded
- Copy `.env.example` to `.env` and fill in your own configuration before running
- Point the dashboard's `NANOCLAW_ROOT` env var to this folder when running locally

## About `.excalidraw` Files

The `.excalidraw` files are the **original editable courseware**. You can modify and customize them as needed.

**How to Open:**

1. Visit [https://excalidraw.com/](https://excalidraw.com/) (VPN required)
2. Click the menu icon (☰) → **Open** (Ctrl+O)
3. Select the `.excalidraw` file from your local drive

## Related

- [← Back to Stage 7](../README.md)
