import type { GameSessionServerEvent } from "@shared/net/messages.js";
import { WebSocket } from "ws";

export function wsSend(ws: WebSocket, msg: GameSessionServerEvent): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify(msg));
}
