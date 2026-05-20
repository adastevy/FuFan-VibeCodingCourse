"""Interactive setup wizard for muyu-search-mcp.

Clack-style interactive flow: ask one decision at a time, mark each
item as required / optional / skipped, and only at the end emit the
`claude mcp add-json` registration command (and optionally execute it).

Usage:
    muyu-search-setup                  # full interactive wizard
    muyu-search-setup --print-only     # don't run claude, just print command

The questionary dependency is optional; install via:
    pip install 'muyu-search-mcp[setup]'
    # or:  uvx --from 'muyu-search-mcp[setup]' muyu-search-setup
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from typing import Optional

try:
    import questionary
    from questionary import Style
except ImportError:  # pragma: no cover
    print(
        "❌ 缺少依赖 'questionary'。请重新安装：\n"
        "    pip install 'muyu-search-mcp[setup]'\n"
        "或：uvx --from 'muyu-search-mcp[setup]' muyu-search-setup",
        file=sys.stderr,
    )
    sys.exit(1)


WIZARD_STYLE = Style(
    [
        ("qmark", "fg:#5f87ff bold"),
        ("question", "bold"),
        ("answer", "fg:#00afaf bold"),
        ("pointer", "fg:#5f87ff bold"),
        ("highlighted", "fg:#5f87ff bold"),
        ("selected", "fg:#00afaf"),
        ("instruction", "fg:#808080 italic"),
    ]
)


BANNER = r"""
╭──────────────────────────────────────────────────────────╮
│   muyu-search-mcp · 引导式配置向导                        │
│   Grok(via OpenRouter) + Tavily + Firecrawl  ──► Claude  │
╰──────────────────────────────────────────────────────────╯
"""


PROVIDER_PRESETS = {
    "openrouter": {
        "label": "OpenRouter（推荐 · 一个 key 用所有模型，有免费额度）",
        "api_url": "https://openrouter.ai/api/v1",
        "model": "x-ai/grok-4-fast",
        "key_hint": (
            "注册 / 申请 Key：\n"
            "      · 注册：  https://openrouter.ai/sign-in\n"
            "      · 取 Key：https://openrouter.ai/settings/keys（以 sk-or-v1- 开头）\n"
            "    💰 免费额度：新账号有少量赠送额度；模型名加 :free 后缀可走免费版\n"
            "       （如 x-ai/grok-4-fast:free，2M 上下文，但有每周 token 上限 / 每日次数上限）\n"
            "    💡 想跑得快/上限高，建议充值 ≥ $10 解锁更高 RPD"
        ),
    },
    "xai": {
        "label": "xAI 官方（api.x.ai · 无免费层）",
        "api_url": "https://api.x.ai/v1",
        "model": "grok-4-fast",
        "key_hint": (
            "申请 Key： https://console.x.ai/  （以 xai- 开头）\n"
            "    💰 无免费额度，按 token 计费；适合已有 xAI 账户的同学。"
        ),
    },
    "custom": {
        "label": "自定义 / 镜像站（需手动填 base_url）",
        "api_url": "",
        "model": "grok-4-fast",
        "key_hint": "任意 OpenAI 兼容端点（如内网网关 / 第三方代理站）。",
    },
}


def section(title: str) -> None:
    print(f"\n\033[1;34m▎ {title}\033[0m")


def info(msg: str) -> None:
    print(f"  \033[2m{msg}\033[0m")


def ok(msg: str) -> None:
    print(f"  \033[32m✓\033[0m {msg}")


def warn(msg: str) -> None:
    print(f"  \033[33m⚠\033[0m {msg}")


def err(msg: str) -> None:
    print(f"  \033[31m✗\033[0m {msg}")


def _ask_text(message: str, *, default: str = "", validate=None, secret: bool = False) -> str:
    q = (questionary.password if secret else questionary.text)(
        message, default=default, validate=validate, style=WIZARD_STYLE
    )
    answer = q.ask()
    if answer is None:
        print("\n已取消。"); sys.exit(130)
    return answer.strip()


def _ask_select(message: str, choices: list, default=None) -> str:
    answer = questionary.select(message, choices=choices, default=default, style=WIZARD_STYLE).ask()
    if answer is None:
        print("\n已取消。"); sys.exit(130)
    return answer


def _ask_confirm(message: str, default: bool = True) -> bool:
    answer = questionary.confirm(message, default=default, style=WIZARD_STYLE).ask()
    if answer is None:
        print("\n已取消。"); sys.exit(130)
    return answer


# ── steps ─────────────────────────────────────────────────────────────


def check_prerequisites() -> None:
    section("第 1 步 · 环境检查")
    has_claude = shutil.which("claude") is not None
    has_uvx = shutil.which("uvx") is not None
    has_python = sys.version_info >= (3, 10)

    (ok if has_python else err)(f"Python ≥ 3.10  （当前 {sys.version.split()[0]}）")
    (ok if has_claude else warn)("Claude Code CLI（`claude` 命令）" + ("" if has_claude else " — 未检测到，向导结束后请手动注册"))
    (ok if has_uvx else warn)("uv / uvx" + ("" if has_uvx else " — 未检测到，建议安装：https://docs.astral.sh/uv/"))


def step_provider() -> tuple[str, str, str, str]:
    section("第 2 步 · 选择 Grok 服务来源（必需）")
    choices = [
        questionary.Choice(title=cfg["label"], value=name) for name, cfg in PROVIDER_PRESETS.items()
    ]
    provider = _ask_select("使用哪个 provider？", choices=choices, default=choices[0])
    preset = PROVIDER_PRESETS[provider]

    if provider == "custom":
        api_url = _ask_text("自定义 base_url（OpenAI 兼容，如 https://your-mirror/v1）：")
    else:
        api_url = preset["api_url"]
        ok(f"base_url = {api_url}")

    info(preset["key_hint"])
    api_key = _ask_text(
        "API Key（必需，输入时已隐藏）：",
        secret=True,
        validate=lambda v: True if v and len(v) >= 8 else "Key 太短，请检查",
    )

    model = _ask_text("默认模型（回车使用预设）：", default=preset["model"])
    return provider, api_url, api_key, model


def step_tavily() -> tuple[Optional[str], Optional[str]]:
    section("第 3 步 · Tavily（可选 · 用于 web_fetch / web_map）")
    info("未配置时，web_fetch / web_map 工具会被自动禁用，web_search 仍可用。")
    info("注册：     https://app.tavily.com/home")
    info("定价说明： https://www.tavily.com/pricing")
    info("💰 免费额度：1,000 次 API 调用 / 月（无需绑卡）；超出后 $0.008 / 次（按需付费）。")
    if not _ask_confirm("现在配置 Tavily？", default=False):
        warn("已跳过 Tavily — web_fetch / web_map 将不可用")
        return None, None
    key = _ask_text("TAVILY_API_KEY（控制台 → API Keys）：", secret=True,
                    validate=lambda v: True if v else "不能为空（如要跳过请回到上一步选择 No）")
    url = _ask_text("TAVILY_API_URL（回车使用默认）：", default="https://api.tavily.com")
    return key, url


def step_firecrawl() -> Optional[str]:
    section("第 4 步 · Firecrawl（可选 · Tavily 抓取失败时兜底）")
    info("注册：     https://www.firecrawl.dev/signin?view=signup")
    info("定价说明： https://www.firecrawl.dev/pricing")
    info("💰 免费额度：1,000 credits / 月（无需绑卡）；付费起步 Hobby $16/月（年付）→ 5,000 credits/月。")
    if not _ask_confirm("现在配置 Firecrawl？", default=False):
        warn("已跳过 Firecrawl — Tavily 失败时不再降级")
        return None
    return _ask_text("FIRECRAWL_API_KEY：", secret=True,
                     validate=lambda v: True if v else "不能为空")


# ── command emit ──────────────────────────────────────────────────────


def build_env(provider, api_url, api_key, model, tavily_key, tavily_url, firecrawl_key) -> dict[str, str]:
    env: dict[str, str] = {
        "MUYU_PROVIDER": provider,
        "MUYU_API_URL": api_url,
        "MUYU_API_KEY": api_key,
        "MUYU_MODEL": model,
    }
    if tavily_key:
        env["TAVILY_API_KEY"] = tavily_key
        if tavily_url:
            env["TAVILY_API_URL"] = tavily_url
    if firecrawl_key:
        env["FIRECRAWL_API_KEY"] = firecrawl_key
    return env


def build_register_command(env: dict[str, str], package_spec: str, scope: str) -> list[str]:
    config_payload = {
        "type": "stdio",
        "command": "uvx",
        "args": ["--from", package_spec, "muyu-search"],
        "env": env,
    }
    return [
        "claude", "mcp", "add-json", "muyu-search",
        "--scope", scope,
        json.dumps(config_payload, ensure_ascii=False),
    ]


def step_scope(default_scope: str) -> str:
    section("第 5 步 · 选择 MCP 作用域（决定这条配置写到哪里）")
    info("project — 写到当前项目的 .mcp.json，可随项目 git 共享，只在该项目生效（推荐）")
    info("user    — 写到用户全局配置，所有项目可见")
    info("local   — 写到当前项目的本地私有配置（不入 git），仅自己可见")
    choices = [
        questionary.Choice(title="project（当前项目，推荐 · 团队/学员场景）", value="project"),
        questionary.Choice(title="user（全局，所有项目可见）", value="user"),
        questionary.Choice(title="local（当前项目，仅本机私有）", value="local"),
    ]
    default = next((c for c in choices if c.value == default_scope), choices[0])
    return _ask_select("注册到哪个 scope？", choices=choices, default=default)


def step_review_and_register(env: dict[str, str], package_spec: str, scope: str, print_only: bool) -> None:
    section("第 6 步 · 确认并注册到 Claude Code")

    masked_env = {
        k: (v[:4] + "***" + v[-4:] if "KEY" in k and len(v) > 8 else v) for k, v in env.items()
    }
    print("  即将注册的 MCP（敏感字段已脱敏）：")
    for k, v in masked_env.items():
        print(f"    {k} = {v}")

    cmd = build_register_command(env, package_spec, scope)
    info(f"作用域：--scope {scope}（写入：" + (
        ".mcp.json（项目内，可入 git）" if scope == "project" else
        "~/.claude.json 用户全局" if scope == "user" else
        ".claude/settings.local.json（项目内本地私有）"
    ) + "）")
    print("\n  对应命令：")
    print("    " + " ".join(_shell_quote(p) for p in cmd))

    if print_only or shutil.which("claude") is None:
        warn("未执行 claude 命令（--print-only 或未检测到 claude CLI）。复制上面命令手动运行即可。")
        return

    if not _ask_confirm("现在执行注册？", default=True):
        warn("已跳过自动注册。")
        return

    try:
        subprocess.run(["claude", "mcp", "remove", "muyu-search"], check=False,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    except FileNotFoundError:
        err("claude CLI 未找到。请手动复制命令运行。")
        return

    if result.returncode == 0:
        ok("已注册。重启 Claude Code 即可在 MCP 列表里看到 muyu-search。")
    else:
        err("注册失败：")
        print(result.stdout)
        print(result.stderr)


def _shell_quote(s: str) -> str:
    if not s or any(c in s for c in " \t\n'\"\\$`"):
        return "'" + s.replace("'", "'\\''") + "'"
    return s


# ── entry ─────────────────────────────────────────────────────────────


def _resolve_provider_url(provider: str, custom_url: Optional[str]) -> tuple[str, str]:
    preset = PROVIDER_PRESETS.get(provider) or PROVIDER_PRESETS["openrouter"]
    url = custom_url or preset["api_url"]
    if not url:
        raise SystemExit("非交互模式下使用 custom provider 时，必须通过 --api-url 提供 base_url")
    return url, preset["model"]


def run_non_interactive(args: argparse.Namespace) -> None:
    """Non-interactive install: take everything from CLI args / env and write
    .mcp.json directly. Designed to be driven by Claude Code itself."""
    if not args.api_key:
        raise SystemExit("--api-key 是必填项（或设置环境变量 MUYU_API_KEY）")
    if args.provider not in PROVIDER_PRESETS:
        raise SystemExit(f"--provider 必须是 {list(PROVIDER_PRESETS)} 之一，得到 {args.provider!r}")

    api_url, default_model = _resolve_provider_url(args.provider, args.api_url)
    model = args.model or default_model

    env = build_env(
        provider=args.provider,
        api_url=api_url,
        api_key=args.api_key,
        model=model,
        tavily_key=args.tavily_key or None,
        tavily_url="https://api.tavily.com" if args.tavily_key else None,
        firecrawl_key=args.firecrawl_key or None,
    )
    cmd = build_register_command(env, args.package_spec, args.scope)

    masked = {k: (v[:6] + "***" + v[-4:] if "KEY" in k and len(v) > 12 else v) for k, v in env.items()}
    print("==> 即将注册的 MCP（敏感字段已脱敏）：")
    for k, v in masked.items():
        print(f"      {k} = {v}")
    print(f"==> Scope: {args.scope}")

    if args.print_only:
        print("\n==> --print-only 模式，仅打印命令，不执行：")
        print("    " + " ".join(_shell_quote(p) for p in cmd))
        return

    if shutil.which("claude") is None:
        raise SystemExit("未找到 claude CLI，无法自动注册。请先安装 Claude Code 或使用 --print-only 拿命令手动执行。")

    subprocess.run(["claude", "mcp", "remove", "muyu-search"], check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        print("==> 注册失败：")
        print(result.stdout)
        print(result.stderr)
        raise SystemExit(result.returncode)
    print(f"\n==> 已注册到 scope={args.scope}。运行 `claude mcp list` 验证，重启 Claude Code 后 `/mcp` 即可看到 muyu-search。")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="muyu-search-mcp 配置向导（默认交互式；加 --non-interactive 走纯参数模式）",
    )
    parser.add_argument("--print-only", action="store_true", help="只打印命令，不执行 claude mcp add-json")
    parser.add_argument(
        "--package-spec",
        default=os.getenv("MUYU_PACKAGE_SPEC", "muyu-search-mcp"),
        help="uvx 安装时使用的包说明符（默认: muyu-search-mcp；本地开发可填绝对路径）",
    )
    parser.add_argument(
        "--scope",
        choices=["project", "user", "local"],
        default=os.getenv("MUYU_SCOPE", "project"),
        help="MCP 作用域（默认: project，写入当前目录 .mcp.json）",
    )
    # ── non-interactive mode args ───────────────────────────────
    parser.add_argument("--non-interactive", action="store_true",
                        help="跳过所有交互问答，全部从 CLI 参数读取（适合 Claude Code 自动配置）")
    parser.add_argument("--provider", default="openrouter",
                        choices=list(PROVIDER_PRESETS.keys()),
                        help="provider（默认: openrouter）")
    parser.add_argument("--api-key", default=os.getenv("MUYU_API_KEY"),
                        help="主 API Key（必填；OpenRouter 以 sk-or-v1- 开头）")
    parser.add_argument("--api-url", default=None,
                        help="自定义 base_url（仅 provider=custom 时需要）")
    parser.add_argument("--model", default=None,
                        help="模型名（默认走 provider 预设，OpenRouter=x-ai/grok-4-fast）")
    parser.add_argument("--tavily-key", default=os.getenv("TAVILY_API_KEY"),
                        help="Tavily Key（可选，不填则 web_fetch / web_map 被隐藏）")
    parser.add_argument("--firecrawl-key", default=os.getenv("FIRECRAWL_API_KEY"),
                        help="Firecrawl Key（可选，仅用于 Tavily 失败时兜底）")

    args = parser.parse_args()

    if args.non_interactive:
        run_non_interactive(args)
        return

    print(BANNER)
    check_prerequisites()

    provider, api_url, api_key, model = step_provider()
    tavily_key, tavily_url = step_tavily()
    firecrawl_key = step_firecrawl()

    env = build_env(provider, api_url, api_key, model, tavily_key, tavily_url, firecrawl_key)
    scope = step_scope(args.scope)
    step_review_and_register(env, args.package_spec, scope, args.print_only)

    print("\n\033[1;32m完成。\033[0m 在 Claude Code 里运行 `/mcp` 应该能看到 muyu-search。")
    if scope == "project":
        info("提示：项目根目录会生成 / 更新 .mcp.json，建议提交到 git 让团队共享。")


if __name__ == "__main__":
    main()
