import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait";
import type { GameSimulation } from "@shared/game/types";
import type { GameSessionClientEvent } from "@shared/net/messages";
import type { World } from "koota";
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
  setupGame: (
    id: string,
    myPlayerId: string,
    initialState: {
      pos: { x: number; y: number };
      playerId: string;
      playerAssignment: 1 | 2;
    }[]
  ) => void;
  connectGameNet: (newSender: (ev: GameSessionClientEvent) => void) => void;
  startGame: (sessionId: string) => void;
  updatePositions: (
    playerPositions: { x: number; y: number; playerId: string }[]
  ) => void;
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
      setupGame(id, myPlayerId, initialState) {
        set({
          game: createGameSimulationFactory(
            id,
            myPlayerId,
            initialState,
            mainWorld
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
            `Cannot start game outside of SESSION_CONNECTED_WITH_GAME_READY state. (${gameStore.gameMachineState.name})`
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
          getStore
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
            "Illegal state update; Updated positions on updated positions."
          );
        }
        const clientPlayers = game.gameData.world
          .query(Position2, OfPlayer)
          .map((e) => {
            return {
              pos: e.get(Position2)!,
              player: e.get(OfPlayer)!,
            };
          });
        // Ensure all players exist!
        playerPositions.forEach((p, idx) => {
          const hasPlayer = clientPlayers.some(
            (cp) => p.playerId === cp.player.playerId
          );
          if (!hasPlayer) {
            game.gameData.world.spawn(
              Position2(),
              Velocity2,
              OfPlayer({
                // FIXME: get truth from server
                playerNumber: idx + 1,
                // Always someone else
                isMe: false,
                playerId: p.playerId,
              })
            );
          }
        });

        // Now, update
        game.gameData.world
          .query(Position2, OfPlayer)
          .updateEach(([p, player]) => {
            const matchingPlayer = playerPositions.find(
              (serverPlayer) => serverPlayer.playerId === player.playerId
            );
            if (!matchingPlayer) {
              throw new Error("Player to update no longer exists!?");
            }
            p.x = matchingPlayer.x;
            p.y = matchingPlayer.y;
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
  gameProvider: () => GameStore
) {
  document.addEventListener("keydown", (ev) => {
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
  myPlayerId: string,
  initialState: {
    pos: { x: number; y: number };
    playerId: string;
    playerAssignment: 1 | 2;
  }[],
  world: World
): GameSimulation {
  // spawn players
  initialState.forEach((p, idx) => {
    world.spawn(
      Position2(p.pos),
      Velocity2(),
      OfPlayer({
        playerNumber: idx + 1,
        isMe: myPlayerId === p.playerId,
        playerId: p.playerId,
      })
    );
  });

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

export function useGameStore<T = GameStore>(selector?: (s: GameStore) => T): T {
  return useStore(useVanillaGameStore(), selector!);
}

export function useVanillaGameStore() {
  const store = React.use(GameContext);
  if (!store) {
    throw new Error("Game session not available in provider");
  }
  return store;
}
