import { GameSessionServerEvent } from "@shared/net/messages.js";
import { WebSocket } from "ws";

export function wsSend(ws: WebSocket, msg: GameSessionServerEvent): void {
  ws.send(JSON.stringify(msg));
}
