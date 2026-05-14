# Feature Specification: daily-news-agent

**Feature Directory**: `specs/daily-news-agent`
**Created**: 2026-05-11
**Status**: Draft

---

## Clarification Log (Auto-resolved via Stage 1 preferences)

The following ambiguities were identified during speckit-clarify and resolved using the author's stated preferences. Answers are fused into the relevant sections below.

| # | Question | Resolution |
|---|----------|-----------|
| CL-01 | What happens when a fetch source fails? | Skip that source; continue with others. After 3 consecutive failures on the same source, write a WARN-level log entry. Never abort the entire digest run. |
| CL-02 | What happens when LLM summarisation fails? | Retry once. If still failing, downgrade: output raw title list (no summaries). Do not push an empty digest. |
| CL-03 | What happens when WeChat delivery fails? | Retry 3 times with exponential backoff (1 s / 3 s / 10 s). If all retries fail, persist failure state to `daily_news` table; expose for manual re-push next session. Does not block the next day's run. |
| CL-04 | How are the 5 stories selected? | Combined rank: HN points (50%) + Claude judgment on AI/engineering relevance (50%). Scoring logic lives in the LLM prompt; no separate model call or ML ranking layer. |
| CL-05 | Where and how are RSS sources configured? | Hardcoded in `src/modules/daily-news/config.ts`. MVP ships with 3 stable sources: AI Weekly, The Rundown AI, InfoQ AI. Source list moves to agent-group config file in v2. |
| CL-06 | How is deduplication handled? | URL exact-match only; implemented via short hash comparison. No fuzzy/semantic deduplication in MVP. Claude's selection handles semantic near-duplicates implicitly. |
| CL-07 | What is sent when there are 0 qualifying stories? | Push the fixed string: `"今日 AI 工程领域无显著动态，明日 9:00 再见"`. Maintains daily rhythm; never silent. |
| CL-08 | Which timezone, and is it hardcoded? | `Asia/Shanghai`, hardcoded throughout. No user-configurable timezone in MVP. |
| CL-09 | What happens on first startup? | Do NOT trigger immediately. Wait for the next 09:00 Asia/Shanghai wall-clock tick. Prevents accidental pushes during development. |
| CL-10 | What persistence granularity? | One DB row per news item (id / date / source / title / summary / url / pushed_at). Raw HTML and RSS feed body are NOT stored. |

---

## Project Meta

| Field | Value |
|-------|-------|
| Project name | daily-news-agent |
| Parent project | NanoClaw fork |
| Agent group | `cli-with-muyu` (id: `ag-1778127817315-jlhkmo`, assistantName: "Andy") |
| New code path | `src/modules/daily-news/` |
| Pre-requisite skill | `/add-wechat` (must install `src/channels/wechat.ts` from `channels` branch first) |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Automated Daily Digest Delivery (Priority: P1)

Every day at 09:00 Beijing time, the agent automatically collects yesterday's AI engineering news from HackerNews and pre-configured RSS sources, selects the 5 most relevant stories, generates a structured Chinese-language summary, and pushes it to the WeChat group associated with `cli-with-muyu` — all without any human action.

**Why this priority**: This is the entire value proposition. Without it, nothing else matters.

**Independent Test**: Trigger the scheduled task manually; verify a properly formatted WeChat message with 5 Chinese-summarised news items arrives in the group within 60 seconds.

**Acceptance Scenarios**:

1. **Given** the agent is running and the scheduled task is active, **when** 09:00 Asia/Shanghai time is reached, **then** the agent fetches news, summarises 5 items in Chinese, and delivers to the WeChat group within 60 seconds.
2. **Given** the digest has been delivered, **when** the delivery log is inspected, **then** a `daily_news` record exists per item with date, source, title, summary, url, and pushed_at fields populated.
3. **Given** the host service is started for the first time, **when** startup completes before 09:00, **then** no digest is pushed until the next 09:00 tick (no immediate trigger on startup).

---

### User Story 2 — Partial Delivery on Source Failure (Priority: P2)

When one of the configured news sources (HackerNews API or an RSS feed) is unreachable or returns an error, the agent skips that source and still attempts to deliver a digest from the remaining sources.

**Why this priority**: Silent failure would leave the user with no news and no indication of a problem; a partial digest is far preferable.

**Independent Test**: Simulate a failing RSS source; verify the agent still delivers items from the other source(s) and logs the skip.

**Acceptance Scenarios**:

1. **Given** an RSS source is unreachable, **when** the scheduled task triggers, **then** the agent retries up to 3 times, logs a WARN entry for that source, skips it, and proceeds with the remaining sources.
2. **Given** all sources fail, **when** the scheduled task triggers, **then** the agent delivers a message to the WeChat group indicating no news was retrievable today (no silent failure).

---

### User Story 3 — Long Digest Auto-Split (Priority: P3)

When the 5-item digest exceeds the WeChat single-message length limit, the agent automatically splits it into 2 messages with no content loss.

**Why this priority**: A truncated message is worse than two shorter messages; this is a correctness constraint.

**Independent Test**: Force a digest that exceeds 500 characters; verify 2 sequential WeChat messages arrive with all 5 items split cleanly between them.

**Acceptance Scenarios**:

1. **Given** a generated digest is ≤ 500 characters, **when** it is sent to WeChat, **then** exactly 1 message is delivered.
2. **Given** a generated digest exceeds 500 characters, **when** it is sent to WeChat, **then** exactly 2 messages are delivered with all 5 items split across them and no item truncated.

---

### Edge Cases

- **Zero qualifying stories** (e.g. holiday weekend with no relevant HN posts): Agent pushes the fixed message `"今日 AI 工程领域无显著动态，明日 9:00 再见"`. No crash; daily rhythm preserved. (CL-07)
- **LLM summarisation failure**: Agent retries once. If retry also fails, downgrades to a raw title list (no summaries). Pushes the degraded digest rather than nothing. (CL-02)
- **WeChat delivery failure**: Agent retries 3 times with exponential backoff (1 s → 3 s → 10 s). On total failure, persists failure flag in `daily_news` table for manual re-push; next day's run is unaffected. (CL-03)
- **WeChat session token expired**: Delivery fails after retries; error is logged. User must re-authenticate via the iLink app (known recovery path: `data/wechat/auth.json` re-scan). (CL-03)
- **Duplicate stories across sources**: URL exact-match hash deduplication runs before LLM selection. Claude's relevance judgment handles semantic near-duplicates. No fuzzy matching. (CL-06)
- **Claude summary exceeds per-item limit**: Prompt instructs Claude to keep each item ≤ 50 Chinese characters; if output still exceeds limit, truncate at character boundary before sending.
- **Scheduled task fires but host service is not running**: Task is simply not triggered; it fires at the next 09:00 after service restart (sweep-based, no catch-up). (CL-09)

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically trigger a news-collection-and-delivery workflow at 09:00 Asia/Shanghai (hardcoded) every calendar day without manual action. On first startup, the task MUST NOT fire immediately — it waits for the next 09:00 tick. (CL-08, CL-09)
- **FR-002**: The system MUST fetch AI engineering stories published during the previous calendar day from the HackerNews public search API using query parameters that filter by date. "Yesterday" is determined by wall-clock date in Asia/Shanghai at task-fire time.
- **FR-003**: The system MUST fetch articles from exactly 3 pre-configured RSS sources hardcoded in `src/modules/daily-news/config.ts`: **AI Weekly**, **The Rundown AI**, and **InfoQ AI**. These URLs are not user-changeable in MVP. (CL-05)
- **FR-004**: Before LLM selection, the system MUST deduplicate fetched stories by URL exact-match (short hash). After deduplication, the system MUST select exactly 5 stories using a combined score: HN points rank (50% weight) + Claude judgment on AI/ML/LLM/engineering relevance (50% weight), controlled entirely via the summarisation prompt. (CL-04, CL-06)
- **FR-005**: For each selected story, the system MUST generate a Chinese-language structured entry containing: headline (adapted to Chinese), a 1–2 sentence summary (≤ 50 Chinese characters), and the original source URL.
- **FR-006**: The system MUST deliver the complete 5-story digest to the WeChat group wired to the `cli-with-muyu` agent group.
- **FR-007**: If any individual news source fails after 3 retry attempts, the system MUST log a WARN-level entry for that source, skip it, and continue with the remaining sources without aborting the full run. (CL-01)
- **FR-008**: If the LLM summarisation step fails, the system MUST retry once. If the retry also fails, the system MUST downgrade to delivering a raw title list (no Claude summaries) rather than sending nothing. (CL-02)
- **FR-009**: WeChat delivery MUST be retried up to 3 times on failure using exponential backoff (1 s / 3 s / 10 s). On total delivery failure, the system MUST persist a failure record in `daily_news`; the next day's scheduled run MUST NOT be affected. (CL-03)
- **FR-010**: If 0 qualifying stories remain after fetching and deduplication, the system MUST push the fixed string `"今日 AI 工程领域无显著动态，明日 9:00 再见"` to the WeChat group. (CL-07)
- **FR-011**: If the full digest exceeds 500 characters, the system MUST split it into exactly 2 sequential WeChat messages with no item truncated mid-text.
- **FR-012**: The system MUST persist each delivery attempt as one record per news item in the `daily_news` table. Raw HTML and RSS feed body MUST NOT be stored. (CL-10)

### Key Entities

- **DailyDigest**: A dated collection of exactly 5 AI-engineering news items for a given calendar day, paired with a delivery status.
- **NewsItem**: One story with headline, Chinese summary (≤ 50 chars), source URL, and origin label (HackerNews or RSS feed name).
- **DeliveryRecord**: An audit entry per item pushed: id / date / source / title / summary / url / pushed_at. No raw feed content. (CL-10)

---

## Non-Functional Requirements

- **Timing precision**: Digest delivered within 60 seconds of 09:00 Asia/Shanghai (acceptable given the 60-second sweep cadence).
- **Fetch reliability**: Per-source retry budget of 3 attempts (CL-01); total combined fetch time capped so delivery completes well before 09:05.
- **Delivery reliability**: WeChat retry budget of 3 attempts with exponential backoff 1 s / 3 s / 10 s (CL-03).
- **Summary token budget**: Claude input ≤ 4,000 tokens; Claude output ≤ 1,000 tokens per digest run.
- **Message length**: Per-item summary ≤ 50 Chinese characters; total 5-item digest ≤ 500 characters before split logic.
- **LLM boundary**: Summarisation performed entirely by the container-internal Claude agent. No external LLM API calls introduced.
- **Test coverage**: Every module in `src/modules/daily-news/` must have a corresponding vitest test file written before the implementation (strict TDD).

---

## NanoClaw Integration Constraints

These are binding architectural decisions grounded in the confirmed NanoClaw capabilities (see brainstorming §0).

| Concern | Constraint |
|---------|-----------|
| **Scheduling** | Use `schedule_task` MCP tool with `recurrence: "0 9 * * *"` and `timezone: "Asia/Shanghai"` (hardcoded, CL-08). Do NOT introduce an external cron daemon. Do NOT modify the `schedule` section of any CLAUDE.md. First-startup behavior: task does NOT fire immediately (CL-09). |
| **WeChat push** | Use the `add-wechat` channel (iLink Bot API, `wechat-ilink-client@0.1.0`). **Pre-requisite**: `/add-wechat` skill must be run first to copy `src/channels/wechat.ts` from the `channels` branch and wire its import. |
| **LLM summarisation** | Container-internal Claude (the agent itself) performs all summarisation. No `anthropic` SDK calls; no separate API key management. On failure: retry once, then downgrade to raw title list (CL-02). |
| **RSS config** | 3 sources hardcoded in `src/modules/daily-news/config.ts`: AI Weekly, The Rundown AI, InfoQ AI. Not user-configurable in MVP; moves to group config in v2. (CL-05) |
| **Deduplication** | URL exact-match via short hash before LLM selection. No fuzzy matching. (CL-06) |
| **Data persistence** | Extend the session SQLite DB with a new `daily_news` table. Schema: `id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, source TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, url TEXT NOT NULL, pushed_at TEXT NOT NULL`. One row per item; no raw HTML/RSS body stored. (CL-10) |
| **Code placement** | All new files under `src/modules/daily-news/`. No new files at the repository root. |
| **Agent group scope** | Scheduled task is created inside the `cli-with-muyu` session context. The `module-scheduling` fragment is already mounted in that group's CLAUDE.md. |

---

## Out of Scope (MVP)

The following are explicitly excluded from this specification. Do not add them during planning or implementation without a separate spec update.

1. **WeChat public account (公众号) scraping** — no official API; ban risk unacceptable.
2. **Cross-source fuzzy/semantic deduplication** — URL exact-match hash only; no vector database or similarity index. (CL-06)
3. **RSS source management UI or CRUD** — the 3 RSS URLs are hardcoded in `config.ts`; no user-facing management interface. (CL-05)
4. **Historical archive or searchable knowledge base** — the audit table (`daily_news`) exists for operational debugging only, not user search.
5. **Multi-channel delivery** (Feishu, Slack, email, etc.) — WeChat only in v1.
6. **Catch-up delivery for missed days** — if the host was down at 09:00, no retroactive digest is generated. (CL-09)
7. **User-configurable news topics or keywords** — topic filter ("AI engineering relevant") is fixed in the prompt, not user-adjustable.
8. **User-configurable timezone** — Asia/Shanghai hardcoded throughout. (CL-08)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The digest is delivered to the WeChat group by no later than 09:01 Asia/Shanghai on every day the host service is running.
- **SC-002**: At least 4 of 5 items in each digest are verifiably related to AI/ML/LLM/engineering tooling (validated by spot check of 5 consecutive daily runs).
- **SC-003**: Every delivered item is in Chinese and contains all three required fields: headline, 1–2 sentence summary, and source URL.
- **SC-004**: When any single source is unavailable, the system delivers a non-empty digest or an explicit "no-news" notification — it never fails silently.
- **SC-005**: No WeChat message is truncated; if the digest exceeds the length limit, it arrives as 2 complete messages with all 5 items.
- **SC-006**: A `daily_news` DB record (one row per item) exists for every successfully pushed item within 5 minutes of delivery.
- **SC-007**: When WeChat delivery fails after all retries, a failure record exists in `daily_news` and the next day's scheduled run fires normally. (CL-03)
- **SC-008**: On first service startup (before any 09:00 tick), no digest is pushed. (CL-09)

---

## Assumptions

- The NanoClaw host service (launchd on macOS / systemd on Linux) is running and healthy at 09:00 Asia/Shanghai; no catch-up logic is provided for missed triggers.
- The `/add-wechat` skill has been executed and the WeChat iLink session is authenticated (valid `data/wechat/auth.json`) before the first scheduled run.
- The HackerNews Algolia API (`https://hn.algolia.com/api/v1/search_by_date`) is publicly accessible without authentication.
- The 3 RSS sources (AI Weekly, The Rundown AI, InfoQ AI) are stable, publicly accessible, well-formed Atom/RSS feeds that do not require authentication. (CL-05)
- "Yesterday" is determined by wall-clock date in Asia/Shanghai at the moment the scheduled task fires. (CL-08)
- The `cli-with-muyu` agent group's `module-scheduling` fragment remains mounted (confirmed active in brainstorming exploration).
- Daily volume (1 fetch + 1 WeChat push per day) is well within HackerNews API and WeChat iLink rate limits.
