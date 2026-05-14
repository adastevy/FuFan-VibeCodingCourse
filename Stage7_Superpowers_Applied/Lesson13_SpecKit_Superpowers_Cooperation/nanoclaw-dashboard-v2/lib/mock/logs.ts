import { LogsSchema, type Logs } from "./schema";

const data: Logs = [
  {
    time: "13:25:33",
    tag: "init",
    description: "创建 Andy agent group via init-cli-agent.ts",
    duration: "0.3s",
  },
  {
    time: "13:23:10",
    tag: "chat",
    description: "Andy ping → pong · 首次对话验证成功",
    duration: "7s",
  },
  {
    time: "13:21:05",
    tag: "verify",
    description: "setup verify failed → Claude 诊断接管",
    duration: "42s",
  },
  {
    time: "13:18:42",
    tag: "setup",
    description: "OneCLI vault 注入 DeepSeek-V4 凭证",
    duration: "1m",
  },
  {
    time: "13:15:00",
    tag: "docker",
    description: "Docker Desktop daemon 拉起 · nanoclaw-agent:latest",
    duration: "45s",
  },
  {
    time: "13:08:00",
    tag: "git",
    description: "clone NanoClaw v2.0.33 · 建立工作目录",
    duration: "12s",
  },
];

export const mockLogs: Logs = LogsSchema.parse(data);
