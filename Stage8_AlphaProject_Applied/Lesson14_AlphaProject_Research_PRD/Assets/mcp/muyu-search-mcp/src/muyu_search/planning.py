"""Planning state machine for muyu-search-mcp.

Layered, complexity-adaptive search planning. Key features over the
naive version:
  - **Persistence**: each session is mirrored to
    ~/.config/muyu-search/sessions/{sid}.json so MCP process restarts
    don't lose context.
  - **LRU + TTL**: in-memory cap (MAX_SESSIONS) + 7-day disk expiry.
  - **Batch writes**: query_decomposition, search_strategy, tool_selection
    all accept a list in one shot — cuts MCP round-trips by ~3×.
  - **Hard validation**: depends_on cycle detection, unknown-id refs,
    duplicate sub-query ids, search_term ≤8-word enforcement, purpose
    must point to a declared sub-query id.
  - **Complexity floor**: ≥2 unverified_terms or ambiguities → level ≥ 2.
  - **Unverified-terms closure**: every unverified_term must show up in
    at least one sub-query.goal before plan is_complete.
  - **Auto Level-1 strategy seed**: Level 1 plans skip search_strategy
    phase but the engine auto-derives one term per sub-query.
  - **Revision tracking**: per-phase revision counter; >3 yields a warning.
  - **Budget tracking**: actual_tool_calls counted at execution time;
    flagged when exceeding estimated_tool_calls.
  - **Gate API**: check_gate() returns the exact reason a plan isn't
    runnable yet — used by web_search to enforce planning.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ─── schemas (used by validators & self-documentation) ───────────


class IntentOutput(BaseModel):
    core_question: str
    query_type: Literal["factual", "comparative", "exploratory", "analytical"]
    time_sensitivity: Literal["realtime", "recent", "historical", "irrelevant"]
    domain: Optional[str] = None
    premise_valid: Optional[bool] = None
    ambiguities: Optional[list[str]] = None
    unverified_terms: Optional[list[str]] = None


class ComplexityOutput(BaseModel):
    level: Literal[1, 2, 3]
    estimated_sub_queries: int = Field(ge=1, le=20)
    estimated_tool_calls: int = Field(ge=1, le=50)
    justification: str


class SubQuery(BaseModel):
    id: str
    goal: str
    expected_output: str
    tool_hint: Optional[str] = None
    boundary: str
    depends_on: Optional[list[str]] = None


class SearchTerm(BaseModel):
    term: str
    purpose: str
    round: int = Field(ge=1)

    @field_validator("term")
    @classmethod
    def _max_8_words(cls, v: str) -> str:
        n = len([w for w in v.split() if w])
        if n > 8:
            raise ValueError(f"term must be ≤8 words, got {n}: {v!r}")
        return v


class ToolPlanItem(BaseModel):
    sub_query_id: str
    tool: Literal["web_search", "web_fetch", "web_map"]
    reason: str
    params: Optional[dict] = None


# ─── phase metadata ──────────────────────────────────────────────


PHASE_NAMES = [
    "intent_analysis",
    "complexity_assessment",
    "query_decomposition",
    "search_strategy",
    "tool_selection",
    "execution_order",
]

REQUIRED_PHASES: dict[int, set[str]] = {
    1: {"intent_analysis", "complexity_assessment", "query_decomposition"},
    2: {
        "intent_analysis",
        "complexity_assessment",
        "query_decomposition",
        "search_strategy",
        "tool_selection",
    },
    3: set(PHASE_NAMES),
}

_ACCUMULATIVE_LIST_PHASES = {"query_decomposition", "tool_selection"}
_MERGE_STRATEGY_PHASE = "search_strategy"


# ─── tunables ────────────────────────────────────────────────────


MAX_SESSIONS = 64
SESSION_TTL_SECONDS = 7 * 24 * 3600
SESSION_DIR = Path.home() / ".config" / "muyu-search" / "sessions"
RESULT_CACHE_MAX = 256
RESULT_CACHE_TTL = 3600
REVISION_WARN_THRESHOLD = 3


def _split_csv(value: str) -> list[str]:
    return [s.strip() for s in value.split(",") if s.strip()] if value else []


def _ensure_dir() -> Path:
    try:
        SESSION_DIR.mkdir(parents=True, exist_ok=True)
        return SESSION_DIR
    except OSError:
        alt = Path("/tmp/muyu-search/sessions")
        alt.mkdir(parents=True, exist_ok=True)
        return alt


# ─── session ─────────────────────────────────────────────────────


class PhaseRecord(BaseModel):
    phase: str
    thought: str
    data: dict | list | None = None
    confidence: float = 1.0
    revision_count: int = 0


class PlanningSession(BaseModel):
    session_id: str
    phases: dict[str, PhaseRecord] = Field(default_factory=dict)
    complexity_level: Optional[int] = None
    last_access: float = Field(default_factory=time.time)
    actual_tool_calls: int = 0
    warnings: list[str] = Field(default_factory=list)

    @property
    def completed_phases(self) -> list[str]:
        return [p for p in PHASE_NAMES if p in self.phases]

    def required_phases(self) -> set[str]:
        return REQUIRED_PHASES.get(self.complexity_level or 3, REQUIRED_PHASES[3])

    def _intent_data(self) -> dict:
        rec = self.phases.get("intent_analysis")
        return rec.data if rec and isinstance(rec.data, dict) else {}

    def unverified_terms(self) -> list[str]:
        return list(self._intent_data().get("unverified_terms") or [])

    def ambiguities(self) -> list[str]:
        return list(self._intent_data().get("ambiguities") or [])

    def sub_query_items(self) -> list[dict]:
        rec = self.phases.get("query_decomposition")
        if not rec or not isinstance(rec.data, list):
            return []
        return [it for it in rec.data if isinstance(it, dict)]

    def sub_query_ids(self) -> list[str]:
        return [it.get("id", "") for it in self.sub_query_items()]

    def unverified_closure_gaps(self) -> list[str]:
        unverified = [t.lower() for t in self.unverified_terms() if t]
        if not unverified:
            return []
        blob = "\n".join(it.get("goal", "") for it in self.sub_query_items()).lower()
        return [t for t in unverified if t not in blob]

    def is_complete(self) -> tuple[bool, Optional[str]]:
        if self.complexity_level is None:
            return False, "complexity_assessment not done"
        missing = self.required_phases() - set(self.phases.keys())
        if missing:
            return False, f"phases missing: {sorted(missing)}"
        gaps = self.unverified_closure_gaps()
        if gaps:
            return False, f"unverified_terms not covered by any sub-query goal: {gaps}"
        return True, None

    def build_executable_plan(self) -> dict:
        return {name: rec.data for name, rec in self.phases.items()}

    def touch(self) -> None:
        self.last_access = time.time()


# ─── content-addressed result cache (LRU + TTL) ──────────────────


class ResultCache:
    """Tool-result cache shared across sessions. Skips API calls for
    repeated (tool, normalized-payload) tuples within TTL."""

    def __init__(self, max_size: int = RESULT_CACHE_MAX, ttl: float = RESULT_CACHE_TTL):
        self._max = max_size
        self._ttl = ttl
        self._lock = asyncio.Lock()
        self._store: OrderedDict[str, tuple[float, object]] = OrderedDict()

    @staticmethod
    def _key(tool: str, payload: str) -> str:
        return f"{tool}::{payload.strip().lower()}"

    async def get(self, tool: str, payload: str):
        k = self._key(tool, payload)
        async with self._lock:
            if k not in self._store:
                return None
            ts, val = self._store[k]
            if time.time() - ts > self._ttl:
                del self._store[k]
                return None
            self._store.move_to_end(k)
            return val

    async def set(self, tool: str, payload: str, value) -> None:
        k = self._key(tool, payload)
        async with self._lock:
            self._store[k] = (time.time(), value)
            self._store.move_to_end(k)
            while len(self._store) > self._max:
                self._store.popitem(last=False)


# ─── engine ──────────────────────────────────────────────────────


class PlanningEngine:
    def __init__(
        self,
        max_sessions: int = MAX_SESSIONS,
        ttl: float = SESSION_TTL_SECONDS,
    ):
        self._max = max_sessions
        self._ttl = ttl
        self._sessions: OrderedDict[str, PlanningSession] = OrderedDict()
        self._dir = _ensure_dir()

    # ── persistence ──

    def _path(self, sid: str) -> Path:
        safe = "".join(c for c in sid if c.isalnum() or c in "-_")[:64] or "x"
        return self._dir / f"{safe}.json"

    def _persist(self, session: PlanningSession) -> None:
        try:
            self._path(session.session_id).write_text(
                session.model_dump_json(), encoding="utf-8"
            )
        except OSError:
            pass

    def _load_from_disk(self, sid: str) -> Optional[PlanningSession]:
        p = self._path(sid)
        if not p.exists():
            return None
        try:
            session = PlanningSession.model_validate_json(p.read_text(encoding="utf-8"))
        except Exception:
            return None
        if time.time() - session.last_access > self._ttl:
            try:
                p.unlink()
            except OSError:
                pass
            return None
        return session

    def _evict(self) -> None:
        while len(self._sessions) > self._max:
            self._sessions.popitem(last=False)

    # ── session lifecycle ──

    def get_session(self, session_id: str) -> Optional[PlanningSession]:
        if not session_id:
            return None
        if session_id in self._sessions:
            session = self._sessions[session_id]
            self._sessions.move_to_end(session_id)
            return session
        loaded = self._load_from_disk(session_id)
        if loaded:
            self._sessions[session_id] = loaded
            self._evict()
            return loaded
        return None

    def _new_session(self, sid: Optional[str] = None) -> PlanningSession:
        sid = sid or uuid.uuid4().hex[:12]
        session = PlanningSession(session_id=sid)
        self._sessions[sid] = session
        self._evict()
        return session

    # ── core writer ──

    def process_phase(
        self,
        phase: str,
        thought: str,
        session_id: str = "",
        is_revision: bool = False,
        revises_phase: str = "",
        confidence: float = 1.0,
        phase_data: dict | list | None = None,
    ) -> dict:
        session = self.get_session(session_id) if session_id else None
        if session is None:
            session = self._new_session(session_id)

        target = revises_phase if is_revision and revises_phase else phase
        if target not in PHASE_NAMES:
            return {"error": f"Unknown phase: {target}. Valid: {', '.join(PHASE_NAMES)}"}

        prior = session.phases.get(target)
        new_revisions = (prior.revision_count if prior else 0) + (1 if is_revision else 0)

        # Snapshot for rollback on validation failure
        snapshot = {k: v.model_copy(deep=True) for k, v in session.phases.items()}
        snapshot_level = session.complexity_level

        if target in _ACCUMULATIVE_LIST_PHASES:
            items = phase_data if isinstance(phase_data, list) else [phase_data]
            if is_revision or target not in session.phases:
                session.phases[target] = PhaseRecord(
                    phase=target,
                    thought=thought,
                    data=list(items),
                    confidence=confidence,
                    revision_count=new_revisions,
                )
            else:
                existing = session.phases[target]
                assert isinstance(existing.data, list)
                existing.data.extend(items)
                existing.thought = thought
                existing.confidence = confidence
        elif target == _MERGE_STRATEGY_PHASE:
            if is_revision or target not in session.phases:
                session.phases[target] = PhaseRecord(
                    phase=target,
                    thought=thought,
                    data=phase_data,
                    confidence=confidence,
                    revision_count=new_revisions,
                )
            else:
                existing = session.phases[target]
                if isinstance(existing.data, dict) and isinstance(phase_data, dict):
                    existing.data.setdefault("search_terms", []).extend(
                        phase_data.get("search_terms", [])
                    )
                    if phase_data.get("approach"):
                        existing.data["approach"] = phase_data["approach"]
                    if phase_data.get("fallback_plan"):
                        existing.data["fallback_plan"] = phase_data["fallback_plan"]
                    existing.thought = thought
                    existing.confidence = confidence
                else:
                    session.phases[target] = PhaseRecord(
                        phase=target,
                        thought=thought,
                        data=phase_data,
                        confidence=confidence,
                        revision_count=new_revisions,
                    )
        else:
            session.phases[target] = PhaseRecord(
                phase=target,
                thought=thought,
                data=phase_data,
                confidence=confidence,
                revision_count=new_revisions,
            )

        # complexity assessment: enforce floor
        if target == "complexity_assessment" and isinstance(phase_data, dict):
            level = phase_data.get("level")
            if level in (1, 2, 3):
                floor = self._complexity_floor(session)
                if floor and level < floor:
                    level = floor
                    session.warnings.append(
                        f"complexity floor bumped to {floor} (≥2 unverified_terms or ambiguities)"
                    )
                session.complexity_level = level
                rec = session.phases[target]
                if isinstance(rec.data, dict):
                    rec.data["level"] = level

        # validate decomposition; roll back on failure
        if target == "query_decomposition":
            err = self._validate_decomposition(session)
            if err:
                session.phases = snapshot
                session.complexity_level = snapshot_level
                return self._error_result(session, err)

        # validate search_terms; roll back on failure
        if target == "search_strategy":
            err = self._validate_search_terms(session)
            if err:
                session.phases = snapshot
                session.complexity_level = snapshot_level
                return self._error_result(session, err)

        # revision warning
        if new_revisions > REVISION_WARN_THRESHOLD:
            session.warnings.append(
                f"{target} revised {new_revisions} times — consider simpler approach"
            )

        # Level-1 auto-seed: when decomposition lands and complexity==1, derive a strategy
        if (
            target == "query_decomposition"
            and session.complexity_level == 1
            and "search_strategy" not in session.phases
        ):
            self._auto_seed_level1_strategy(session)

        session.touch()
        self._persist(session)
        return self._result_for(session)

    # ── result envelopes ──

    def _result_for(self, session: PlanningSession) -> dict:
        complete, gate_reason = session.is_complete()
        result: dict = {
            "session_id": session.session_id,
            "completed_phases": session.completed_phases,
            "complexity_level": session.complexity_level,
            "plan_complete": complete,
        }
        if not complete and gate_reason:
            result["gate_reason"] = gate_reason
        remaining = [
            p for p in PHASE_NAMES if p in session.required_phases() and p not in session.phases
        ]
        if remaining:
            result["phases_remaining"] = remaining
        if complete:
            result["executable_plan"] = session.build_executable_plan()
        if session.warnings:
            result["warnings"] = list(session.warnings)
        return result

    def _error_result(self, session: PlanningSession, err: str) -> dict:
        return {
            "session_id": session.session_id,
            "error": err,
            "completed_phases": session.completed_phases,
        }

    # ── validators ──

    @staticmethod
    def _complexity_floor(session: PlanningSession) -> Optional[int]:
        if len(session.unverified_terms()) >= 2 or len(session.ambiguities()) >= 2:
            return 2
        return None

    @staticmethod
    def _validate_decomposition(session: PlanningSession) -> Optional[str]:
        items = session.sub_query_items()
        if not items:
            return None
        ids: list[str] = []
        deps: dict[str, list[str]] = {}
        for it in items:
            sid = it.get("id")
            if not sid:
                return "sub-query missing id"
            if sid in ids:
                return f"duplicate sub-query id: {sid}"
            ids.append(sid)
            deps[sid] = list(it.get("depends_on") or [])
        for sid, ds in deps.items():
            for d in ds:
                if d not in ids:
                    return f"sub-query {sid!r} depends_on unknown id: {d!r}"
        # cycle detection
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {sid: WHITE for sid in ids}

        def dfs(u: str) -> bool:
            color[u] = GRAY
            for v in deps.get(u, []):
                if color[v] == GRAY:
                    return True
                if color[v] == WHITE and dfs(v):
                    return True
            color[u] = BLACK
            return False

        for sid in ids:
            if color[sid] == WHITE and dfs(sid):
                return f"cycle detected in depends_on around: {sid}"
        return None

    @staticmethod
    def _validate_search_terms(session: PlanningSession) -> Optional[str]:
        rec = session.phases.get("search_strategy")
        if not rec or not isinstance(rec.data, dict):
            return None
        declared = set(session.sub_query_ids())
        if not declared:
            return None
        for t in rec.data.get("search_terms", []):
            if not isinstance(t, dict):
                continue
            purpose = t.get("purpose")
            if purpose and purpose not in declared:
                return f"search_term.purpose {purpose!r} not in declared sub-query ids"
            term = t.get("term") or ""
            if len(term.split()) > 8:
                return f"search_term.term must be ≤8 words: {term!r}"
        return None

    @staticmethod
    def _auto_seed_level1_strategy(session: PlanningSession) -> None:
        terms = []
        for it in session.sub_query_items():
            words = (it.get("goal") or "").split()[:8]
            if not words:
                continue
            terms.append({"term": " ".join(words), "purpose": it.get("id"), "round": 1})
        if terms:
            session.phases["search_strategy"] = PhaseRecord(
                phase="search_strategy",
                thought="auto-seeded for level-1: one ≤8-word term per sub-query, derived from goal",
                data={"approach": "targeted", "search_terms": terms},
                confidence=0.8,
            )

    # ── public gate / budget API ──

    def check_gate(self, session_id: str) -> tuple[bool, Optional[str]]:
        session = self.get_session(session_id)
        if session is None:
            return False, f"session '{session_id}' not found or expired — call plan_intent first"
        return session.is_complete()

    def increment_tool_calls(self, session_id: str) -> Optional[dict]:
        session = self.get_session(session_id)
        if session is None:
            return None
        session.actual_tool_calls += 1
        session.touch()
        self._persist(session)
        rec = session.phases.get("complexity_assessment")
        est = rec.data.get("estimated_tool_calls") if rec and isinstance(rec.data, dict) else None
        return {
            "actual_tool_calls": session.actual_tool_calls,
            "estimated_tool_calls": est,
            "over_budget": est is not None and session.actual_tool_calls > est,
        }


engine = PlanningEngine()
result_cache = ResultCache()
