# 知识日报 Agent · Brainstorming

## 0. NanoClaw 能力探查结论（事实依据）

### 探查路径与结论

| 路径 | 状态 | 关键发现 |
|------|------|---------|
| `groups/cli-with-muyu/` | ✅ 存在 | agent group id = `ag-1778127817315-jlhkmo`，assistantName = "Andy"，skills = "all"，无额外 npm/apt 包 |
| `groups/cli-with-muyu/CLAUDE.md` | ✅ 存在 | 由 composed fragments 构成，包含 `module-scheduling.md` —— **调度能力已挂载** |
| `.claude/skills/add-wechat/SKILL.md` | ✅ 存在 | iLink Bot API，官方 Tencent 长轮询，无 webhook 需求，`wechat-ilink-client@0.1.0` |
| `src/modules/scheduling/` | ✅ 存在 | 完整的 `schedule_task` / `cancel_task` / recurrence 体系，cron 表达式 + TIMEZONE 支持，基于 `messages_in` 表（`kind='task'`） |
| `src/modules/scheduling/recurrence.ts` | ✅ 存在 | 用 `cron-parser` 解析 cron，60s sweep tick 触发 recurrence 插入，支持 IANA timezone |
| `container/agent-runner/src/mcp-tools/scheduling.ts` | ✅ 存在 | Agent 侧 MCP 工具，容器内 Claude 可直接调用 `schedule_task` 创建定时任务 |

### 关键结论

1. **调度能力完全就绪**：cli-with-muyu group 已挂载 `module-scheduling`，agent 可通过 MCP 工具 `schedule_task` 设置带 recurrence 的 cron 任务（如 `0 9 * * *`），host 的 60s sweep 会自动触发下次执行。这意味着**不需要外部 cron**。

2. **WeChat 推送就绪但需安装**：`add-wechat` skill 存在，但 `src/channels/wechat.ts` 需要从 `channels` branch 复制安装。使用 iLink Bot API，个人微信账号，无 ToS 风险。

3. **容器内 Claude 是 Agent 本体**：container/agent-runner 运行 Claude，LLM 摘要直接在容器内完成，无需额外调 Claude API。

---

## 1. 核心价值主张

**一句话**：每天早上 9 点，自动抓取昨日 AI 工程领域 5 条精华新闻，由 Claude 结构化摘要，通过 NanoClaw 直推到微信群。

**用户场景**：九天老师每天 9 点前打开手机看到一条微信消息，内含「昨日 5 条 AI 工程大事」——每条有标题、1-2 句摘要、来源链接——直接转发团队群，无需手动筛选、翻译或整理。

**本质价值**：信息降噪 + 零操作分发。Agent 处理"信息过载"这个痛点，人只做最后一步"转发"决策。

---

## 2. 实现路径决策

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| **抓取源** | HN+RSS / +微信公众号 | **HN API + RSS（不加公众号）** | HN API 官方稳定无反爬风险；RSS 覆盖 The Verge/InfoQ 等主流源可扩展；微信公众号无官方 API，所有抓取方案均有封号风险，MVP 排除 |
| **LLM 摘要** | 直调 Claude API / NanoClaw 容器内 Claude | **NanoClaw 容器内 Claude（已有 Agent）** | 容器内 Claude 即 Agent 本体，天然可用；直调 Claude API 需额外管理密钥注入，增加复杂度；且容器内有完整工具链（fetch/MCP）|
| **推送渠道** | add-wechat / 自集成飞书 webhook | **add-wechat（已有 skill）** | 九天老师明确偏好微信推到团队群；skill 已存在且官方 API；飞书 webhook 虽更简单但不符合"直接转发微信群"场景 |
| **调度机制** | NanoClaw scheduled tasks / 系统 cron | **NanoClaw scheduled tasks（`schedule_task` MCP）** | 探查确认 cli-with-muyu group 已挂载 `module-scheduling`；agent 可自助创建 recurrence 任务；cron 表达式 + TIMEZONE 支持 09:00 本地时间触发；无需额外基础设施 |
| **抓取执行** | Agent 直接 fetch / 独立抓取脚本 | **Agent 直接 fetch via MCP** | 容器有 agent-browser / fetch 能力；保持单体架构，无需维护额外脚本；抓取逻辑写在 prompt 里可迭代 |

**九天老师选择了"HN+RSS → 容器内 Claude → add-wechat → NanoClaw scheduled"这条路**，因为它最大化复用已有基础设施，MVP 最短路径，且每个决策点都有明确的 NanoClaw 能力支撑。

---

## 3. 失败模式预判

| # | 失败模式 | 严重度 | 已知缓解策略 |
|---|---------|--------|------------|
| 1 | **HN API 无内容/超时** | 中 | HN API 极稳定（Firebase REST）；加 3s timeout + retry 1 次；降级返回"今日 HN 暂不可达，跳过" |
| 2 | **RSS 源格式不规则（namespace 缺失/日期格式奇怪）** | 中 | 用宽松 RSS 解析库（rss-parser）；对解析失败的条目 skip 而非 crash；MVP 只用 2-3 个已知稳定的 RSS 源 |
| 3 | **Claude 摘要质量不稳（重复/太长/英文不翻译）** | 中 | Prompt 明确要求：中文、每条 ≤ 50 字、标题+摘要+来源格式化；加 few-shot 示例；v2 再迭代 prompt |
| 4 | **WeChat iLink 限流 / 连接断开** | 中 | 日报每天 1 条，远低于正常限流阈值；session expiry 重新扫码是已知恢复路径（`data/wechat/auth.json`） |
| 5 | **scheduled task 在 9:00 未触发（sweep 60s 精度）** | 低 | NanoClaw sweep 是 60s 周期，最晚 9:01 触发；可接受；需确保 host 服务存活（launchd/systemd 守护） |
| 6 | **Agent 生成的微信消息超过 WeChat 单条长度限制** | 低 | 限制 Claude 输出总 token（`max_tokens` 约 500）；5 条新闻控制在 500 字以内；超限分 2 条发 |
| 7 | **抓取到非 AI 工程相关内容（HN 混杂噪声）** | 中 | Prompt 里加"只选 AI/ML/LLM/工程工具相关"过滤指令；Claude 判断比 keyword filter 鲁棒 |

---

## 4. MVP 边界

### 做什么（第一版）

1. 用 NanoClaw `schedule_task` MCP 在 cli-with-muyu group 里创建一个 `recurrence: "0 9 * * *"` 的定时任务
2. 任务触发时，agent 调用 HackerNews Algolia API 抓取昨日 Top Stories（`tags=story&hitsPerPage=30&numericFilters=created_at_i>yesterday`）
3. 同时抓取 1-2 个预定义 RSS 源（如 AI Weekly、The Rundown AI）
4. 将抓取结果交给 Claude 提炼「AI 工程领域值得关注的 5 条」，生成结构化中文摘要（标题 + 1-2 句 + 来源 URL）
5. 通过已安装的 `add-wechat` 频道将摘要推送到指定微信群

### 不做什么（明确划线）

1. **不做微信公众号抓取**——无官方 API，封号风险，MVP 排除
2. **不做复杂去重逻辑**——跨源同一新闻重复出现，MVP 靠 Claude 判断去重，不上向量数据库
3. **不做订阅管理 UI**——RSS 源列表硬编码在 prompt 或配置文件，不做 CRUD 界面
4. **不做历史归档/搜索**——日报只推不存，不建知识库
5. **不做多渠道推送**——只推微信，飞书/Slack 等留给后续

---

## 5. Brainstorming → Spec 切入点检验

**切入点已就绪。**

所有关键决策均有 NanoClaw 真实能力支撑（探查结论第 0 节）：调度模块已挂载、WeChat skill 存在、容器内 Claude 是 Agent 本体。九天老师的 MVP 边界清晰（5 条新闻、固定 9 点、add-wechat 推送），实现路径中无"待调研"的未知项。

下一步可直接进 **spec**：明确 HN API 查询参数、RSS 源列表、prompt 模板、WeChat 群 `platform_id` 配置方式、`schedule_task` 调用方式。
