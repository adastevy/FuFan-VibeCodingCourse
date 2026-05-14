import { cn } from "@/lib/utils";
import { type Message } from "@/lib/chat-state";

export function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const time = new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div className={cn("mb-3 flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "rounded-card px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words max-w-[85%]",
          isUser
            ? "bg-accent text-bg"
            : "bg-bg border border-border text-text",
        )}
      >
        {msg.content}
      </div>
      <div className="text-[10px] text-text-weak mt-1">{time}</div>
    </div>
  );
}

export function ChatGreeting({ content }: { content: string }) {
  return (
    <div className="mb-3 flex flex-col items-start">
      <div className="rounded-card px-3 py-2 text-[13.5px] leading-relaxed bg-bg border border-border text-text max-w-[85%]">
        {content}
      </div>
      <div className="text-[10px] text-text-weak mt-1">系统消息</div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="mb-3 flex flex-col items-start">
      <div className="rounded-card px-3 py-2.5 bg-bg border border-border flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-text-sub animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-text-sub animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-text-sub animate-bounce" />
      </div>
    </div>
  );
}
