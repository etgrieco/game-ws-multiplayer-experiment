import { GameSessionServerEvent } from "@shared/net/messages.js";

/** Trimmed down WS impl */
export type WS = { send: (msg: string) => void };

export function wsSend(ws: WS, msg: GameSessionServerEvent): void {
  ws.send(JSON.stringify(msg));
}
