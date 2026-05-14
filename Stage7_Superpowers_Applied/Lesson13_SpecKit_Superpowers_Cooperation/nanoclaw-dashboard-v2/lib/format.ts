/* ──────────────────────────────────────────────────────────
 * 内部小工具
 * ────────────────────────────────────────────────────────── */

/** 四舍五入到 1 位小数，整数时去掉尾零："1.0"→"1"，"1.2"→"1.2" */
function roundTo1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? r.toString() : r.toFixed(1);
}

const COMPACT_UNITS: ReadonlyArray<{ v: number; s: string }> = [
  { v: 1_000_000_000, s: "B" },
  { v: 1_000_000, s: "M" },
  { v: 1_000, s: "k" },
];

const DURATION_UNITS: ReadonlyArray<{ v: number; s: string }> = [
  { v: 86400, s: "d" },
  { v: 3600, s: "h" },
  { v: 60, s: "m" },
  { v: 1, s: "s" },
];

/* ──────────────────────────────────────────────────────────
 * 公开 API
 * ────────────────────────────────────────────────────────── */

/**
 * 大数字紧凑格式：1234 → "1.2k"
 * - <1000 原样
 * - 阈值 1k / 1M / 1B，保留 1 位小数；whole 时 drop 尾零
 */
export function compactNumber(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return `${sign}${abs}`;
  for (const { v, s } of COMPACT_UNITS) {
    if (abs >= v) return `${sign}${roundTo1(abs / v)}${s}`;
  }
  return `${sign}${abs}`;
}

/**
 * 货币（CNY）：123.45 → "¥ 123.45"
 * - 永远 2 位小数；千分位逗号；负数 "-¥ <abs>"
 */
export function formatCurrencyCNY(n: number): string {
  const sign = n < 0 ? "-" : "";
  const formatted = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}¥ ${formatted}`;
}

/**
 * 百分比（输入是 fraction，0.123 → "12.3%"）
 * - 保留 1 位小数；whole drop 尾零
 * - 允许超出 [0,1]
 */
export function formatPercent(fraction: number): string {
  return `${roundTo1(fraction * 100)}%`;
}

/**
 * 时间间隔（秒）：90 → "1m30s"
 * - 单位 d/h/m/s 从大到小拼接，跳过任意零部分
 * - 整体 0 / 负数 / NaN → "0s"，小数四舍五入
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  let total = Math.round(seconds);
  if (total === 0) return "0s";

  const parts: string[] = [];
  for (const { v, s } of DURATION_UNITS) {
    const count = Math.floor(total / v);
    if (count > 0) parts.push(`${count}${s}`);
    total -= count * v;
  }
  return parts.join("") || "0s";
}
