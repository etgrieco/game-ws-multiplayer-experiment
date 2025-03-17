import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait";
import { GameSimulation } from "@shared/game/types";
import { GameSessionClientEvent } from "@shared/net/messages";
import { World } from "koota";
import React from "react";
import { createStore, useStore } from "zustand";

type GameMachineState =
  | {
      name: "INIT";
    }
  | {
      name: "SESSION_CONNECTED_WITH_GAME_PLAYING";
    }
  | {
      name: "SESSION_CONNECTED_WITH_GAME_READY";
    }
  | {
      name: "SESSION_CONNECTED_WITH_GAME_WAITING_PLAYER";
    };

export type GameStore = Readonly<{
  game: GameSimulation | null;
  gameMachineState: GameMachineState;
  setGameMachineState(newState: GameMachineState): void;
  lastGameError: { message: string; id: string } | null;
  lastGameMessage: { message: string; id: string } | null;
  sendGameError: (err: { message: string; id: string }) => void;
  sendGameMessage: (msg: { message: string; id: string }) => void;
  setupGame: (id: string, myPlayerAssignment: 1 | 2, playerId: string) => void;
  connectGameNet: (newSender: (ev: GameSessionClientEvent) => void) => void;
  startGame: (sessionId: string) => void;
  updatePositions: (playerPositions: { x: number; y: number }[]) => void;
}>;

export const gameStoreFactory = (mainWorld: World) => {
  const store = createStore<GameStore>()((set, getStore) => {
    let sendNetEvent: undefined | ((ev: GameSessionClientEvent) => void);
    const verifiedInits = {
      get sendNetEvent() {
        if (!sendNetEvent) {
          throw new Error("Net connection callback is not initialized");
        }
        return sendNetEvent;
      },
    };
    return {
      game: null,
      gameMachineState: {
        name: "INIT",
      },
      connectGameNet(newSender) {
        sendNetEvent = newSender;
      },
      setGameMachineState(newState) {
        set({ gameMachineState: newState });
      },
      lastGameError: null,
      lastGameMessage: null,
      sendGameMessage({ id, message }) {
        set({
          lastGameMessage: {
            id,
            message,
          },
        });
      },
      sendGameError({ id, message }) {
        set({ lastGameError: { id, message } });
      },
      setupGame(id, myPlayerAssignment, playerId) {
        set({
          game: createGameSimulationFactory(
            id,
            myPlayerAssignment,
            playerId,
            mainWorld,
          ),
        });
      },
      startGame(sessionId: string) {
        const gameStore = getStore();
        const game = gameStore.game?.gameData;
        if (!game) {
          throw new Error("Cannot start game before initialization");
        }
        if (
          gameStore.gameMachineState.name !==
          "SESSION_CONNECTED_WITH_GAME_READY"
        ) {
          throw new Error(
            `Cannot start game outside of SESSION_CONNECTED_WITH_GAME_READY state. (${gameStore.gameMachineState.name})`,
          );
        }
        if (sessionId !== game.sessionId) {
          throw new Error("Mismatched session IDs");
        }
        setupGameControls(
          {
            handleMovePlayerLeft() {
              game.world.query(OfPlayer, Velocity2).updateEach(([p, vel]) => {
                if (p.isMe) {
                  vel.x -= 1;
                  verifiedInits.sendNetEvent({
                    type: "PLAYER_UPDATE",
                    data: {
                      id: game.sessionId,
                      vel: {
                        x: vel.x,
                        y: vel.y,
                      },
                    },
                  });
                }
              });
            },
            handleMovePlayerRight() {
              game.world.query(OfPlayer, Velocity2).updateEach(([p, vel]) => {
                if (p.isMe) {
                  vel.x += 1;
                  verifiedInits.sendNetEvent({
                    type: "PLAYER_UPDATE",
                    data: {
                      id: game.sessionId,
                      vel: {
                        x: vel.x,
                        y: vel.y,
                      },
                    },
                  });
                }
              });
            },
          },
          getStore,
        );
        set({
          gameMachineState: {
            name: "SESSION_CONNECTED_WITH_GAME_PLAYING",
          },
        });
        gameStore.game.start(); // start client-side game loop
      },
      updatePositions(playerPositions) {
        const game = getStore().game;
        if (!game) {
          throw new Error(
            "Illegal state update; Updated positions on updated positions.",
          );
        }
        const playerOnePos = playerPositions[0]!;
        const playerTwoPos = playerPositions[1]!;
        game.gameData.world
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
      },
    };
  });
  return store;
};

function setupGameControls(
  cbs: {
    handleMovePlayerLeft(): void;
    handleMovePlayerRight(): void;
  },
  gameProvider: () => GameStore,
) {
  document.addEventListener("keydown", function (ev) {
    const gameStore = gameProvider();
    // ignore input on non-playing states
    if (
      gameStore.gameMachineState.name !== "SESSION_CONNECTED_WITH_GAME_PLAYING"
    ) {
      return;
    }
    // TODO: Refactor this as an input queue processed by a client-side system
    switch (ev.code) {
      case "ArrowLeft": {
        cbs.handleMovePlayerLeft();
        break;
      }
      case "ArrowRight": {
        cbs.handleMovePlayerRight();
        break;
      }
    }
  });
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

  let status: GameSimulation["status"] = "PAUSED";
  return {
    get status() {
      return status;
    },
    pause() {
      status = "PAUSED";
    },
    start(syncCb) {
      status = "RUNNING";
      const loop = gameLoopFactory((_deltaTime) => {
        // we currently rely solely on the server to drive systems
        // Here, we would do client-side logic
        syncCb?.();
      });
      loop(this);
    },
    gameData: {
      sessionId: id,
      world: world,
    },
  };
}

const TICK_RATE = 1000 / 60; // 60 updates per second (~16.67ms per frame)
function gameLoopFactory(mainMethod: (deltaTime: number) => void) {
  let frameDelta = 0;
  return function initGameLoop(gameSimSnapshot: Readonly<GameSimulation>) {
    const startTime = performance.now();
    // Update game state here (e.g., physics, player positions, ball movement)
    if (gameSimSnapshot.status === "RUNNING") {
      mainMethod(frameDelta);
    }
    const endTime = performance.now();
    const elapsed = endTime - startTime;
    const nextScheduledDelay = Math.max(0, TICK_RATE - elapsed);
    setTimeout(initGameLoop, nextScheduledDelay); // Schedule the next tick
    frameDelta = nextScheduledDelay;
  };
}

export const GameContext = React.createContext<
  undefined | ReturnType<typeof gameStoreFactory>
>(undefined);

export function useGameStore<T extends any = GameStore>(
  selector?: (s: GameStore) => T,
): T {
  return useStore(useVanillaGameStore(), selector!);
}

export function useVanillaGameStore() {
  const store = React.use(GameContext);
  if (!store) {
    throw new Error("Game session not available in provider");
  }
  return store;
}
