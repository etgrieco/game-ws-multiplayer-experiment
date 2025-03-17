import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait.js";
import type { GameSessionClientEvent } from "@shared/net/messages.js";
import { WebSocket as WS } from "ws";
import type { MultiplayerGameContainer } from "./MultiplayerGameContainer.js";
import { createGameBroadcaster, setupGameSimulation } from "./game-factory.js";
import { wsSend } from "./wsSend.js";

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
      const newPlayerId = crypto.randomUUID();

      const session = createSession(context.sessionsData, context.ws);
      // add to connection list
      session.broadcaster.updateConnect(playerNumber, context.ws);
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
        const newPlayerId = crypto.randomUUID();

        // add to connection list
        session.broadcaster.updateConnect(playerNumber, context.ws);
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
        // also, tell other players about game status
        session.broadcaster.connections.forEach((ws) => {
          if (!ws || ws === context.ws) return;
          wsSend(ws, {
            type: "GAME_STATUS_UPDATE",
            data: {
              gameStatus: session.gameStatus,
              sessionId: session.id,
            },
          });
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

      session.broadcaster.updateConnect(playerData.playerNumber, context.ws);
      session.gameStatus = (() => {
        if (session.gameSim.status === "RUNNING") {
          return "PLAYING";
        }
        // if every connection ready...
        if (
          session.broadcaster.connections.every(
            (c) => c && c.readyState === c.OPEN,
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
      // also, tell the other players about game status
      session.broadcaster.connections.forEach((ws) => {
        if (!ws || ws === context.ws) return;
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

      const [connection1, connection2] = session.broadcaster.connections;
      if (!connection1 || connection1.readyState !== WS.OPEN) {
        wsSend(context.ws, {
          type: "START_SESSION_GAME_RESPONSE",
          data: {
            isSuccess: false,
            failureMessage: "Connection 1 missing; not starting game",
          },
        });
        throw new Error("Connection 1 missing; not starting game");
      }

      if (!connection2 || connection2.readyState !== WS.OPEN) {
        wsSend(context.ws, {
          type: "START_SESSION_GAME_RESPONSE",
          data: {
            isSuccess: false,
            failureMessage: "Player 2 not yet connected; not starting game",
          },
        });
        throw new Error("Player 2 not yet connected; not starting game");
      }

      session.gameStatus = "PLAYING";
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
      session.gameSim.start(session.broadcaster.sync);
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
      // biome-ignore lint/complexity/useLiteralKeys: Handling of unexpected never case requires non-literal key syntax
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
    broadcaster: createGameBroadcaster(gameSim.gameData, [ws, null]),
  };
  sessionsData.set(uuid, container);
  return container;
}
