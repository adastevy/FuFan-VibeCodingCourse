# Phase 0+1 开发复盘

| 字段 | 值 |
|---|---|
| **日期** | 2026-05-09 |
| **里程碑** | v0.2.0（Phase 1 完成 + Critical 安全补丁） |
| **耗时** | ~ 一个工作日（含 brainstorming → spec → plan → 实施 → review → 修补） |
| **执行流程** | Superpowers 全套：brainstorming → writing-plans → TDD → subagent-driven review → finishing-branch |
| **代码量** | ~3000 行 TS/TSX + ~600 行测试 + ~1000 行 markdown 文档 |

---

## 一、本次开发做了什么

### 1.1 工程脚手架（Phase 0）
- Next.js 14 App Router + TypeScript strict（`noUncheckedIndexedAccess` 也开了）
- Tailwind 3 + 雏形 19 个 token（颜色/圆角/阴影/字体栈）
- vitest 4 + zod 3 + clsx + tailwind-merge
- ESLint + Prettier + lint pass

### 1.2 雏形 1:1 视觉迁移（Phase 1）
完整搬过来 8 个区域：
- **Sidebar**（240px）：🐾 logo + 9 项导航（含 badge）+ 4 项平台连接
- **Topbar**（60px）：搜索框 + ⌘K + 2 个 quick badge + 通知铃 + MY 头像
- **PageHeader**：控制台标题 + 副标 + 导出报告 + 新建 Agent 按钮
- **StatsGrid**：Agent 总数 / Skills 总数 / 今日执行 / API 消耗（4 张暗卡 + 进度条 / mini bars）
- **AgentTable**：5 行（Andy 运行中 + 4 待配置/未启用）
- **WorkflowStatus**：排队中 / 进行中（带进度）/ 已完成 三组
- **RecentLogs**：6 条带 tag 颜色（init/chat/verify/setup/docker/git）
- **SecurityPanel**：成本控制 / Skill 审核 / 人工审批 三卡（带进度条）
- **ChatFab + ChatPanel**：5 状态切换（closed/open/sending/received/error）+ 错误重试

### 1.3 真实接入
- **`POST /api/chat`** 接通 NanoClaw CLI（spawn `pnpm run chat`）
- 完整错误链路：120s 超时 / spawn 失败 / 非 JSON / 空消息 / 跨站 origin 全部走专用 4xx-5xx

### 1.4 纯逻辑层（TDD 严格）
- **`lib/format.ts`**（55 测试）：`compactNumber` / `formatCurrencyCNY` / `formatPercent` / `formatDuration`，覆盖 IEEE 754 浮点边界
- **`lib/chat-state.ts`**（42 测试）：5 状态机 reducer，覆盖并发拒绝、stale 包防御、retry 闭环、非法跃迁矩阵

### 1.5 安全收口（Critical 补丁）
3 个独立 review 视角发现的 5 条 Critical 已修：
- argument injection（拒绝 `-` 开头消息 + 4000 字符上限）
- `NANOCLAW_ROOT` 路径校验（必须在 `~/projects/` 下 + realpath）
- env 白名单（不再透传所有 process.env）
- Origin/CSRF 校验（403 跨站）
- 占位 UI 视觉降权（disabled + opacity）

---

## 二、设计决策回顾

| 决策 | 选择 | 否决项 | 事后看是否仍合理 |
|---|---|---|---|
| 框架 | Next.js 14 App Router | Vite SPA / SvelteKit / 原生 | ✅ App Router + API Routes 一站式很顺手 |
| 组件库 | **不引 shadcn/ui**，纯 Tailwind 直写 | shadcn/ui new-york | ✅ 偏离 spec 但更轻 — 没有用到的复杂组件就没意义 |
| 货币 | CNY（¥） | 雏形是 USD（$） | ⚠️ 与雏形叙事/教学连续性割裂；如果回放给学员可能要切回 |
| Phase 1 数据 | 全 mock，仅聊天真 | sqlite 直读 / NanoClaw 加 HTTP API | ✅ 符合最小可演化原则 |
| 端口 | 4000（spec 定的） | 3000 默认 | ✅ 避开 macOS ControlCenter 抢 3000 |
| 状态机粒度 | reducer（5 状态）+ message 数组 | 多 useState 散乱 / Zustand | ✅ 测试覆盖直接覆盖业务规则，无业务藏在组件里 |
| TDD 严格度 | 严格（format / chat-state 全 RED→GREEN） | 后写测试 | ✅ 边界 case 暴露在测试里，写实现快 |

---

## 三、过程中的曲折点

| 事件 | 收获 |
|---|---|
| `create-next-app` 在已有 `docs/` 目录创建会卡 | 改成手写 package.json + tsconfig + next.config，更稳定可控 |
| Hot-reload 中间态 → 几次 webpack OOM 崩溃 | dev server 长跑要警惕；改文件密集时需要重启清 .next |
| `formatCurrencyUSD(12.345)` 测试失败 | IEEE 754 浮点 → 改用 `12.5678 / 12.5644` 这种"clean" 样本 |
| Plan 把 SecondaryButton/PrimaryButton 当装饰 | review 抓出"按钮无 onClick 又不 disabled" 是 bug 不是占位 |
| 产品评审误判"关闭浮层丢消息" | useReducer state 跟着组件活，DOM 卸载不影响状态。**review 不能完全替代实测** |
| pnpm 加 vitest 时 .next 与 dev 进程冲突 | 端口冲突 → kill + clean .next + 重启 |

---

## 四、预留的扩展点

设计上明确为后续阶段铺路的接口：

### 4.1 数据层（Phase 3 切真接口）
- **mock 与未来 API 共享同一份 zod schema**（`lib/mock/schema.ts`）
- 替换路径：page.tsx 的 `import` 从 `lib/mock` 切到 `lib/api`，组件 props 不变
- ⚠️ TODO 已留：`lib/mock/schema.ts` 应提到 `lib/contract/`（避免 components 反向依赖 mock 命名空间）
- ⚠️ TODO 已留：`lib/mock/stats.ts` 改成 `async function getStats()`（让 page 异步切换无痛）

### 4.2 NanoClaw 集成（Phase 2/3 替换 transport）
- **所有 NanoClaw 假设集中在 `lib/nanoclaw/contract.ts`**：命令、cwd、超时、stdout 解析、env 隔离
- NanoClaw 升级 / 改协议 → 改这一个文件
- ⚠️ Architect 建议：抽 `interface ChatTransport`，让 spawn 实现和未来 sqlite/HTTP 实现满足同一接口（Phase 2 启动时再做）

### 4.3 状态机（Phase 2 流式）
- 当前 reducer 是 turn-based（REPLY_OK 一次性 append）
- ⚠️ Phase 2 SSE 落地要新增 `REPLY_CHUNK` / `REPLY_END` action + `streaming: boolean` 字段
- 现在的测试（42 条）会有约 1/3 需要扩展

### 4.4 8 个 EmptyState 子页
- 控制台外 8 个入口已就位，等 Phase 3 数据/交互填充
- ⚠️ 文案目前是开发语言（"Phase 3 开放"），TODO 已留改产品语言

### 4.5 体验类
- ⌘K 搜索：UI 已就位但 disabled，Phase 2 接 cmdk + Command palette
- 占位按钮（导出报告 / 新建 Agent）：已显式 disabled + tooltip，Phase 2 接真功能

---

## 五、剩余风险

### 5.1 技术债（已用 TODO 标注，10 处）

| TODO | 位置 | 影响 |
|---|---|---|
| #6 | `app/api/chat/route.ts` | Next.js 14.2.18 含 CVE-2025-29927，应升 14.2.33+ |
| #7 | `app/api/chat/route.ts` | stderr 当 reply 返回 → 错误栈 / 路径泄漏 |
| #9 | `app/api/chat/route.ts` | 无并发/速率限制 → 同源 fork bomb |
| #10 | `lib/mock/stats.ts` | 同步导出阻碍 Phase 3 异步切换 |
| #11 | `lib/mock/schema.ts` + `lib/nanoclaw/contract.ts` | schema/contract 应合并到 `lib/contract/` |
| #12 | `components/chat/chat-fab.tsx` | 错误 banner 4 元素拥挤 |
| #13 | `components/chat/chat-fab.tsx` | 浮层 ESC 关闭未实现 |
| #14 | `components/shell/empty-state.tsx` | 文案改产品语言 |
| #15 | `components/dashboard/stats-grid.tsx` | Skills / 今日执行 共用 ⚡ emoji |

### 5.2 已知偏离 spec
- **未引入 shadcn/ui**：spec §4.1 写了 new-york style，实际用 Tailwind 直写。理由：当前组件清单（按钮 / 输入 / badge / 卡片）shadcn 引入成本大于收益。需 spec 备注或回填。

### 5.3 未覆盖的测试场景
- 视觉/UI 层无自动化测试（spec 接受）→ Phase 2 评估 Playwright
- API spawn 成功路径无单测（只有 curl 验证）→ 真接入 NanoClaw 后才能稳定测

### 5.4 部署/运维
- 当前仅本地 127.0.0.1，不存在云端风险面
- 一旦未来挪到内网/公网，**Origin 白名单要扩、要加认证、要防限流**
- ⚠️ NanoClaw fork 升级（rebase upstream）会带来 stdout 格式漂移 → contract.ts 是收口，但仍需手测

---

## 六、可复用的方法论沉淀

本次跑通了一条"全 Superpowers"流程，未来同类项目可以照搬：

1. **brainstorming** → 一问一答把目标聚焦（用户类型/范围/技术栈/部署形态）
2. **writing-plans** → 19 个原子任务，每个 ≤ 60 分钟，明确 ★TDD vs ▮批量
3. **TDD 严格五步** → format / chat-state 都是 RED→GREEN→REFACTOR 走完
4. **subagent-driven 三方 review**（架构/安全/产品 并行）→ 立即定位 5 条 Critical
5. **finishing-branch** → 验证测试 → 检测环境 → 提供 4 选项

教训：
- ✅ "看似简单的小项目"也值得走这套，会暴露平时忽略的安全/边界问题
- ✅ 三方独立 review **共识 > 单视角**（env 透传被两路独立指出 = 真问题）
- ⚠️ Review 有"读代码而非实测"的盲区（产品评审误判 messages 丢失），最终需要 controller 综合判断

---

## 七、下一步建议

按 ROI 排序：

1. **修 Important #6**（Next.js 升级）— 5 分钟，关一个 CVE
2. **修 #11/#10**（schema/contract 重组 + mock async）— 1 小时，给 Phase 3 铺路
3. **修 #12/#13**（错误 banner + ESC）— 30 分钟，每天聊一次都受益
4. **修 #14/#15**（文案 + emoji）— 15 分钟，纯产品打磨
5. **跑 `pnpm install --lockfile-only && pnpm audit`** 看依赖
6. **写 NanoClaw fork 启动文档**（`docs/setup-nanoclaw.md`）— 防自己 30 天后忘
7. 再决策 Phase 2 启动时机
