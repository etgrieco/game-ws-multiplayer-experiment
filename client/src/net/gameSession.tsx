import { movePosition2System } from "@shared/ecs/system";
import { OfPlayer, Position2 } from "@shared/ecs/trait";
import { createGameWorld } from "@shared/game/game";
import { GameSimulation } from "@shared/game/types";
import {
  GameSessionClientEvent,
  GameSessionServerEvent,
} from "@shared/net/messages";
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

export const gameSessionStoreFactory = () =>
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
                  case "CREATE_SESSION_RESPONSE": {
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
                      const world = createGameWorld();
                      return {
                        game: {
                          start() {
                            movePosition2System(world);
                          },
                          gameData: {
                            id: data.id,
                            world: world,
                          },
                        },
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
                      const world = createGameWorld(); // TODO: hydrate world from server state
                      return {
                        game: {
                          start() {
                            movePosition2System(world);
                          },
                          gameData: {
                            id: data.id,
                            world: world,
                          },
                        },
                      };
                    });
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
                    store.game.start(() => {
                      // re-sync with server?
                    });
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
  ws.send(JSON.stringify(msg));
}

const GameSessionContext = React.createContext<
  undefined | ReturnType<typeof gameSessionStoreFactory>
>(undefined);

export const GameSessionProvider = (props: PropsWithChildren<{}>) => {
  const [store] = React.useState(gameSessionStoreFactory);
  return (
    <GameSessionContext.Provider value={store} children={props.children} />
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
