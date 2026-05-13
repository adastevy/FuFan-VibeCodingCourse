import { PlatformsSchema, type Platform } from "./schema";

const data: Platform[] = [
  { id: "imessage", name: "iMessage", status: "connected", statusLabel: "已连接" },
  { id: "telegram", name: "Telegram", status: "configuring", statusLabel: "配置中" },
  { id: "discord", name: "Discord", status: "not_configured", statusLabel: "未配置" },
  { id: "whatsapp", name: "WhatsApp", status: "not_configured", statusLabel: "未配置" },
];

export const mockPlatforms: Platform[] = PlatformsSchema.parse(data);
