import React from "react";
import {
  GameSessionClientEvent,
  GameSessionServerEvent,
} from "@shared/net/messages";
import { createStore, StoreApi, useStore } from "zustand";
import { GameStore } from "@/game/game";
import { toast } from "sonner";
import { getStoredSessionData } from "@/ui/sessionStorageController";

export type WsStore = {
  ws: WebSocket | null;
  initWs: (onSuccess?: () => void, onFailure?: () => void) => void;
  disconnectWs: () => void;
  sendEvent: (ev: GameSessionClientEvent) => void;
};

export const gameSessionStoreFactory = (gameStoreProvider: () => GameStore) => {
  return createStore<WsStore>()((set, getStore) => {
    return {
      ws: null,
      disconnectWs() {
        return set((state) => {
          state.ws?.close();
          return {
            ws: null,
          };
        });
      },
      initWs(onOpen, onFailure) {
        return set(function setupWs(state) {
          if (state.ws) {
            throw new Error(
              "WS already set! make sure to get rid of it first...",
            );
          }
          const { ws } = createWsConnection(
            gameStoreProvider,
            onOpen,
            onFailure,
          );
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
};

function wsSend(ws: WebSocket, msg: GameSessionClientEvent): void {
  console.log("SEND", msg);
  ws.send(JSON.stringify(msg));
}

export const GameSessionContext = React.createContext<
  undefined | ReturnType<typeof gameSessionStoreFactory>
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

export function useVanillaGameStore() {
  const store = React.use(GameSessionContext);
  if (!store) {
    throw new Error("Game session not available in provider");
  }
  return store;
}

/** Once the store is initialize, use this helper to subscribe to changes and deal with re-connection attempts */
export function setupWsCloseReconnectionHandler(
  wsStore: StoreApi<WsStore>,
  gameStoreProvider: () => GameStore,
) {
  const reconnectionAttemptIds: number[] = [];
  function setupWsReconnection(ws: WebSocket) {
    const abortController = new AbortController();
    reconnectionAttemptIds.forEach((id) => window.clearTimeout(id));
    ws.addEventListener(
      "close",
      () => {
        const currStoreState = wsStore.getState();
        // if the WS reference no longer persists, then we can assume the disconnect was intentional
        if (!currStoreState.ws) {
          return;
        }
        wsStore.setState({ ws: null });
        gameStoreProvider().sendGameError({
          id: window.crypto.randomUUID(),
          message: "Socket disconnection: Reconnecting...",
        });
        const lastTimeoutId = window.setTimeout(function handleReconnect() {
          wsStore.getState().initWs(function onSuccess() {
            reconnectionAttemptIds.length = 0;
            gameStoreProvider().sendGameMessage({
              message: "Yay! Connected ✅",
              id: window.crypto.randomUUID(),
            });
          });
          // enqueue a re-connect attempt
        }, 3_000);
        reconnectionAttemptIds.push(lastTimeoutId);
        abortController.abort();
      },
      { signal: abortController.signal },
    );
  }
  return () => {
    // establish initial connection
    wsStore.getState().initWs(
      () => {
        toast("Connected to game server 🔌", {
          position: "top-center",
        });
        // If we have a session in-memory, reconnect to that!
        const existingGameData = gameStoreProvider().game?.gameData;
        if (existingGameData) {
          const sessionData = getStoredSessionData();
          if (!sessionData) {
            throw new Error(
              "I expect to have session data if a game is running!",
            );
          }
          wsStore.getState().sendEvent({
            type: "REJOIN_EXISTING_SESSION",
            data: {
              id: existingGameData.sessionId,
              playerId: sessionData.playerId,
            },
          });
        }
      },
      function onFailure() {
        toast("Failed to initialize connection to game server ❌", {
          position: "top-right",
        });
      },
    );

    // if previous succeeded, wire up a close handler!
    const firstWs = wsStore.getState().ws;
    if (firstWs) {
      setupWsReconnection(firstWs);
    }
    const unsubscribe = wsStore.subscribe((state, prevState) => {
      if (state.ws && state.ws !== prevState.ws) {
        setupWsReconnection(state.ws);
      }
    });
    return () => {
      // cleanup procedure should both cleanup WS state, as well as unsubscribe from store changes
      // wsStore.getState().disconnectWs();
      unsubscribe();
    };
  };
}

function createWsConnection(
  gameStoreProvider: () => GameStore,
  onOpen?: () => void,
  onInitialConnectionFailure?: () => void,
) {
  let didInitiallyConnect = false;
  const wsAbortController = new AbortController();
  const ws = new WebSocket("ws://localhost:8080");

  ws.addEventListener(
    "open",
    function () {
      didInitiallyConnect = true;
      console.debug("connected to the server");
      onOpen?.();
    },
    { signal: wsAbortController.signal },
  );

  ws.addEventListener(
    "close",
    function () {
      console.debug("server connection closed");
      // Cleans up all listeners for this WS instance, clearing it for GC
      wsAbortController.abort();
      console.debug("abort handled 🧹");
      if (!didInitiallyConnect) {
        onInitialConnectionFailure?.();
      }
    },
    { signal: wsAbortController.signal },
  );

  ws.addEventListener(
    "message",
    function (e) {
      console.debug(`Received message: `, e.data);
    },
    { signal: wsAbortController.signal },
  );

  ws.addEventListener(
    "message",
    function (e) {
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
            case "GAME_STATUS_UPDATE": {
              const data = jsonData.data;
              const game = gameStoreProvider();
              if (data.sessionId !== game.game?.gameData.sessionId) {
                throw new Error(
                  "received session update about another game; weird!",
                );
              }
              if (data.gameStatus === "PLAYING") {
                if (
                  game.gameMachineState.name !==
                  "SESSION_CONNECTED_WITH_GAME_PLAYING"
                ) {
                  game.startGame(data.sessionId);
                }
              } else if (data.gameStatus === "PAUSED_AWAITING_PLAYERS") {
                game.setGameMachineState({
                  name: "SESSION_CONNECTED_WITH_GAME_WAITING_PLAYER",
                });
              } else if (data.gameStatus === "PAUSED_AWAITING_START") {
                game.setGameMachineState({
                  name: "SESSION_CONNECTED_WITH_GAME_READY",
                });
              }
              break;
            }
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
                name: "SESSION_CONNECTED_WITH_GAME_WAITING_PLAYER",
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
              if (data.gameStatus === "PAUSED_AWAITING_PLAYERS") {
                game.setGameMachineState({
                  name: "SESSION_CONNECTED_WITH_GAME_WAITING_PLAYER",
                });
              } else if (data.gameStatus === "PAUSED_AWAITING_START") {
                game.setGameMachineState({
                  name: "SESSION_CONNECTED_WITH_GAME_READY",
                });
              } else if (data.gameStatus === "PLAYING") {
                game.setGameMachineState({
                  name: "SESSION_CONNECTED_WITH_GAME_READY",
                });
                // trigger a start
                game.startGame(data.id);
              } else {
                throw new Error(`Unhandled gameStatus ${data.gameStatus}`);
              }
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
    },
    { signal: wsAbortController.signal },
  );

  return { ws, wsAbortController };
}
