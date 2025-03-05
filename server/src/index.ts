import { WebSocketServer } from "ws";
import { GameSessionClientEvent } from "@shared/net/messages.js";
import { MultiplayerGameContainer } from "./MultiplayerGameContainer.js";
import { handleEventsIncoming } from "./handle-events-incoming.js";

console.log("Server started...");

const wss = new WebSocketServer({ port: 8080 });

/** Singleton holding our games! */
const sessionsData: Map<string, MultiplayerGameContainer> = new Map();

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
    handleEventsIncoming(jsonParsed, { sessionsData, ws });
  });
});
