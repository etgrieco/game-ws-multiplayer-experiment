import { GameSessionClientEvent } from "@shared/net/messages.js";
import { MultiplayerGameContainer } from "./MultiplayerGameContainer.js";
import { WS, wsSend } from "./wsSend.js";
import { setupGameBroadcaster, setupGameSimulation } from "./game-factory.js";
import { OfPlayer, Velocity2 } from "@shared/ecs/trait.js";

export function handleEventsIncoming(
  eventData: GameSessionClientEvent,
  context: {
    ws: WS;
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
        wsSend(context.ws, {
          type: "START_SESSION_GAME_RESPONSE",
          data: {
            isSuccess: false,
            failureMessage: "Connection 1 missing; not starting game",
          },
        });
        throw new Error("Connection 1 missing; not starting game");
      } else if (!connection2) {
        wsSend(context.ws, {
          type: "START_SESSION_GAME_RESPONSE",
          data: {
            isSuccess: false,
            failureMessage: "Connection 2 missing; not starting game",
          },
        });
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
    case "PLAYER_UPDATE": {
      // find the game
      const session = context.sessionsData.get(eventData.data.id);
      if (!session) {
        context.ws.close();
        throw new Error(
          `PLAYER_UPDATE - Session ${eventData.data.id} not found. Closing connection.`,
        );
      }
      const playerIdx = session.connections.indexOf(context.ws);
      if (playerIdx < 0) {
        context.ws.close();
        throw new Error(
          "PLAYER_UPDATE - Failed to find matching player. Closing connection.",
        );
      }
      const game = session.gameSim.gameData;
      game.world.query(Velocity2, OfPlayer).updateEach(([vel, player]) => {
        if (player.playerNumber === playerIdx + 1) {
          console.log("updating velocities!", eventData.data.vel);
          vel.x = eventData.data.vel.x;
          vel.y = eventData.data.vel.y;
        }
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
  ws: WS,
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
