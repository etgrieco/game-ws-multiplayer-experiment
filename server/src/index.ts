import { WebSocketServer } from "ws";
import { GameData } from "@shared/game/types.js";

console.log("Server started...");

const wss = new WebSocketServer({ port: 8080 });

/** Singleton holding our games! */
const sessionsData: Map<string, GameData> = new Map();

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);
  ws.on("message", function message(data, isBinary) {
    if (isBinary) {
      console.log("Message is binary; rejecting.");
      return;
    }
    const strData = data.toString("utf-8");
    console.log("reading data...");
    const jsonParsed = JSON.parse(strData);
    console.log("checking type: ", jsonParsed.type);
    switch (jsonParsed.type) {
      case "CREATE_SESSION": {
        const session = createSession();
        ws.send(
          JSON.stringify({
            type: "CREATE_SESSION_RESPONSE",
            data: session,
          }),
        );
        break;
      }
      default:
        console.log(`unhandled event ${jsonParsed.type}`);
        break;
    }
    if (data instanceof ArrayBuffer) {
    }
  });
});

function createSession() {
  const uuid = crypto.randomUUID();
  if (sessionsData.has(uuid)) {
    return createSession();
  }
  sessionsData.set(uuid, { id: uuid });
  return { id: uuid };
}
