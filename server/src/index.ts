import { WebSocketServer, WebSocket as WsWebSocketInstance } from "ws";
import { GameData } from "@shared/game/types.js";
import {
  GameSessionClientEvent,
  GameSessionServerEvent,
} from "@shared/net/messages.js";

console.log("Server started...");

const wss = new WebSocketServer({ port: 8080 });

/** Singleton holding our games! */
const sessionsData: Map<string, GameData> = new Map();

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  // Handle incoming messages
  ws.on("message", function message(data, isBinary) {
    if (isBinary) {
      console.log("Message is binary; rejecting.");
      return;
    }
    const strData = data.toString("utf-8");
    const jsonParsed = JSON.parse(strData) as GameSessionClientEvent;
    switch (jsonParsed.type) {
      case "CREATE_SESSION": {
        const session = createSession();
        wsSend(ws, {
          type: "CREATE_SESSION_RESPONSE",
          data: session,
        });
        break;
      }
      case "JOIN_SESSION": {
        const session = sessionsData.get(jsonParsed.data.id);
        if (!session) {
          wsSend(ws, {
            type: "JOIN_SESSION_RESPONSE",
            data: {
              success: false,
              failure: "Cannot find session",
            },
          });
        } else {
          console.error(
            `JOIN_SESSION - Session ${jsonParsed.data.id} not found`,
          );
          wsSend(ws, {
            type: "JOIN_SESSION_RESPONSE",
            data: {
              success: true,
              game: {
                id: session.id,
              },
              failure: undefined,
            },
          });
        }
        break;
      }
      default: {
        const unexpectedType = jsonParsed["type"] as string;
        console.log(`unhandled event ${unexpectedType}`);
        break;
      }
    }
  });
});

function wsSend(ws: WsWebSocketInstance, msg: GameSessionServerEvent): void {
  ws.send(JSON.stringify(msg));
}

function createSession() {
  const uuid = crypto.randomUUID();
  if (sessionsData.has(uuid)) {
    return createSession();
  }
  sessionsData.set(uuid, { id: uuid });
  return { id: uuid };
}
