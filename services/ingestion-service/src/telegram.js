import { hasTelegramConfig } from "@knowledgeos/shared";

export function getTelegramStatus(env = process.env) {
  if (!hasTelegramConfig(env)) {
    return {
      kind: "telegram",
      mode: "degraded",
      status: "credentials_missing",
      reason: "Telegram credentials are missing from the environment."
    };
  }

  return {
    kind: "telegram",
    mode: "configured",
    status: "ready",
    reason: ""
  };
}
