# Clarify: multi-platform-content

**Step**: spec-kit Step 3
**Created**: 2026-05-13
**Status**: Resolved (no deadlocks — all questions self-resolved with rationale)

---

## 原则

本文件记录 spec.md 中的歧义点、讨论过程、最终拍板决策。所有问题 **自行给出答案**，不留"待确认"状态。若后续决策变更，在此文件更新并同步修改 spec.md 对应 FR。

---

## CL-01 · 触发并发限制：同一时刻能跑几个 task？

**歧义**：用户快速点击两次触发按钮，或在第一个 task 未完成时触发第二个，是允许并发还是拒绝？

**选项分析**：
- 选项 A：允许并发，2 个 task 同时跑 → 优点：响应快；缺点：两组 5 个 Docker 容器同时运行，开发机内存压力 2x，Claude API 并发请求数 6 个（3 Writer × 2），有触达 rate limit 风险
- 选项 B：串行排队（FIFO queue）→ 优点：稳定；缺点：MVP 实现复杂，需要队列状态管理
- 选项 C：拒绝并发（同一时刻最多 1 个 task 执行，第 2 次触发返回 409）→ 优点：实现简单，避免资源争用；缺点：用户需等上一个完成才能触发

**决策：选项 C（拒绝并发，HTTP 409）**

**理由**：
1. MVP 场景：内容创作者同一时刻不会真正需要并发生成两个不同话题
2. 宿主机 Docker 并发限制：已有 3 Writer 并发，额外并发 task 的 6 个容器超出开发机实际容量
3. 实现最简：trigger API route 一次 SQL 查询即可检测，无队列基础设施
4. 409 响应含 existingTaskId，前端可引导用户查看进行中的 task 而非重新触发

**实现**：`app/api/content-generation/trigger/route.ts` 在 INSERT 前执行：
```sql
SELECT id FROM content_tasks WHERE status IN ('pending','researching','writing') LIMIT 1
```
若有结果返回 HTTP 409 `{ error: "A task is already in progress", existingTaskId: row.id }`。

---

## CL-02 · Researcher 超时：60s 内未回传怎么处理？

**歧义**：Coordinator 向 Researcher 发消息后，如果 Researcher 因网络问题、WebSearch MCP 超时或容器崩溃而未在合理时间内回传，Coordinator 如何感知？

**选项分析**：
- 选项 A：Coordinator CLAUDE.md 指令写明"如果 60s 内未收到 researcher 回传，自己标记 failed" → 问题：Agent session 不会在没有新消息时被 wake，所以 Coordinator 无法"主动等待"
- 选项 B：host-sweep 在 60s tick 时检测 stale task，写入 failed → 优点：不需要 Agent 主动等；缺点：最坏需等 120s（sweep 两次）
- 选项 C：inject-task 脚本写入时同时 schedule 一个 60s 后的 system 超时消息给 coordinator → 优点：精确 60s；缺点：增加 inject-task 复杂度

**决策：选项 B（host-sweep 检测，超时阈值 120s）**

**理由**：
1. Coordinator session 在等待 Researcher 回传期间处于 idle，不会被 wake，无法主动检测
2. host-sweep 每 60s 一次，120s 阈值对调研失败的用户体验可接受（3 分钟总超时 = Researcher 2 分钟内未回传即失败）
3. 不引入额外基础设施（schedule 超时消息需要复杂的 cancel 逻辑）

**实现**：在 `src/host-sweep.ts` 的 `sweepSession` 中（或新增专用 sweep 函数），检测：
```sql
SELECT id FROM content_tasks
WHERE status = 'researching'
AND created_at < datetime('now', '-120 seconds')
```
若有结果，更新 `status='failed'`, `error='researcher timeout: no response within 120s'`。

**替代方案备注**：若未来需要精确 60s 超时，可在 inject-task 写入时额外 `schedule_task` 一个 120s 后触发的 system 消息给 Coordinator；当前 MVP 不做。

---

## CL-03 · Writer 部分失败：某个平台 Writer 失败怎么处理？

**歧义**：3 个 Writer 中某个容器崩溃或 write-article.ts 脚本报错，Coordinator 是否等待并识别失败？

**选项分析**：
- 选项 A：任一 Writer 失败 → 整个 task 标记 failed → 优点：状态简单；缺点：用户丢失已生成的 2 篇文章
- 选项 B：失败的 Writer 跳过，其余照常，task 标记 partial → 优点：保留成功文章；缺点：需要 Coordinator 识别 partial 状态
- 选项 C：失败 Writer 重试一次，超时后才标记 partial → 增加复杂度，MVP 不做

**决策：选项 B（partial 降级，保留成功文章）**

**理由**：
1. 用户最在意"有文章可用"，partial 状态下 2 篇文章已可使用
2. Coordinator 的完成判断逻辑本身已需要计数器（writers_completed + writers_failed），判断 partial 只是条件分支
3. 失败平台在 content_articles 不写行，dashboard 展示时对应列显示占位符

**实现（Coordinator session_state 计数器）**：
```
writers_completed: 0   // 收到 done 信号 +1
writers_failed: 0      // 收到 error 信号 +1
failed_platforms: []   // 记录失败 platform 名称
```
当 writers_completed + writers_failed = 3 时：
- all done (3,0) → status='completed'
- partial (1-2, 1-2) → status='partial', error='failed platforms: [...]'
- all failed (0,3) → status='failed', error='all writers failed'

**Writer CLAUDE.md 失败行为**：write-article.ts 退出码非 0 时，Writer 通过 send_message 发 `{taskId, platform, status:'error', error:'<stderr内容>'}` 给 coordinator，不是静默退出。

---

## CL-04 · Coordinator 完成检测：如何知道 3 个 Writer 全完成？

**歧义**：3 个 Writer 完成后各自 send_message 给 coordinator，coordinator 需要累计 3 次回传才能确认全部完成。session_state 是否足够可靠？

**选项分析**：
- 选项 A：Coordinator 在 session_state（outbound.db K/V 存储）维护计数器 → 优点：利用现有基础设施；缺点：session_state 在容器重启后是否持久？→ 是，outbound.db 是持久文件
- 选项 B：Coordinator 查询 content_articles 表 COUNT 来确认 → 优点：不依赖内存状态；缺点：需要 Bash tool 查询 DB，增加 I/O 轮次
- 选项 C：host 侧 delivery.ts 聚合完成信号 → 需要修改 host 代码，超出 Agent 自治范围

**决策：选项 A（session_state 计数器）+ 选项 B 作为验证（可选）**

**理由**：
1. `outbound.db session_state` 是持久 K/V 存储，container-runner.ts 不清除 outbound.db（只清 processing_ack）
2. session_state 的写法：container 内用 bun:sqlite `INSERT OR REPLACE INTO session_state VALUES('writers_completed', '2', ...)`
3. 若 Coordinator 容器在等待期间被 sweep 停止又重启，session_state 仍可读取（outbound.db 持久）

**实现流程**：
```
Coordinator 收到 Writer done 信号时：
  1. 读 session_state 中的 writers_completed (默认 '0')
  2. writers_completed += 1，写回 session_state
  3. 读 writers_failed（同理）
  4. 若 writers_completed + writers_failed == 3：
     - 用 Bash tool 执行 update content_tasks SET status=... WHERE id=taskId
  5. 否则继续等待下一个 Writer 消息（session 不退出，等待下次 wake）
```

---

## CL-05 · Researcher 调研工具：用什么工具？输出什么格式？

**歧义**：Researcher agent 在容器内如何"联网调研"？MCP WebSearch？Bash curl？输出什么格式给 Coordinator？

**选项分析**：
- 选项 A：WebSearch MCP（若已在 agent_group container.json 中配置）→ 最自然，但依赖外部 MCP server 配置
- 选项 B：Bash tool + curl HackerNews API + curl RSS → 无外部依赖，但 Researcher CLAUDE.md 需明确 API 格式
- 选项 C：Bash tool 调用 daily-news 的 fetcher（复用 `src/modules/daily-news/fetcher.ts`）→ 优点：复用现有逻辑；缺点：fetcher 是 Node 脚本，容器用 Bun

**决策：选项 A（WebSearch MCP 优先）+ 选项 B 作为降级**

**理由**：
1. content-researcher 的 container.json 配置 WebSearch MCP（若 onecli vault 有 API key）
2. CLAUDE.md 指令写"优先用 WebSearch，无权限时用 Bash curl HackerNews Algolia API"
3. 输出格式统一为 JSON 字符串（方便 Coordinator 在 send_message content 字段中传递）

**输出格式规范**：
```json
{
  "topic": "AI工程化",
  "key_facts": [
    { "fact": "Claude 3.5 Sonnet 在 SWE-bench 达到 49%", "source": "HackerNews" },
    { "fact": "...", "source": "..." }
  ],
  "sources": [
    { "title": "标题", "url": "https://...", "summary": "..." }
  ],
  "researched_at": "2026-05-13T10:00:00Z"
}
```
Coordinator 将此 JSON 字符串通过 send_message content 字段转发给 3 Writer，Writer CLAUDE.md 中指令解析使用。

---

## CL-06 · Writer 写 content_articles：sqlite3 CLI 还是 tsx 脚本？

**歧义**：Writer agent 容器内如何写 content_articles 表？brainstorming §6 risk 3 提到两种方案。

**选项分析**：
- 选项 A：`sqlite3 /workspace/data/v2.db "INSERT INTO content_articles ..."`  → 优点：无额外脚本；缺点：需要 sqlite3 CLI 在容器 PATH 中（需 apt install），且 SQL 注入风险（content 中含引号）
- 选项 B：`pnpm exec tsx /workspace/scripts/write-article.ts --task-id=... --content=...` → 优点：参数安全（better-sqlite3 参数化 SQL），无 SQL 注入风险，可加 INSERT OR REPLACE 逻辑；缺点：需要额外脚本
- 选项 C：send_message → coordinator → coordinator 写 DB → 优点：不需要 Writer 直接访问 DB；缺点：增加 message round-trip，协调复杂

**决策：选项 B（pnpm exec tsx /workspace/scripts/write-article.ts）**

**理由**：
1. content 字段含中文、emoji、换行符，直接拼 sqlite3 CLI 命令存在 shell 转义和 SQL 注入风险
2. `/workspace` 是 nanoclaw-v2 项目根目录的容器内挂载路径（container-runner.ts mount spec）
3. `pnpm exec tsx` 在容器内可用（host 的 node_modules 已挂载，tsx 在 devDependencies）
4. write-article.ts 使用 better-sqlite3（host 侧 package），参数化 SQL，安全

**命令格式**（Writer CLAUDE.md 中明确）：
```bash
pnpm exec tsx /workspace/scripts/write-article.ts \
  --task-id="ctask-xxx" \
  --platform="xiaohongshu" \
  --title="标题" \
  --content="正文内容" \
  --tags='["#AI工程化","#技术"]' \
  --word-count=750
```
退出码 0 = 成功，非 0 = 失败（stderr 写原因）。

---

## CL-07 · Dashboard 路由权限：需要鉴权吗？

**歧义**：`/content-generation` 页面和 3 个 API route 是否需要 auth middleware？

**决策：MVP 无鉴权，local-only**

**理由**：
1. NanoClaw 整体是 local-only 部署（brainstorming §1 MVP 范围），无公网暴露场景
2. 现有 `/api/chat/route.ts`、`/api/daily-news/` 均无鉴权
3. 鉴权属于 Out of Scope（spec.md §Out of Scope 第 8 条）

**后续**：若未来暴露公网，在 Next.js middleware.ts 添加 session 检查即可，无需改动 API route 本身。

---

## CL-08 · 轮询终止条件：什么时候停？

**歧义**：dashboard 在什么状态下停止 5s 轮询？

**决策**：status IN ('completed', 'failed', 'partial') 时 clearInterval。

**理由**：
1. 这 3 个状态都是终态，content_tasks 不会再变更
2. 'partial' 是终态（不会自动重试），需要用户手动触发新 task
3. clearInterval 后 page 依然展示最后一次轮询的结果（不清空）

**实现参考**：`daily-news-panel.tsx` L47 `setInterval` 模式，增加终止判断：
```ts
if (['completed','failed','partial'].includes(res.task?.status)) {
  clearInterval(id);
}
```

---

## 遗留问题（不阻塞 MVP，记录供未来参考）

| # | 问题 | 备注 |
|---|------|------|
| L-01 | Researcher WebSearch MCP 是否需要 API key？用哪个服务？ | 取决于 onecli vault 配置；CLAUDE.md 写降级到 Bash curl 即可 |
| L-02 | content-coordinator 的 writer_completed 计数器在 coordinator 容器被 sweep 停止后重启，能否正确恢复计数？ | session_state 在 outbound.db 持久；但容器重启后 coordinator 需重新读状态——CLAUDE.md 指令需写明"每次被 wake 先读 session_state 的 writers_completed 决策" |
| L-03 | 未来多话题并发（CL-01 选项 A/B）需要什么基础设施？ | 任务队列（Redis / SQLite-based queue）；目前选项 C 拒绝并发，此问题留后期 |
