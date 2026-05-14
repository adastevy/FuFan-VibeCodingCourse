# Failing Test · Phase E 真凭据

## 测试条件

- 3 Writer 真并发：xiaohongshu / weibo / wechat-official 各一个
- 共享输入：`specs/multi-platform-content/drafts/2026-05-13/research.md`
- 共享约束："所有 URL 必须来自 research.md，不得编造"
- 各自加载对应 style skill（style-xiaohongshu / style-weibo / style-wechat-official）
- **未加载** platform-aware-citation skill

---

## Test 1 · 小红书 URL 过载

**Input:** research.md + style-xiaohongshu + "URL 必须真实来自 research.md"

**Expected:** 正文 0 个裸 URL（小红书 app 内外链不可点击，裸 URL 是视觉噪音）

**Actual (Phase E):** 正文塞入 7 个 https://github.com/... 链接

```
grep 实测（xiaohongshu.md）：
https://github.com/google-gemini/gemini-cli/issues/26856
https://github.com/aattaran/deepclaude
https://github.com/adamjgmiller/adamsreview
https://github.com/Baukaalm/safesandbox
https://github.com/frenchie4111/harness
https://github.com/microsoft/vscode/pull/313931
https://github.com/qbittorrent/qBittorrent/pull/24124
```

`grep -c 'https://' xiaohongshu.md` → **7**

**Verdict: FAIL**

**根因:** Writer 把"URL 必须真实"解读为"URL 必须出现"，没有独立判断"此平台是否应该出现 URL"。

---

## Test 2 · 微博 URL 处理

**Input:** research.md + style-weibo + ≤280 字符约束

**Expected:** 字数允许时放 1 个最关键 URL；不允许则省略，保留数字

**Actual (Phase E):** 正文 0 个 URL，保留了数字（676分/281评，116 reactions）

`grep -c 'https://' weibo.md` 正文行 → **0**（元数据区有引用标注，不计入正文）

**Verdict: PASS（侥幸）**

**根因:** 侥幸被 style-weibo 的字数硬约束兜底——162 字符没有 URL 的空间。
非主动平台感知判断，换一个宽松字数场景会失效。

---

## Test 3 · 公众号 URL 处理

**Input:** research.md + style-wechat-official + 长文格式

**Expected:** 每个事实声明内联 URL + 来源标注

**Actual (Phase E):** 14 个 URL，全部内联到对应事实声明，格式正确

`grep -c 'https://' wechat-official.md` → **14**

**Verdict: PASS**

---

## 触发条件（为什么 3 Writer 并发才暴露）

单个 Writer 跑时，约束"URL 必须真实"看起来是完整的。
3 个 Writer 并发共享同一份 research.md、同一份约束，但不共享"URL 是否应该出现"的决策逻辑。
公众号 PASS 掩盖了小红书 FAIL，串行跑或只跑一个平台会漏掉坑。

这是 writing-skills 元方法的经典触发场景：只有跨 Writer 并发才暴露的跨平台共性漏洞。
