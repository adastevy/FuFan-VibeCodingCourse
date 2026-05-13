/* ──────────────────────────────────────────────────────────
 * 5 状态状态机：closed / open / sending / received / error
 *
 *   closed ──OPEN──> open ──SEND──> sending ──REPLY_OK──> received
 *     ▲                  │              │                    │
 *     │                  │              └──REPLY_FAIL──> error
 *     │                  │                                   │ ├── RETRY ──> sending
 *     │                  │                                   │ ├── SEND  ──> sending
 *     │                  │                                   │ └── DISMISS ─> open
 *     └─────CLOSE────────┴──────CLOSE──────CLOSE──────CLOSE──┘
 * ────────────────────────────────────────────────────────── */

export type Panel = "closed" | "open" | "sending" | "received" | "error";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface State {
  panel: Panel;
  messages: Message[];
  pendingId: string | null;
  errorReason: string | null;
  failedContent: string | null;
}

export type Action =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SEND"; id: string; content: string; timestamp: number }
  | { type: "REPLY_OK"; id: string; content: string; timestamp: number }
  | { type: "REPLY_FAIL"; id: string; reason: string }
  | { type: "RETRY"; newId: string; timestamp: number }
  | { type: "DISMISS_ERROR" };

export const initialState: State = {
  panel: "closed",
  messages: [],
  pendingId: null,
  errorReason: null,
  failedContent: null,
};

const SEND_FROM: ReadonlySet<Panel> = new Set(["open", "received", "error"]);

const acceptingReply = (s: State, id: string): boolean =>
  s.panel === "sending" && s.pendingId === id;

const clearTransients = {
  pendingId: null,
  errorReason: null,
  failedContent: null,
} as const;

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "OPEN":
      return state.panel === "closed" ? { ...state, panel: "open" } : state;

    case "CLOSE":
      return state.panel === "closed"
        ? state
        : { ...state, panel: "closed", ...clearTransients };

    case "SEND": {
      if (!SEND_FROM.has(state.panel)) return state;
      const userMsg: Message = {
        id: `${action.id}-u`,
        role: "user",
        content: action.content,
        timestamp: action.timestamp,
      };
      return {
        ...state,
        panel: "sending",
        messages: [...state.messages, userMsg],
        pendingId: action.id,
        errorReason: null,
        failedContent: null,
      };
    }

    case "REPLY_OK": {
      if (!acceptingReply(state, action.id)) return state;
      const assistantMsg: Message = {
        id: `${action.id}-a`,
        role: "assistant",
        content: action.content,
        timestamp: action.timestamp,
      };
      return {
        ...state,
        panel: "received",
        messages: [...state.messages, assistantMsg],
        ...clearTransients,
      };
    }

    case "REPLY_FAIL": {
      if (!acceptingReply(state, action.id)) return state;
      const lastUser = [...state.messages].reverse().find((m) => m.role === "user");
      return {
        ...state,
        panel: "error",
        pendingId: null,
        errorReason: action.reason,
        failedContent: lastUser?.content ?? null,
      };
    }

    case "RETRY":
      return state.panel !== "error"
        ? state
        : {
            ...state,
            panel: "sending",
            pendingId: action.newId,
            errorReason: null,
            failedContent: null,
          };

    case "DISMISS_ERROR":
      return state.panel !== "error"
        ? state
        : {
            ...state,
            panel: "open",
            errorReason: null,
            failedContent: null,
          };
  }
}
