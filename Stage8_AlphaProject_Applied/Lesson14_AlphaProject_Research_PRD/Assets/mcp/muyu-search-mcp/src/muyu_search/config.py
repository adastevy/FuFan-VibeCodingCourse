"""muyu-search-mcp runtime configuration.

Env-var prefix: MUYU_*  (e.g. MUYU_API_KEY, MUYU_MODEL).

Provider modes (MUYU_PROVIDER):
  - openrouter (default): base_url=https://openrouter.ai/api/v1, model=x-ai/grok-4-fast
  - xai:                  base_url=https://api.x.ai/v1,         model=grok-4-fast
  - custom:               user supplies MUYU_API_URL & MUYU_MODEL themselves
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional


_PROVIDER_DEFAULTS: dict[str, dict[str, str]] = {
    "openrouter": {
        "api_url": "https://openrouter.ai/api/v1",
        "model": "x-ai/grok-4-fast",
    },
    "xai": {
        "api_url": "https://api.x.ai/v1",
        "model": "grok-4-fast",
    },
    "custom": {
        "api_url": "",
        "model": "grok-4-fast",
    },
}


def _env(*names: str, default: Optional[str] = None) -> Optional[str]:
    for n in names:
        v = os.getenv(n)
        if v not in (None, ""):
            return v
    return default


def _bool(*names: str, default: bool = False) -> bool:
    v = _env(*names)
    if v is None:
        return default
    return v.lower() in ("true", "1", "yes", "on")


class Config:
    _instance = None

    _SETUP_HINT = (
        "请运行引导脚本完成配置：\n"
        "  uvx --from muyu-search-mcp muyu-search-setup\n"
        "或手动设置环境变量 MUYU_API_KEY（必需）/ MUYU_PROVIDER（openrouter|xai|custom）。"
    )

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._config_file = None
            cls._instance._cached_model = None
        return cls._instance

    # ── persistent config file ─────────────────────────────────────────

    @property
    def config_file(self) -> Path:
        if self._config_file is None:
            config_dir = Path.home() / ".config" / "muyu-search"
            try:
                config_dir.mkdir(parents=True, exist_ok=True)
            except OSError:
                config_dir = Path.cwd() / ".muyu-search"
                config_dir.mkdir(parents=True, exist_ok=True)
            self._config_file = config_dir / "config.json"
        return self._config_file

    def _load_config_file(self) -> dict:
        if not self.config_file.exists():
            return {}
        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}

    def _save_config_file(self, config_data: dict) -> None:
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(config_data, f, ensure_ascii=False, indent=2)
        except IOError as e:
            raise ValueError(f"无法保存配置文件: {str(e)}")

    # ── provider selection ─────────────────────────────────────────────

    @property
    def provider(self) -> str:
        v = (_env("MUYU_PROVIDER") or "").strip().lower()
        if v in _PROVIDER_DEFAULTS:
            return v
        legacy_url = _env("GROK_API_URL") or ""
        if "x.ai" in legacy_url:
            return "xai"
        if "openrouter" in legacy_url:
            return "openrouter"
        if legacy_url:
            return "custom"
        return "openrouter"

    @property
    def grok_api_url(self) -> str:
        url = _env("MUYU_API_URL", "GROK_API_URL")
        if not url:
            url = _PROVIDER_DEFAULTS[self.provider]["api_url"]
        if not url:
            raise ValueError(f"API URL 未配置。\n{self._SETUP_HINT}")
        return url

    @property
    def grok_api_key(self) -> str:
        key = _env("MUYU_API_KEY", "GROK_API_KEY", "OPENROUTER_API_KEY")
        if not key:
            raise ValueError(f"API Key 未配置。\n{self._SETUP_HINT}")
        return key

    # ── OpenRouter attribution headers (optional but recommended) ──────

    @property
    def openrouter_referer(self) -> Optional[str]:
        return _env("MUYU_OPENROUTER_REFERER", default="https://github.com/muyu/muyu-search-mcp")

    @property
    def openrouter_title(self) -> Optional[str]:
        return _env("MUYU_OPENROUTER_TITLE", default="muyu-search-mcp")

    def provider_extra_headers(self) -> dict[str, str]:
        if self.provider == "openrouter":
            headers: dict[str, str] = {}
            if self.openrouter_referer:
                headers["HTTP-Referer"] = self.openrouter_referer
            if self.openrouter_title:
                headers["X-Title"] = self.openrouter_title
            return headers
        return {}

    # ── debug / retry knobs ────────────────────────────────────────────

    @property
    def debug_enabled(self) -> bool:
        return _bool("MUYU_DEBUG", "GROK_DEBUG")

    @property
    def retry_max_attempts(self) -> int:
        return int(_env("MUYU_RETRY_MAX_ATTEMPTS", "GROK_RETRY_MAX_ATTEMPTS", default="3"))

    @property
    def retry_multiplier(self) -> float:
        return float(_env("MUYU_RETRY_MULTIPLIER", "GROK_RETRY_MULTIPLIER", default="1"))

    @property
    def retry_max_wait(self) -> int:
        return int(_env("MUYU_RETRY_MAX_WAIT", "GROK_RETRY_MAX_WAIT", default="10"))

    # ── Tavily / Firecrawl ─────────────────────────────────────────────

    @property
    def tavily_enabled(self) -> bool:
        return _bool("MUYU_TAVILY_ENABLED", "TAVILY_ENABLED", default=True)

    @property
    def tavily_api_url(self) -> str:
        return _env("TAVILY_API_URL", default="https://api.tavily.com") or "https://api.tavily.com"

    @property
    def tavily_api_key(self) -> Optional[str]:
        return _env("TAVILY_API_KEY")

    @property
    def firecrawl_api_url(self) -> str:
        return _env("FIRECRAWL_API_URL", default="https://api.firecrawl.dev/v2") or "https://api.firecrawl.dev/v2"

    @property
    def firecrawl_api_key(self) -> Optional[str]:
        return _env("FIRECRAWL_API_KEY")

    # ── logging ────────────────────────────────────────────────────────

    @property
    def log_level(self) -> str:
        return (_env("MUYU_LOG_LEVEL", "GROK_LOG_LEVEL", default="INFO") or "INFO").upper()

    @property
    def log_dir(self) -> Path:
        log_dir_str = _env("MUYU_LOG_DIR", "GROK_LOG_DIR", default="logs") or "logs"
        log_dir = Path(log_dir_str)
        if log_dir.is_absolute():
            return log_dir

        home_log_dir = Path.home() / ".config" / "muyu-search" / log_dir_str
        try:
            home_log_dir.mkdir(parents=True, exist_ok=True)
            return home_log_dir
        except OSError:
            pass

        cwd_log_dir = Path.cwd() / log_dir_str
        try:
            cwd_log_dir.mkdir(parents=True, exist_ok=True)
            return cwd_log_dir
        except OSError:
            pass

        tmp_log_dir = Path("/tmp") / "muyu-search" / log_dir_str
        tmp_log_dir.mkdir(parents=True, exist_ok=True)
        return tmp_log_dir

    # ── model ──────────────────────────────────────────────────────────

    def _apply_model_suffix(self, model: str) -> str:
        try:
            url = self.grok_api_url
        except ValueError:
            return model
        if "openrouter" in url and ":online" not in model and not model.endswith(":free"):
            return f"{model}:online"
        return model

    @property
    def grok_model(self) -> str:
        if self._cached_model is not None:
            return self._cached_model

        model = (
            _env("MUYU_MODEL", "GROK_MODEL")
            or self._load_config_file().get("model")
            or _PROVIDER_DEFAULTS[self.provider]["model"]
        )
        self._cached_model = self._apply_model_suffix(model)
        return self._cached_model

    def set_model(self, model: str) -> None:
        config_data = self._load_config_file()
        config_data["model"] = model
        self._save_config_file(config_data)
        self._cached_model = self._apply_model_suffix(model)

    # ── reporting ──────────────────────────────────────────────────────

    @staticmethod
    def _mask_api_key(key: Optional[str]) -> str:
        if not key:
            return "未配置"
        if len(key) <= 8:
            return "***"
        return f"{key[:4]}{'*' * (len(key) - 8)}{key[-4:]}"

    def get_config_info(self) -> dict:
        try:
            api_url = self.grok_api_url
            api_key_masked = self._mask_api_key(self.grok_api_key)
            config_status = "✅ 配置完整"
        except ValueError as e:
            api_url = "未配置"
            api_key_masked = "未配置"
            config_status = f"❌ 配置错误: {str(e)}"

        return {
            "MUYU_PROVIDER": self.provider,
            "MUYU_API_URL": api_url,
            "MUYU_API_KEY": api_key_masked,
            "MUYU_MODEL": self.grok_model,
            "MUYU_DEBUG": self.debug_enabled,
            "MUYU_LOG_LEVEL": self.log_level,
            "MUYU_LOG_DIR": str(self.log_dir),
            "TAVILY_API_URL": self.tavily_api_url,
            "TAVILY_ENABLED": self.tavily_enabled,
            "TAVILY_API_KEY": self._mask_api_key(self.tavily_api_key),
            "FIRECRAWL_API_URL": self.firecrawl_api_url,
            "FIRECRAWL_API_KEY": self._mask_api_key(self.firecrawl_api_key),
            "config_status": config_status,
        }


config = Config()
