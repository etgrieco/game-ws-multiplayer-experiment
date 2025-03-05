import { GameSessionClientEvent } from "@shared/net/messages.js";
import { MultiplayerGameContainer } from "./MultiplayerGameContainer.js";
import { wsSend } from "./wsSend.js";
import { WebSocket as WsWebSocketInstance } from "ws";
import { setupGameBroadcaster, setupGameSimulation } from "./game-factory.js";

export function handleEventsIncoming(
  eventData: GameSessionClientEvent,
  context: {
    ws: WsWebSocketInstance;
    sessionsData: Map<string, MultiplayerGameContainer>;
  },
) {
  switch (eventData.type) {
    case "CREATE_SESSION": {
      const session = createSession(context.sessionsData, context.ws);
      wsSend(context.ws, {
        type: "CREATE_SESSION_RESPONSE",
        data: {
          isSuccess: true,
          data: { id: session.id },
        },
      });
      break;
    }
    case "JOIN_SESSION": {
      const session = context.sessionsData.get(eventData.data.id);
      if (!session) {
        wsSend(context.ws, {
          type: "JOIN_SESSION_RESPONSE",
          data: {
            isSuccess: false,
            failureMessage: "Cannot find session",
          },
        });
        console.error(`JOIN_SESSION - Session ${eventData.data.id} not found`);
      } else {
        // add to connection list
        session.connections[1] = context.ws;
        wsSend(context.ws, {
          type: "JOIN_SESSION_RESPONSE",
          data: {
            isSuccess: true,
            data: { id: session.gameSim.gameData.id },
          },
        });
      }
      break;
    }
    case "START_SESSION_GAME": {
      // find the game
      const session = context.sessionsData.get(eventData.data.id);
      if (!session) {
        wsSend(context.ws, {
          type: "START_SESSION_GAME_RESPONSE",
          data: {
            isSuccess: false,
            failureMessage: "Cannot find session",
          },
        });
        console.error(
          `START_SESSION_GAME_RESPONSE - Session ${eventData.data.id} not found`,
        );
        return;
      }

      const [connection1, connection2] = session.connections;
      if (!connection1) {
        throw new Error("Connection 1 missing; not starting game");
      } else if (!connection2) {
        throw new Error("Connection 2 missing; not starting game");
      }

      const broadcaster = setupGameBroadcaster(session.gameSim.gameData, [
        connection1,
        connection2,
      ]);
      session.broadcaster = broadcaster;
      session.gameSim.start(broadcaster.sync);
      console.log("start game loop!");
      wsSend(context.ws, {
        type: "START_SESSION_GAME_RESPONSE",
        data: {
          isSuccess: true,
          data: { id: session.gameSim.gameData.id },
        },
      });
      break;
    }
    default: {
      const unexpectedType = eventData["type"] as string;
      console.log(`unhandled event ${unexpectedType}`);
      break;
    }
  }
}

function createSession(
  sessionsData: Map<string, MultiplayerGameContainer>,
  ws: WsWebSocketInstance,
) {
  const uuid = crypto.randomUUID();
  if (sessionsData.has(uuid)) {
    return createSession(sessionsData, ws);
  }

  const gameSim = setupGameSimulation(uuid);
  const container: MultiplayerGameContainer = {
    gameSim,
    connections: [ws, undefined],
    broadcaster: undefined,
  };
  sessionsData.set(uuid, container);
  return { id: uuid };
}
