import { GameSessionServerEvent } from "@shared/net/messages.js";
import { WebSocket as WsWebSocketInstance } from "ws";

export function wsSend(
  ws: WsWebSocketInstance,
  msg: GameSessionServerEvent,
): void {
  ws.send(JSON.stringify(msg));
}
