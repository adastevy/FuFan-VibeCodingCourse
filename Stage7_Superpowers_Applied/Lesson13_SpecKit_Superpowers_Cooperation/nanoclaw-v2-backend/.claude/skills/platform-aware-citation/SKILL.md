---
name: platform-aware-citation
description: Use when writing content that cites sources (URLs, numbers, quotes) across social platforms — each platform has different rules for whether bare URLs should appear at all. Prevents inline URL overflow on platforms where links are unclickable or unwanted (小红书, Instagram-like). Applies whenever a Writer receives research with URLs and must decide per-platform how to surface citations.
---

# Platform-Aware Citation

## Core Principle

"URL 必须真实" ≠ "URL 必须出现"。这是两层独立决策。第一层：来源是否可信。第二层：此平台是否应该显示 URL。两层都要判断。

## Per-Platform Rules

### 公众号 / Newsletter（长文）

- 每个事实声明 → 内联 Markdown 链接 `[描述](url)` + 来源标注
- 数据数字 → 标注来源平台名称
- 理由：读者环境支持点击，可信度依赖可追溯来源

### 小红书 / 竖屏短图文

- 正文**禁止**裸 URL（app 内外链不可点击，是视觉噪音）
- 数据用文字表达："来自 xxx 项目"、"GitHub 上 xxx 个 star"、"HN xxx 分"
- 结尾可选"相关项目"区域：文字列出项目名，**不放链接**
- 理由：小红书 app 内超链接无法点击，裸 URL 只会让读者复制失败后放弃

### 微博 / Twitter-like（字数受限）

- 字数允许时：放 **至多 1 个**最关键 URL（通常是最高热度来源）
- 字数不允许时：省略 URL，保留数字 + 项目名
- 禁止超过 1 个 URL（多链接被算法识别为外链垃圾）
- 理由：字数硬约束优先；单 URL 比多 URL 传播效果更好

## 决策流程

```
收到 research.md → 有 URL 需要引用？
  ├── 是 → 当前平台是什么？
  │         ├── 公众号 → 全部内联链接
  │         ├── 小红书 → 正文 0 个 URL，文字替代
  │         └── 微博   → 0 或 1 个，看字数
  └── 否 → 不涉及
```

## Common Mistakes

| 错误理由 | 现实 |
|----------|------|
| "约束说 URL 必须真实，我就放进去" | "真实"≠"必须出现"，两层独立判断 |
| "字数没限制就多塞 URL" | 平台 UX 规则比字数限制更优先 |
| "公众号过了，小红书也应该差不多" | 两个平台 URL 规则完全相反 |
| "用户能看懂裸 URL 是什么意思" | 不可点击的 URL 是噪音，不是来源 |
| "其他 Writer 放了 URL，我也放" | 每个平台独立判断，不参考其他平台输出 |
