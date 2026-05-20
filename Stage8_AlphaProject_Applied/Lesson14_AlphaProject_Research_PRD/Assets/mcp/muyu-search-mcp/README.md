<div align="center">

# muyu-search-mcp

**木羽自研 · Claude Code 联网搜索 MCP**

让 Claude Code 拥有真正可用的「联网搜索 + 网页阅读 + 站点扫描」三件套

[![Python](https://img.shields.io/badge/python-3.10+-3776ab.svg)](https://www.python.org/downloads/) [![MCP](https://img.shields.io/badge/MCP-server-7e57c2.svg)](https://modelcontextprotocol.io/)

</div>

---

## 这是什么

一个为 Claude Code 设计的本地 MCP 服务器。装上之后，Claude 在回答你之前会**真的去网上查**，而不是凭印象瞎答。

具体提供三个工具：

| 工具 | 它干什么 |
| --- | --- |
| `web_search` | 用 Grok 模型联网搜索，返回带信源的答案 |
| `web_fetch` | 把任意网页内容抓回来转成结构化 Markdown，喂给 Claude 阅读 |
| `web_map` | 扫描一个站点，列出全部可访问 URL，适合「先盘后查」的研究场景 |

为什么不直接用 Claude Code 自带的 `WebSearch` / `WebFetch`？因为：
- 自带工具受 Anthropic 后端策略限制，部分地区不可用、命中率不稳定
- 自带工具不会把搜索结果**显式喂给模型**，Claude 经常仍然走「内部记忆」回答，幻觉率高
- 没有结构化的信源回传，难以追溯

本项目把这三件事都修好了，并且**核心模型走 OpenRouter**，国内可访问、模型可换、有免费额度可用。

---

## 核心差异化：分层规划状态机

这是本项目和"普通搜索 MCP"最大的区别。一句话：**Claude 在真正调 `web_search` 之前，必须先走完一套结构化的规划流程**，否则被工具拒绝执行。

为什么这么设计？因为 LLM 直接搜索有两个老毛病：
1. **乱抓**：复杂问题一头扎进去，搜 1 次就开始编答案，幻觉严重
2. **过度搜**：简单问题被 LLM 自己脑补成深度研究，烧 token

我们把规划做成了**按复杂度自适应的 6 阶段状态机**：

```
plan_intent ─► plan_complexity ─► plan_sub_query(batch) ─► plan_search_term(batch)
                    │                                          │
                    │           ┌─────────────────────────────┘
                    │           ▼
                    │      plan_tool_mapping(batch) ─► plan_execution
                    │           │
                    ▼           ▼
              Level 1 (3 阶段)   Level 2 (5 阶段)   Level 3 (6 阶段)
              简单事实         对比/综述           深度研究
```

| 阶段 | 输出 | 关键校验 |
| --- | --- | --- |
| 1. **intent_analysis** | 核心问题 / 类型 / 时效性 / 未验证术语 | 必须最先调用 |
| 2. **complexity_assessment** | level 1/2/3 + 预估调用次数 | **自动 floor**：≥2 未验证术语或歧义点 → level 至少 2 |
| 3. **query_decomposition**（批量） | 多个 sub-query，每个含 goal / boundary / depends_on | 唯一 id、依赖必须存在、**无环**（DFS 三色法） |
| 4. **search_strategy**（批量） | 每个 sub-query 的搜索词 | term **≤8 词**、purpose 必须指向已声明的 sub-query；Level 1 自动从 goal 派生 |
| 5. **tool_selection**（批量） | sub-query → 工具映射 | tool ∈ {web_search, web_fetch, web_map} |
| 6. **execution_order** | parallel 组 + sequential 列 | — |

### 强约束（不是建议，是硬门禁）

- **Planning Gate**：`web_search` 传入 `plan_session_id` 时，若 plan 未完成，工具**直接拒绝执行**并返回 `gate_reason`
- **未验证术语闭环**：intent 阶段标注的 `unverified_terms`（例如 "CCF-A"、"Fortune 500" 这种训练数据可能过时的分类），**必须**至少在一个 sub-query.goal 里出现，否则 plan 永远 incomplete
- **回滚式校验**：任何阶段提交不合格数据，session 状态**自动回滚**到上一次合法快照，不会污染

### 工程级特性

| 特性 | 实现 | 价值 |
| --- | --- | --- |
| **会话持久化** | session 状态实时写入 `~/.config/muyu-search/sessions/{id}.json` | MCP 进程崩溃 / Claude Code 重启后，规划上下文不丢 |
| **LRU + TTL** | 内存 64 个 session 上限，磁盘 7 天过期自动清理 | 长跑不内存泄漏 |
| **批量提交** | sub_query / search_term / tool_mapping 都接受 JSON 数组 | 复杂查询的规划开销从 21 次往返压到 6 次 |
| **结果缓存** | 跨 session 的 LRU 缓存（256 条，1h TTL，大小写归一） | 重复问题秒回，省 token |
| **预算追踪** | 实际工具调用次数 vs `estimated_tool_calls`，超额标 `over_budget` | 让 Claude 自己意识到搜超了 |
| **revision 计数** | 每阶段独立计数，>3 次自动 warning | 防止 Claude 在某阶段反复改主意 |

### 一个具体的例子

学员问："对比下 React 19 和 Vue 3.5 的服务器组件能力"

- **plan_intent** 标出 `query_type=comparative`, `unverified_terms=["React 19","Vue 3.5"]`（不确定版本是否已发布）
- **plan_complexity** 评 level=2，预估 4 次工具调用
- **plan_sub_query** 一次性提交 3 个 sub-query：sq1 查 React 19 现状（被 unverified 强制要求）、sq2 查 Vue 3.5 现状（同样）、sq3 横向对比（`depends_on:["sq1","sq2"]`）
- **plan_search_term** 一次性提交 3 条 ≤8 词的查询
- **plan_tool_mapping** 一次性映射全部到 `web_search`
- **plan_execution** 输出 `parallel:[["sq1","sq2"]], sequential:["sq3"]`

走完后才调 `web_search`。整个流程 **6 次 MCP 往返**，对比无规划版本"边搜边想"的随机次数和质量，差距巨大。

---

## 30 秒上手

本工具支持两种安装方式：**A. 让 Claude Code 自己配**（推荐学员，全程在对话里完成）/ **B. 交互式向导**（手动跑命令，键盘选项）。

### A. Claude Code 驱动（非交互模式，推荐学员）

把这一段直接发给 Claude Code：

> 我桌面有 `~/Desktop/muyu-search-mcp`，请把它安装到我当前项目里（**scope=project，不要装到全局**）。
> 你需要先 `cd` 到我当前项目目录，然后通过下面这条命令完成安装。我会在对话里告诉你我的 OpenRouter API Key（`sk-or-v1-...` 开头），Tavily 和 Firecrawl 都跳过：
>
> ```
> uvx --from '/Users/<我的用户名>/Desktop/muyu-search-mcp[setup]' \
>     muyu-search-setup \
>     --non-interactive \
>     --package-spec /Users/<我的用户名>/Desktop/muyu-search-mcp \
>     --scope project \
>     --provider openrouter \
>     --api-key <我会粘贴给你的 Key>
>
> 装完检查 .mcp.json 是否只在当前目录、claude mcp list 是否能看到 muyu-search。

Claude 拿到这段后会自己 cd / 问你要 Key / 替换占位符 / 执行命令 / 验证结果，全程**无键盘交互**。

### B. 交互式向导（自己跑）

```bash
cd ~/your-project          # ← 关键：决定 .mcp.json 写到哪里
uvx --from '~/Desktop/muyu-search-mcp[setup]' \
    muyu-search-setup \
    --package-spec ~/Desktop/muyu-search-mcp
```

弹出的引导向导会一步步问你 API Key、模型偏好、作用域，全程**键盘上下选 + 回车**，复制粘贴 Key 即可，**不需要手写任何配置文件**。

完成后，向导会自动跑 `claude mcp add-json` 把 MCP 注册到当前项目的 `.mcp.json` 里。重启 Claude Code 后输入 `/mcp` 就能看到 `muyu-search`。

> 没装 `uv`？两条命令补上：`curl -LsSf https://astral.sh/uv/install.sh | sh` 然后重开终端。

---

## API Key 申请指南

需要至少 1 个 Key，其它都是可选的。**最佳零成本组合 = OpenRouter + Tavily**，两家加起来每月免费额度足够个人学习使用，全程不用绑卡。

### 1. OpenRouter（必需）

| 项 | 说明 |
| --- | --- |
| 注册入口 | https://openrouter.ai/sign-in |
| 申请 Key | https://openrouter.ai/settings/keys |
| Key 前缀 | `sk-or-v1-...` |
| 免费额度 | 新账号送少量赠送额度；将模型名改为 `x-ai/grok-4-fast:free` 即可走免费版（2M 上下文，但有每周 token 上限和每日次数上限） |
| 想跑得稳 | 充值 ≥ $10 解锁更高每日请求上限 |

**为什么选 OpenRouter**：一个 Key 通吃 Grok / Claude / GPT / Gemini / 各种开源模型，国内网络可达，结算简单，对学员非常友好。

### 2. Tavily（强烈建议，可选）

| 项 | 说明 |
| --- | --- |
| 注册入口 | https://app.tavily.com/home |
| 定价说明 | https://www.tavily.com/pricing |
| 免费额度 | **1,000 次调用 / 月**，无需绑卡 |
| 超额计费 | $0.008 / 次（按需付费） |

不配 Tavily 会怎样？`web_fetch` 和 `web_map` 两个工具会从工具列表里自动隐藏，但 `web_search` 仍然完整可用。

### 3. Firecrawl（普通学习场景可跳过）

| 项 | 说明 |
| --- | --- |
| 注册入口 | https://www.firecrawl.dev/signin?view=signup |
| 定价说明 | https://www.firecrawl.dev/pricing |
| 免费额度 | **1,000 credits / 月**，无需绑卡 |
| 付费起步 | Hobby $16/月（年付）= 5,000 credits/月 |

Firecrawl 只在 Tavily 抓页失败时做兜底降级。日常课程绝对用不到，跳过即可。

---

## 工作原理

向导跑完后，你项目根目录的 `.mcp.json` 大致长这样（敏感字段已脱敏）：

```json
{
  "mcpServers": {
    "muyu-search": {
      "type": "stdio",
      "command": "uvx",
      "args": ["--from", "/Users/you/muyu-search-mcp", "muyu-search"],
      "env": {
        "MUYU_PROVIDER": "openrouter",
        "MUYU_API_KEY": "sk-or-v1-****",
        "MUYU_MODEL": "x-ai/grok-4-fast",
        "TAVILY_API_KEY": "tvly-****"
      }
    }
  }
}
```

Claude Code 启动时读这个文件，按 stdio 协议拉起一个 Python 进程（就是本项目），然后通过 MCP 协议在你和这个进程之间转发工具调用。

请求路径：

```
你 → Claude Code → muyu-search MCP → ┬─ OpenRouter Grok API（web_search）
                                      ├─ Tavily API（web_fetch 抓页 / web_map 扫站）
                                      └─ Firecrawl API（web_fetch 兜底）
```

---

## 作用域怎么选

向导第 5 步会让你选作用域（scope），三选一：

| Scope | 配置文件位置 | 谁能看到 | 推荐场景 |
| --- | --- | --- | --- |
| **project** | `<项目>/.mcp.json` | 入 git 后整个团队共享 | **学员、团队协作（默认）** |
| user | `~/.claude.json` | 你这台机器上所有项目 | 你自己一台机器多个项目都要用 |
| local | `<项目>/.claude/settings.local.json` | 仅本机本项目 | 个人调试，不希望同步给团队 |

**新手就选 project**。把 `.mcp.json` 提交进 git，团队拉下来就直接能用。

---

## 进阶配置

### 切换 Provider

向导第 2 步可以选 `OpenRouter` / `xAI 官方` / `自定义镜像站`。已经装好了想改？两条路：

```bash
# 方法 1：重新跑向导
muyu-search-setup --package-spec ~/Desktop/muyu-search-mcp

# 方法 2：直接编辑 .mcp.json 里的 env 段
```

### 换模型

向导里默认 `x-ai/grok-4-fast`。其它常见可选（OpenRouter 上）：

| 模型名 | 适用场景 |
| --- | --- |
| `x-ai/grok-4-fast` | 默认，速度 / 质量 / 价格平衡 |
| `x-ai/grok-4-fast:free` | 完全免费，有调用频率限制 |
| `x-ai/grok-4` | 顶配版，慢但更稳 |
| `anthropic/claude-3.5-sonnet` | 想用 Claude 做搜索也可以 |

> OpenRouter 上的模型，本工具会**自动加 `:online` 后缀**启用联网搜索功能，无需手动加。

### 完整环境变量参考

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MUYU_PROVIDER` | `openrouter` | `openrouter` / `xai` / `custom` |
| `MUYU_API_URL` | 由 provider 自动推导 | OpenAI 兼容端点 |
| `MUYU_API_KEY` | — | **必需** |
| `MUYU_MODEL` | `x-ai/grok-4-fast` | 启动后可用 MCP 工具切换 |
| `MUYU_OPENROUTER_REFERER` | 项目地址 | OpenRouter 的 `HTTP-Referer` 头 |
| `MUYU_OPENROUTER_TITLE` | `muyu-search-mcp` | OpenRouter 的 `X-Title` 头 |
| `TAVILY_API_KEY` | — | 可选 |
| `FIRECRAWL_API_KEY` | — | 可选 |
| `MUYU_DEBUG` | `false` | 打开详细日志 |
| `MUYU_LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `MUYU_LOG_DIR` | `~/.config/muyu-search/logs` | 日志输出目录 |

---

## 验证安装

### 一、命令行级

```bash
claude mcp list
# 应该出现一行：muyu-search    connected
```

### 二、在 Claude Code 里

新开会话，直接说：

> 用 muyu-search 的 web_search 工具搜一下 2025 年 React Server Components 的最新进展，把信源列出来。

如果连通，会看到 Claude 调用 `web_search`，输出带链接的回答。

再试一条：

> 用 muyu-search 的 web_fetch 抓 https://react.dev/blog 这个页面，输出 markdown。

这条需要配了 Tavily Key 才会成功；没配会看到 Claude 报「工具不可用」。

---

## 常见问题

**Q：向导跑到一半失败了怎么办？**
A：直接重跑同一条命令即可，覆盖式写入，不会有残留。

**Q：`/mcp` 看不到 muyu-search？**
A：99% 是 Claude Code 没重启。先 `claude mcp list` 看命令行是否能看到，能看到就完全重启 Claude Code（不是新会话，是退出再开）。

**Q：调用时报 401 / 403？**
A：API Key 没配对。运行 `claude mcp get muyu-search` 看一下 env 里的 key 前缀对不对（OpenRouter 必须 `sk-or-v1-`）。

**Q：报 429（rate limit）？**
A：免费模型有每日 / 每周上限。改成付费模型，或者去 OpenRouter 充值 ≥ $10 解锁更高 RPD。

**Q：能用国内的 OpenAI 兼容镜像站吗？**
A：可以。向导第 2 步选 `custom`，自己填 base_url 即可。

