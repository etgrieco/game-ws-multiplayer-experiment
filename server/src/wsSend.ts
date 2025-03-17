import { randomUUID } from "node:crypto";
import type { GameSessionServerEvent } from "@shared/net/messages.js";
import { WebSocket } from "ws";

export function wsSend(
  ws: WebSocket,
  msg: Omit<GameSessionServerEvent, "id">,
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(
    JSON.stringify({
      id: randomUUID(),
      ...msg,
    }),
  );
}
