import { GameSessionServerEvent } from "@shared/net/messages.js";
import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";

export function wsSend(
  ws: WebSocket,
  msg: Omit<GameSessionServerEvent, "id">,
): void {
  ws.send(
    JSON.stringify({
      id: randomUUID(),
      ...msg,
    }),
  );
}
