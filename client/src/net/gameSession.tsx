import type { GameStore } from "@client/game/game";
import { getStoredSessionData } from "@client/ui/sessionStorageController";
import type {
  GameSessionClientEvent,
  GameSessionServerEvent,
} from "@shared/net/messages";
import React from "react";
import { toast } from "sonner";
import { type StoreApi, createStore, useStore } from "zustand";

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

export const GameSessionContext = React.createContext<
  undefined | ReturnType<typeof gameSessionStoreFactory>
>(undefined);

export function useGameSessionStore<T = WsStore>(
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
  function connectToGame(onConnect?: () => void, onFailure?: () => void) {
    return wsStore.getState().initWs(function onSuccess() {
      onConnect?.();
      // If we have a session in-memory, reconnect to that!
      const existingGameData = gameStoreProvider().game?.gameData;
      if (existingGameData) {
        const sessionData = getStoredSessionData(); // This is a quick shortcut to getting the relevant re-connection data
        if (!sessionData) {
          throw new Error(
            "I expect to have session data if a game is running!",
          );
        }
        wsStore.getState().sendEvent({
          type: "REJOIN_EXISTING_SESSION",
          data: {
            id: sessionData.gameId,
            playerId: sessionData.playerId,
          },
        });
      }
    }, onFailure);
  }

  let lastReconnectionAttemptTimeoutId: number | undefined;
  function setupWsReconnection(ws: WebSocket) {
    const abortController = new AbortController();
    // If any pending re-connects enqueued, don't execute
    window.clearTimeout(lastReconnectionAttemptTimeoutId);
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
        lastReconnectionAttemptTimeoutId = window.setTimeout(() => {
          connectToGame(function onSuccess() {
            gameStoreProvider().sendGameMessage({
              message: "Yay! Connected ✅",
              id: window.crypto.randomUUID(),
            });
          });
        }, 3_000);
        abortController.abort();
      },
      { signal: abortController.signal },
    );
  }

  return () => {
    const unsubscribe = wsStore.subscribe((state, prevState) => {
      // handle subscribing to any new created connections
      if (state.ws && state.ws !== prevState.ws) {
        setupWsReconnection(state.ws);
      }
    });

    connectToGame(
      function toastOnSuccess() {
        toast("Connected to game server 🔌", {
          position: "top-center",
        });
      },
      function toastOnFailure() {
        toast("Failed to initialize connection to game server ❌", {
          position: "top-right",
        });
      },
    );

    return () => {
      // cleanup procedure should both cleanup WS state, as well as unsubscribe from store changes
      wsStore.getState().disconnectWs();
      unsubscribe();
    };
  };
}

function wsSend(ws: WebSocket, msg: GameSessionClientEvent): void {
  console.debug("SEND", msg);
  ws.send(JSON.stringify(msg));
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
    () => {
      didInitiallyConnect = true;
      console.debug("connected to the server");
      onOpen?.();
    },
    { signal: wsAbortController.signal },
  );

  ws.addEventListener(
    "close",
    () => {
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
    (e) => {
      console.debug("Received message: ", e.data);
    },
    { signal: wsAbortController.signal },
  );

  ws.addEventListener(
    "message",
    (e) => {
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
          handleSessionServerEvents(jsonData, gameStoreProvider());
        } catch (e) {
          console.error(jsonData.type, e);
        }
      }
    },
    { signal: wsAbortController.signal },
  );

  return { ws, wsAbortController };
}

function handleSessionServerEvents(
  jsonData: GameSessionServerEvent,
  gameStoreSnapshot: GameStore,
) {
  switch (jsonData.type) {
    case "GAME_STATUS_UPDATE": {
      const data = jsonData.data;
      if (data.sessionId !== gameStoreSnapshot.game?.gameData.sessionId) {
        throw new Error("received session update about another game; weird!");
      }
      gameStoreSnapshot.setMultiplayerSessionStatus(
        data.multiplayerSessionStatus,
      );
      // Handle each game status update...
      switch (data.multiplayerSessionStatus) {
        case "PLAYING": {
          gameStoreSnapshot.startGame(data.sessionId);
          break;
        }
        case "PAUSED_AWAITING_PLAYERS": {
          if (gameStoreSnapshot.game.status === "RUNNING") {
            gameStoreSnapshot.sendGameMessage({
              message: "Player disconnected 💀, pausing game ⏸️",
              id: jsonData.id,
            });
            gameStoreSnapshot.pauseGame();
          }
          break;
        }
        case "PAUSED_AWAITING_START": {
          gameStoreSnapshot.sendGameMessage({
            message: "Player re-connected 🔌",
            id: jsonData.id,
          });
          break;
        }
        default:
          throw new Error(
            `Unhandled game status update ${data.multiplayerSessionStatus}`,
          );
      }
      break;
    }
    case "CREATE_NEW_SESSION_RESPONSE": {
      const { data, isSuccess, failureMessage: failure } = jsonData.data;
      if (!isSuccess) {
        gameStoreSnapshot.sendGameError({
          id: jsonData.id,
          message: failure,
        });
        return;
      }
      gameStoreSnapshot.setupGame(data.id, data.myPlayerId, data.initialState);
      gameStoreSnapshot.setMultiplayerSessionStatus(
        data.multiplayerSessionStatus,
      );
      break;
    }
    case "JOIN_SESSION_RESPONSE": {
      const { data, isSuccess, failureMessage: failure } = jsonData.data;
      if (!isSuccess) {
        gameStoreSnapshot.sendGameError({
          id: jsonData.id,
          message: failure,
        });
        return;
      }
      gameStoreSnapshot.setupGame(data.id, data.myPlayerId, data.initialState);
      gameStoreSnapshot.setMultiplayerSessionStatus(
        data.multiplayerSessionStatus,
      );
      break;
    }
    case "REJOIN_EXISTING_SESSION_RESPONSE": {
      const { data, isSuccess, failureMessage: failure } = jsonData.data;
      if (!isSuccess) {
        gameStoreSnapshot.sendGameError({
          id: jsonData.id,
          message: failure,
        });
        return;
      }
      gameStoreSnapshot.setMultiplayerSessionStatus(
        data.multiplayerSessionStatus,
      );
      gameStoreSnapshot.setupGame(data.id, data.myPlayerId, data.initialState);
      if (data.multiplayerSessionStatus === "PLAYING") {
        // trigger a start
        gameStoreSnapshot.startGame(data.id);
      }
      break;
    }
    case "START_SESSION_GAME_RESPONSE": {
      const { data, isSuccess, failureMessage: failure } = jsonData.data;
      if (!isSuccess) {
        gameStoreSnapshot.sendGameError({
          id: jsonData.id,
          message: failure,
        });
        return;
      }
      if (data.multiplayerSessionStatus === "PLAYING") {
        // trigger a start if not currently already started
        gameStoreSnapshot.startGame(data.id);
      }
      break;
    }
    case "POSITIONS_UPDATE": {
      gameStoreSnapshot.updatePositions(
        jsonData.data.playerPositions,
        jsonData.data.damagePositions,
      );
      break;
    }
    case "LEVEL_UPDATE": {
      gameStoreSnapshot.setupLevelLandscape(jsonData.data.treePositions);
      gameStoreSnapshot.setupBadGuys(jsonData.data.badGuyPositions);
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
}
