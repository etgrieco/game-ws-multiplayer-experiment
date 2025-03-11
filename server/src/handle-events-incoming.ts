import { GameSessionClientEvent } from "@shared/net/messages.js";
import { MultiplayerGameContainer } from "./MultiplayerGameContainer.js";
import { wsSend } from "./wsSend.js";
import { setupGameBroadcaster, setupGameSimulation } from "./game-factory.js";
import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait.js";
import { WebSocket as WS } from "ws";

export function handleEventsIncoming(
  eventData: GameSessionClientEvent,
  context: {
    ws: WS;
    sessionsData: Map<string, MultiplayerGameContainer>;
  },
) {
  switch (eventData.type) {
    case "CREATE_NEW_SESSION": {
      // by default, assume joiner is always player 1
      const playerNumber = 1;
      const playerIdx = 0;
      const newPlayerId = crypto.randomUUID();

      const session = createSession(context.sessionsData, context.ws);
      // add to connection list
      session.connections[playerIdx] = context.ws;
      // Easy reference for player IDs
      session.players[playerIdx] = newPlayerId;
      // Add player to world
      session.gameSim.gameData.world.spawn(
        Position2(),
        Velocity2(),
        OfPlayer({ playerNumber: playerNumber, playerId: newPlayerId }),
      );
      wsSend(context.ws, {
        type: "CREATE_NEW_SESSION_RESPONSE",
        data: {
          isSuccess: true,
          data: { id: session.id, playerId: newPlayerId },
        },
      });
      break;
    }
    case "JOIN_SESSION": {
      const session = context.sessionsData.get(eventData.data.id.toLowerCase());
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
        // by default, assume joiner is always player 2
        const playerNumber = 2;
        const playerIdx = 1;
        const newPlayerId = crypto.randomUUID();

        // add to connection list
        session.connections[playerIdx] = context.ws;
        // Easy reference for player IDs
        session.players[playerIdx] = newPlayerId;
        // Add player to world
        session.gameSim.gameData.world.spawn(
          Position2(),
          Velocity2(),
          OfPlayer({ playerNumber: playerNumber, playerId: newPlayerId }),
        );
        session.gameStatus = "PAUSED_AWAITING_START";
        wsSend(context.ws, {
          type: "JOIN_SESSION_RESPONSE",
          data: {
            isSuccess: true,
            data: {
              id: session.id,
              playerId: newPlayerId,
              gameStatus: session.gameStatus,
            },
          },
        });
      }
      break;
    }
    case "REJOIN_EXISTING_SESSION": {
      // find the game
      const session = context.sessionsData.get(eventData.data.id);
      if (!session) {
        wsSend(context.ws, {
          type: "REJOIN_EXISTING_SESSION_RESPONSE",
          data: {
            isSuccess: false,
            failureMessage: "Cannot find session",
          },
        });
        console.error(
          `REJOIN_EXISTING_SESSION - Session ${eventData.data.id} not found`,
        );
        return;
      }

      // find my player
      const playerExists = session.gameSim.gameData.world
        .query(OfPlayer)
        .find((e) => e.get(OfPlayer)!.playerId === eventData.data.playerId);
      if (!playerExists) {
        wsSend(context.ws, {
          type: "REJOIN_EXISTING_SESSION_RESPONSE",
          data: {
            isSuccess: false,
            failureMessage: "Cannot find player with matching ID",
          },
        });
        console.error(
          `REJOIN_EXISTING_SESSION - Session ${eventData.data.id} not found`,
        );
        return;
      }

      const playerData = playerExists.get(OfPlayer)!;

      let broadcaster = session.broadcaster;
      if (!broadcaster) {
        console.log("Broadcaster not active; creating a new one.");
        const wsPool = session.connections;
        wsPool[playerData.playerNumber - 1] = context.ws;
        session.broadcaster = setupGameBroadcaster(
          session.gameSim.gameData,
          wsPool,
        );
        broadcaster = session.broadcaster;
      } else {
        // re-assign the broadcaster connections
        session.connections[playerData.playerNumber - 1] = context.ws;
        broadcaster.updateConnect(playerData.playerNumber, context.ws);
      }

      session.gameStatus = (() => {
        if (session.gameSim.status === "RUNNING") {
          return "PLAYING";
        }
        // if every connection ready...
        if (
          broadcaster.connections.every(
            (c) => c?.readyState && c.readyState === c.OPEN,
          )
        ) {
          return "PAUSED_AWAITING_START";
        }
        return "PAUSED_AWAITING_PLAYERS";
      })();

      wsSend(context.ws, {
        type: "REJOIN_EXISTING_SESSION_RESPONSE",
        data: {
          isSuccess: true,
          data: {
            id: session.id,
            playerId: playerData.playerId,
            playerNumber: playerData.playerNumber,
            gameStatus: session.gameStatus,
          },
        },
      });
      // also, tell the players about game status
      broadcaster.connections.forEach((ws) => {
        if (!ws) return;
        wsSend(ws, {
          type: "GAME_STATUS_UPDATE",
          data: {
            gameStatus: session.gameStatus,
            sessionId: session.id,
          },
        });
      });
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
            failureMessage: "Player 2 not yet connected; not starting game",
          },
        });
        throw new Error("Player 2 not yet connected; not starting game");
      }

      // We can be starting a new or existing/"paused" game...
      if (!session.broadcaster) {
        const broadcaster = setupGameBroadcaster(session.gameSim.gameData, [
          connection1,
          connection2,
        ]);
        session.broadcaster = broadcaster;
      }

      session.gameSim.start(session.broadcaster.sync);
      console.log("start game loop!");

      // Send to all players!
      [connection1, connection2].forEach((ws) => {
        wsSend(ws, {
          type: "START_SESSION_GAME_RESPONSE",
          data: {
            isSuccess: true,
            data: {
              id: session.gameSim.gameData.sessionId,
              gameStatus: session.gameStatus,
            },
          },
        });
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
      if (!session.broadcaster) {
        // This can happen if a server restarts, which I guess is kinda legitimate
        throw new Error("Unexpected state: No broadcaster present.");
      }
      const playerIdx = session.broadcaster.connections.indexOf(context.ws);
      if (playerIdx < 0) {
        if (context.ws) {
          context.ws.close();
        }
        throw new Error(
          "PLAYER_UPDATE - Failed to find matching player. Closing connection.",
        );
      }
      const game = session.gameSim.gameData;
      game.world.query(Velocity2, OfPlayer).updateEach(([vel, player]) => {
        if (player.playerNumber === playerIdx + 1) {
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
    id: uuid,
    gameSim,
    gameStatus: "PAUSED_AWAITING_PLAYERS",
    connections: [ws, null],
    players: [null, null],
    broadcaster: null,
  };
  sessionsData.set(uuid, container);
  return container;
}
