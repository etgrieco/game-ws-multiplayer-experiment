import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait";
import type {
  GameSimulation,
  MultiplayerSessionStatus,
} from "@shared/game/types";
import type { GameSessionClientEvent } from "@shared/net/messages";
import type { World } from "koota";
import React from "react";
import { createStore, useStore } from "zustand";

export type GameStore = Readonly<{
  game: GameSimulation | null;
  multiplayerSessionStatus: MultiplayerSessionStatus;
  setMultiplayerSessionStatus: (status: MultiplayerSessionStatus) => void;
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
  pauseGame: () => void;
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
      multiplayerSessionStatus: "PAUSED_AWAITING_PLAYERS",
      setMultiplayerSessionStatus(newStatus) {
        set({ multiplayerSessionStatus: newStatus });
      },
      gameMachineState: {
        name: "INIT",
      },
      connectGameNet(newSender) {
        sendNetEvent = newSender;
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
      pauseGame() {
        const gameStore = getStore();
        const game = gameStore.game;
        if (!game) {
          throw new Error("Cannot pause game before initialization");
        }
        game.pause();
      },
      startGame(sessionId: string) {
        const gameStore = getStore();
        const game = gameStore.game?.gameData;
        if (!game) {
          throw new Error("Cannot start game before initialization");
        }
        if (gameStore.multiplayerSessionStatus !== "PAUSED_AWAITING_START") {
          throw new Error(
            `Cannot start game outside of PAUSED_AWAITING_START state. (current state: ${gameStore.multiplayerSessionStatus})`
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
                  vel.x = Math.min(-2, vel.x - 1);
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
                  vel.x = Math.max(2, vel.x + 1);
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
            handleMovePlayerUp() {
              game.world.query(OfPlayer, Velocity2).updateEach(([p, vel]) => {
                if (p.isMe) {
                  vel.y = Math.max(2, vel.y + 1);
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
            handleMovePlayerDown() {
              game.world.query(OfPlayer, Velocity2).updateEach(([p, vel]) => {
                if (p.isMe) {
                  vel.y = Math.min(-2, vel.y - 1);
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
          multiplayerSessionStatus: "PLAYING",
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
    handleMovePlayerUp(): void;
    handleMovePlayerDown(): void;
  },
  gameProvider: () => GameStore
) {
  document.addEventListener("keydown", (ev) => {
    const gameStore = gameProvider();
    // ignore input on non-playing states
    if (gameStore.game?.status === "PAUSED") {
      return;
    }
    // TODO: Refactor this as an input queue processed by a client-side system
    switch (ev.code) {
      case "KeyA":
      case "ArrowLeft": {
        cbs.handleMovePlayerLeft();
        break;
      }
      case "KeyW":
      case "ArrowUp": {
        cbs.handleMovePlayerUp();
        break;
      }
      case "KeyS":
      case "ArrowDown": {
        cbs.handleMovePlayerDown();
        break;
      }
      case "KeyD":
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
  // the world should be clean of all entities when this is triggered
  world.reset();
  // spawn players
  initialState.forEach((p, idx) => {
    world.spawn(
      Position2({ x: p.pos.x, y: p.pos.y }),
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
