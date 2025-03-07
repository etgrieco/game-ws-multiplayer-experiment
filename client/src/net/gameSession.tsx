import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait";
import { GameData, GameSimulation } from "@shared/game/types";
import {
  GameSessionClientEvent,
  GameSessionServerEvent,
} from "@shared/net/messages";
import { createWorld, World } from "koota";
import { WorldProvider } from "koota/react";
import React, { PropsWithChildren } from "react";
import { createStore, useStore } from "zustand";

export type WsStore = {
  game: GameSimulation | null;
  initGameError: {
    message: string;
  } | null;
  ws: WebSocket | null;
  initWs: () => void;
  removeWs: () => void;
  sendEvent: (ev: GameSessionClientEvent) => void;
};

export const gameSessionStoreFactory = (world: World) =>
  createStore<WsStore>()((set, getStore) => {
    return {
      game: null,
      initGameError: null,
      ws: null,
      removeWs() {
        return set((state) => {
          state.ws?.close();
          return {
            ws: null,
          };
        });
      },
      initWs() {
        return set(function setupWs(state) {
          if (state.ws) {
            throw new Error(
              "WS already set! make sure to get rid of it first...",
            );
          }
          const ws = new WebSocket("ws://localhost:8080");

          ws.addEventListener("open", function () {
            console.log("connected to the server");
          });

          ws.addEventListener("close", function () {
            console.log("server connection closed");
          });

          ws.addEventListener("message", function (e) {
            console.log(`Received message: `, e.data);
          });

          ws.addEventListener("message", function (e) {
            if (typeof e.data === "string") {
              try {
                const jsonData = JSON.parse(e.data) as GameSessionServerEvent;
                switch (jsonData.type) {
                  case "CREATE_NEW_SESSION_RESPONSE": {
                    const {
                      data,
                      isSuccess,
                      failureMessage: failure,
                    } = jsonData.data;
                    if (!isSuccess) {
                      set({
                        initGameError: {
                          message: failure,
                        },
                      });
                      return;
                    }
                    set(() => {
                      return {
                        game: createGameSimulationFactory(
                          data.id,
                          1,
                          data.playerId,
                          world,
                        ),
                      };
                    });
                    break;
                  }
                  case "JOIN_SESSION_RESPONSE": {
                    const {
                      data,
                      isSuccess,
                      failureMessage: failure,
                    } = jsonData.data;
                    if (!isSuccess) {
                      set({
                        initGameError: {
                          message: failure,
                        },
                      });
                      return;
                    }
                    set(() => {
                      return {
                        game: createGameSimulationFactory(
                          data.id,
                          2,
                          data.playerId,
                          world,
                        ),
                      };
                    });
                    break;
                  }
                  case "REJOIN_EXISTING_SESSION_RESPONSE": {
                    const {
                      data,
                      isSuccess,
                      failureMessage: failure,
                    } = jsonData.data;
                    if (!isSuccess) {
                      set({
                        initGameError: {
                          message: failure,
                        },
                      });
                      return;
                    }
                    set(() => {
                      return {
                        game: createGameSimulationFactory(
                          data.id,
                          data.playerNumber,
                          data.playerId,
                          world,
                        ),
                      };
                    });
                    // Now that our game is set up in zustand store, kick off player controls
                    const store = getStore();
                    handleStartGame(store.game!.gameData, ws);
                    break;
                  }
                  case "START_SESSION_GAME_RESPONSE": {
                    const {
                      data,
                      isSuccess,
                      failureMessage: failure,
                    } = jsonData.data;
                    if (!isSuccess) {
                      set({
                        initGameError: {
                          message: failure,
                        },
                      });
                      return;
                    }
                    const store = getStore();
                    // trigger a start
                    if (!store.game) {
                      throw new Error(
                        "START_SESSION_GAME_RESPONSE - cannot start non-existent game",
                      );
                    }
                    if (data.id !== store.game.gameData.id) {
                      console.error(
                        "START_SESSION_GAME_RESPONSE - cannot start game; mismatched ID",
                      );
                    }
                    handleStartGame(store.game.gameData, ws);
                    break;
                  }
                  case "POSITIONS_UPDATE": {
                    const store = getStore();
                    // trigger a start
                    if (!store.game) {
                      throw new Error("POSITIONS_UPDATE - non-existent game");
                    }

                    const playerOnePos = jsonData.data.playerPositions[0];
                    const playerTwoPos = jsonData.data.playerPositions[1];

                    store.game.gameData.world
                      .query(Position2, OfPlayer)
                      .updateEach(([p, player]) => {
                        // re-sync my world from server!
                        if (player.playerNumber === 1) {
                          p.x = playerOnePos.x;
                          p.y = playerOnePos.y;
                        } else if (player.playerNumber === 2) {
                          p.x = playerTwoPos.x;
                          p.y = playerTwoPos.y;
                        }
                      });
                    break;
                  }
                  default: {
                    const jsonUnknown: unknown = jsonData;
                    const jsonUnknownType =
                      jsonUnknown &&
                      typeof jsonUnknown === "object" &&
                      "type" in jsonUnknown &&
                      typeof jsonUnknown.type === "string"
                        ? jsonUnknown.type
                        : undefined;
                    console.warn(
                      `Unhandled server event${jsonUnknownType ? `, ${jsonUnknownType}` : ""}`,
                    );
                  }
                }
              } catch (e) {
                console.error(e);
              }
            }
          });

          return { ws };
        });
      },
      sendEvent(ev) {
        const { ws } = getStore();
        if (!ws) throw new Error("WS not established!");
        wsSend(ws, ev);
      },
    };
  });

function wsSend(ws: WebSocket, msg: GameSessionClientEvent): void {
  console.log(msg);
  ws.send(JSON.stringify(msg));
}

const GameSessionContext = React.createContext<
  undefined | ReturnType<typeof gameSessionStoreFactory>
>(undefined);

export const GameSessionProvider = (props: PropsWithChildren<{}>) => {
  const [world] = React.useState(createWorld());
  const [store] = React.useState(() => gameSessionStoreFactory(world));

  return (
    <WorldProvider world={world}>
      <GameSessionContext.Provider value={store}>
        {props.children}
      </GameSessionContext.Provider>
    </WorldProvider>
  );
};

export function useGameSessionStore<T extends any = WsStore>(
  selector?: (s: WsStore) => T,
): T {
  const store = React.use(GameSessionContext);
  if (!store) {
    throw new Error("Game session not available in provider");
  }
  return useStore(store, selector!);
}

export const useGameSessionStoreVanilla = () => {
  const store = React.use(GameSessionContext);
  if (!store) {
    throw new Error("Game session not available in provider");
  }
  return store;
};

const TICK_RATE = 1000 / 60; // 60 updates per second (~16.67ms per frame)
function gameLoopFactory(mainMethod: (deltaTime: number) => void) {
  let frameDelta = 0;
  return function initGameLoop() {
    const startTime = performance.now();
    // Update game state here (e.g., physics, player positions, ball movement)
    // console.log("Game tick at", startTime);
    mainMethod(frameDelta);
    const endTime = performance.now();
    const elapsed = endTime - startTime;
    const nextScheduledDelay = Math.max(0, TICK_RATE - elapsed);
    setTimeout(initGameLoop, nextScheduledDelay); // Schedule the next tick
    frameDelta = nextScheduledDelay;
  };
}

function createGameSimulationFactory(
  id: string,
  myPlayerAssignment: 1 | 2,
  playerId: string,
  world: World,
): GameSimulation {
  // player 1 thing
  world.spawn(
    Position2(),
    Velocity2(),
    OfPlayer({ playerNumber: 1, isMe: myPlayerAssignment === 1, playerId }),
  );

  // player 2 thing
  world.spawn(
    Position2(),
    Velocity2(),
    OfPlayer({
      playerNumber: 2,
      isMe: myPlayerAssignment === 2,
      playerId: playerId,
    }),
  );

  return {
    start(syncCb) {
      const loop = gameLoopFactory((_deltaTime) => {
        // we currently rely solely on the server
        // movePosition2ByVelocitySystem(world, deltaTime);
        syncCb();
      });
      loop();
    },
    gameData: {
      id: id,
      world: world,
    },
  };
}

function handleStartGame(gameData: GameData, ws: WebSocket) {
  document.addEventListener("keydown", function (ev) {
    if (!gameData) {
      console.warn("key handler ignored b/c no game data");
      return;
    }
    // TODO: Refactor this as an input queue processed by a client-side system
    switch (ev.code) {
      case "ArrowLeft": {
        // update world
        gameData.world.query(OfPlayer, Velocity2).updateEach(([p, vel]) => {
          if (p.isMe) {
            vel.x -= 1;
            wsSend(ws, {
              type: "PLAYER_UPDATE",
              data: {
                id: gameData.id,
                vel: {
                  x: vel.x,
                  y: vel.y,
                },
              },
            });
          }
        });
        break;
      }
      case "ArrowRight": {
        gameData.world.query(OfPlayer, Velocity2).updateEach(([p, vel]) => {
          if (p.isMe) {
            vel.x += 1;
            wsSend(ws, {
              type: "PLAYER_UPDATE",
              data: {
                id: gameData.id,
                vel: {
                  x: vel.x,
                  y: vel.y,
                },
              },
            });
          }
        });
        break;
      }
    }
  });
}
