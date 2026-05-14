import { describe, it, expect } from "vitest";
import {
  compactNumber,
  formatCurrencyCNY,
  formatPercent,
  formatDuration,
} from "@/lib/format";

/* ────────────────────────────────────────────────────────────────────
 * 1. compactNumber · 大数字 1234 → "1.2k"
 *    规则：
 *    - < 1000 ：原样输出整数
 *    - ≥ 1k / 1M / 1B ：保留 1 位小数（whole number 时 drop 尾零）
 *    - 阈值边界向上跃迁（999_999 → "1M"）
 *    - 负数加 "-" 前缀
 * ──────────────────────────────────────────────────────────────────── */
describe("compactNumber", () => {
  describe("基础范围", () => {
    it("0 → '0'", () => expect(compactNumber(0)).toBe("0"));
    it("1 → '1'", () => expect(compactNumber(1)).toBe("1"));
    it("999 → '999'（不缩写）", () => expect(compactNumber(999)).toBe("999"));
  });

  describe("k 区间（1k ~ <1M）", () => {
    it("1000 → '1k'（drop 尾零）", () => expect(compactNumber(1000)).toBe("1k"));
    it("1234 → '1.2k'（用户示例）", () => expect(compactNumber(1234)).toBe("1.2k"));
    it("1250 → '1.3k'（half-up）", () => expect(compactNumber(1250)).toBe("1.3k"));
    it("9999 → '10k'（round 后 whole）", () => expect(compactNumber(9999)).toBe("10k"));
    it("999_499 → '999.5k'", () => expect(compactNumber(999_499)).toBe("999.5k"));
    it("999_500 → '999.5k'（k 区间内最大）", () =>
      expect(compactNumber(999_500)).toBe("999.5k"));
  });

  describe("M 区间（1M ~ <1B）", () => {
    it("1_000_000 → '1M'", () => expect(compactNumber(1_000_000)).toBe("1M"));
    it("1_500_000 → '1.5M'", () => expect(compactNumber(1_500_000)).toBe("1.5M"));
    it("12_345_678 → '12.3M'", () => expect(compactNumber(12_345_678)).toBe("12.3M"));
  });

  describe("B 区间（≥1B）", () => {
    it("1_000_000_000 → '1B'", () => expect(compactNumber(1_000_000_000)).toBe("1B"));
    it("1_500_000_000 → '1.5B'", () => expect(compactNumber(1_500_000_000)).toBe("1.5B"));
  });

  describe("负数", () => {
    it("-500 → '-500'", () => expect(compactNumber(-500)).toBe("-500"));
    it("-1234 → '-1.2k'", () => expect(compactNumber(-1234)).toBe("-1.2k"));
    it("-1_500_000 → '-1.5M'", () => expect(compactNumber(-1_500_000)).toBe("-1.5M"));
  });
});

/* ────────────────────────────────────────────────────────────────────
 * 2. formatCurrencyCNY · 货币 123.45 → "¥ 123.45"
 *    规则：
 *    - 永远 2 位小数
 *    - 千分位逗号
 *    - 符号 + 空格 + 数字
 *    - 负数：'-¥ <abs>'
 * ──────────────────────────────────────────────────────────────────── */
describe("formatCurrencyCNY", () => {
  describe("基础", () => {
    it("0 → '¥ 0.00'", () => expect(formatCurrencyCNY(0)).toBe("¥ 0.00"));
    it("用户示例 123.45 → '¥ 123.45'", () =>
      expect(formatCurrencyCNY(123.45)).toBe("¥ 123.45"));
    it("整数补齐两位 100 → '¥ 100.00'", () =>
      expect(formatCurrencyCNY(100)).toBe("¥ 100.00"));
    it("一位小数补零 12.5 → '¥ 12.50'", () =>
      expect(formatCurrencyCNY(12.5)).toBe("¥ 12.50"));
  });

  describe("千分位", () => {
    it("1234.56 → '¥ 1,234.56'", () =>
      expect(formatCurrencyCNY(1234.56)).toBe("¥ 1,234.56"));
    it("1_234_567.89 → '¥ 1,234,567.89'", () =>
      expect(formatCurrencyCNY(1_234_567.89)).toBe("¥ 1,234,567.89"));
  });

  describe("rounding（用 IEEE 754 友好的样本）", () => {
    it("12.5678 → '¥ 12.57'（half-up）", () =>
      expect(formatCurrencyCNY(12.5678)).toBe("¥ 12.57"));
    it("12.5644 → '¥ 12.56'（向下）", () =>
      expect(formatCurrencyCNY(12.5644)).toBe("¥ 12.56"));
  });

  describe("负数", () => {
    it("-50 → '-¥ 50.00'", () => expect(formatCurrencyCNY(-50)).toBe("-¥ 50.00"));
    it("-1234.5 → '-¥ 1,234.50'", () =>
      expect(formatCurrencyCNY(-1234.5)).toBe("-¥ 1,234.50"));
  });
});

/* ────────────────────────────────────────────────────────────────────
 * 3. formatPercent · 百分比 0.123 → "12.3%"
 *    输入是 FRACTION（0..1 typical），可超 1，可负
 *    规则：
 *    - 保留 1 位小数；whole 时 drop 尾零
 *    - 边界 0 → '0%'，1 → '100%'
 *    - 极小值 0.0001 → '0%'（round 到 0）
 * ──────────────────────────────────────────────────────────────────── */
describe("formatPercent", () => {
  describe("基础", () => {
    it("0 → '0%'", () => expect(formatPercent(0)).toBe("0%"));
    it("0.5 → '50%'（whole drop 尾零）", () =>
      expect(formatPercent(0.5)).toBe("50%"));
    it("用户示例 0.123 → '12.3%'", () =>
      expect(formatPercent(0.123)).toBe("12.3%"));
    it("1 → '100%'", () => expect(formatPercent(1)).toBe("100%"));
  });

  describe("rounding", () => {
    it("0.1234 → '12.3%'", () => expect(formatPercent(0.1234)).toBe("12.3%"));
    it("0.1256 → '12.6%'（half-up）", () =>
      expect(formatPercent(0.1256)).toBe("12.6%"));
    it("0.001 → '0.1%'", () => expect(formatPercent(0.001)).toBe("0.1%"));
    it("0.005 → '0.5%'", () => expect(formatPercent(0.005)).toBe("0.5%"));
    it("0.0001 → '0%'（round 到 0）", () =>
      expect(formatPercent(0.0001)).toBe("0%"));
  });

  describe("超出 [0,1] 范围", () => {
    it("1.5 → '150%'（允许 >100%）", () =>
      expect(formatPercent(1.5)).toBe("150%"));
    it("-0.05 → '-5%'", () => expect(formatPercent(-0.05)).toBe("-5%"));
  });
});

/* ────────────────────────────────────────────────────────────────────
 * 4. formatDuration · 时间间隔（秒）90 → "1m30s"
 *    规则：
 *    - 单位 d / h / m / s，按从大到小拼接
 *    - 跳过中间 / 头部 / 尾部任何零的单位（"1h1s" 而不是 "1h0m1s"）
 *    - 整体 0 → "0s"
 *    - 负数 → "0s"（clamp）
 *    - 小数秒：四舍五入
 * ──────────────────────────────────────────────────────────────────── */
describe("formatDuration", () => {
  describe("基础", () => {
    it("0 → '0s'", () => expect(formatDuration(0)).toBe("0s"));
    it("1 → '1s'", () => expect(formatDuration(1)).toBe("1s"));
    it("59 → '59s'", () => expect(formatDuration(59)).toBe("59s"));
    it("60 → '1m'（drop 0s）", () => expect(formatDuration(60)).toBe("1m"));
    it("用户示例 90 → '1m30s'", () => expect(formatDuration(90)).toBe("1m30s"));
  });

  describe("小时 / 天", () => {
    it("3600 → '1h'", () => expect(formatDuration(3600)).toBe("1h"));
    it("3660 → '1h1m'", () => expect(formatDuration(3660)).toBe("1h1m"));
    it("3661 → '1h1m1s'", () => expect(formatDuration(3661)).toBe("1h1m1s"));
    it("3601 → '1h1s'（跳过中间 0m）", () =>
      expect(formatDuration(3601)).toBe("1h1s"));
    it("86400 → '1d'", () => expect(formatDuration(86400)).toBe("1d"));
    it("90061 → '1d1h1m1s'", () =>
      expect(formatDuration(90061)).toBe("1d1h1m1s"));
    it("90000 → '1d1h'", () => expect(formatDuration(90000)).toBe("1d1h"));
    it("86461 → '1d1m1s'（跳过 0h）", () =>
      expect(formatDuration(86461)).toBe("1d1m1s"));
  });

  describe("边界", () => {
    it("负数 → '0s'", () => expect(formatDuration(-5)).toBe("0s"));
    it("1.4 → '1s'（round down）", () => expect(formatDuration(1.4)).toBe("1s"));
    it("1.6 → '2s'（round up）", () => expect(formatDuration(1.6)).toBe("2s"));
    it("0.4 → '0s'", () => expect(formatDuration(0.4)).toBe("0s"));
  });
});
