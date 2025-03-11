import React from "react";
import {
  GameSessionClientEvent,
  GameSessionServerEvent,
} from "@shared/net/messages";
import { createStore, useStore } from "zustand";
import { GameStore, gameStoreFactory } from "@/game/game";

export type WsStore = {
  ws: WebSocket | null;
  initWs: () => void;
  removeWs: () => void;
  sendEvent: (ev: GameSessionClientEvent) => void;
};

export const gameSessionStoreFactory = (gameStoreProvider: () => GameStore) =>
  createStore<WsStore>()((set, getStore) => {
    return {
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
              let jsonData: GameSessionServerEvent;
              try {
                jsonData = JSON.parse(e.data) as GameSessionServerEvent;
              } catch (err) {
                console.error(e);
                console.warn(`Attempted to parse JSON ${e.data}, but failed.`);
                return;
              }
              try {
                switch (jsonData.type) {
                  case "CREATE_NEW_SESSION_RESPONSE": {
                    const {
                      data,
                      isSuccess,
                      failureMessage: failure,
                    } = jsonData.data;
                    const game = gameStoreProvider();
                    if (!isSuccess) {
                      game.sendGameError({
                        id: jsonData.id,
                        message: failure,
                      });
                      return;
                    }
                    game.setupGame(data.id, 1, data.playerId);
                    game.setGameMachineState({
                      name: "SESSION_CONNECTED_WITH_GAME_READY",
                    });
                    break;
                  }
                  case "JOIN_SESSION_RESPONSE": {
                    const game = gameStoreProvider();
                    const {
                      data,
                      isSuccess,
                      failureMessage: failure,
                    } = jsonData.data;
                    if (!isSuccess) {
                      game.sendGameError({
                        id: jsonData.id,
                        message: failure,
                      });
                      return;
                    }
                    game.setupGame(data.id, 2, data.playerId);
                    game.setGameMachineState({
                      name: "SESSION_CONNECTED_WITH_GAME_READY",
                    });
                    break;
                  }
                  case "REJOIN_EXISTING_SESSION_RESPONSE": {
                    const game = gameStoreProvider();
                    const {
                      data,
                      isSuccess,
                      failureMessage: failure,
                    } = jsonData.data;
                    if (!isSuccess) {
                      game.sendGameError({
                        id: jsonData.id,
                        message: failure,
                      });
                      return;
                    }
                    game.setupGame(data.id, data.playerNumber, data.playerId);
                    game.setGameMachineState({
                      name: "SESSION_CONNECTED_WITH_GAME_READY",
                    });
                    break;
                  }
                  case "START_SESSION_GAME_RESPONSE": {
                    const game = gameStoreProvider();
                    const {
                      data,
                      isSuccess,
                      failureMessage: failure,
                    } = jsonData.data;
                    if (!isSuccess) {
                      game.sendGameError({
                        id: jsonData.id,
                        message: failure,
                      });
                      return;
                    }
                    // trigger a start
                    game.startGame(data.id);
                    break;
                  }
                  case "POSITIONS_UPDATE": {
                    const game = gameStoreProvider();
                    game.updatePositions(jsonData.data.playerPositions);
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
                console.error(jsonData.type, e);
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

export const GameSessionContext = React.createContext<
  undefined | ReturnType<typeof gameSessionStoreFactory>
>(undefined);

export const GameContext = React.createContext<
  undefined | ReturnType<typeof gameStoreFactory>
>(undefined);

export function useGameSessionStore<T extends any = WsStore>(
  selector?: (s: WsStore) => T,
): T {
  const store = React.use(GameSessionContext);
  if (!store) {
    throw new Error("Game session not available in provider");
  }
  return useStore(store, selector!);
}
