import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait";
import type {
  GameSimulation,
  MultiplayerSessionStatus,
} from "@shared/game/types";
import type { GameSessionClientEvent } from "@shared/net/messages";
import type { World } from "koota";
import React from "react";
import { createStore, useStore } from "zustand";

const configs = {
  playerSpeed: {
    xIncrement: 0.25,
    xDecelerate: 0.5,
    yIncrement: 0.25,
    yDecelerate: 0.5,
    xMax: 2,
    yMax: 2,
  },
};

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

        const perFrameMovementUpdates = {
          dx: 0,
          dy: 0,
        };
        const gameControlsCb = setupGameControls(
          {
            handleAccPlayerLeft() {
              perFrameMovementUpdates.dy += 1;
            },
            handleAccPlayerRight() {
              perFrameMovementUpdates.dy -= 1;
            },
            handleAccPlayerForward() {
              perFrameMovementUpdates.dx -= 1;
            },
            handleAccPlayerBackwards() {
              perFrameMovementUpdates.dx += 1;
            },
          },
          getStore
        );
        set({
          multiplayerSessionStatus: "PLAYING",
        });
        gameStore.game.start(() => {
          gameControlsCb();
          // then, handle game systems updates based upon state changes
          game.world.query(OfPlayer, Velocity2).updateEach(([p, vel]) => {
            if (p.isMe) {
              // if nothing held, decelerate towards 0
              if (perFrameMovementUpdates.dy === 0) {
                if (vel.y < 0) {
                  vel.y = Math.min(vel.y + configs.playerSpeed.yDecelerate, 0);
                } else if (vel.y > 0) {
                  vel.y = Math.max(vel.y - configs.playerSpeed.yDecelerate, 0);
                }
              } else {
                vel.y = Math.max(
                  Math.min(
                    configs.playerSpeed.yMax,
                    vel.y +
                      configs.playerSpeed.yIncrement *
                        perFrameMovementUpdates.dy
                  ),
                  -2
                );
              }

              if (perFrameMovementUpdates.dx === 0) {
                if (vel.x < 0) {
                  vel.x = Math.min(vel.x + configs.playerSpeed.xDecelerate, 0);
                } else if (vel.x > 0) {
                  vel.x = Math.max(vel.x - configs.playerSpeed.xDecelerate, 0);
                }
              } else {
                vel.x = Math.max(
                  Math.min(
                    configs.playerSpeed.xMax,
                    vel.x +
                      configs.playerSpeed.xIncrement *
                        perFrameMovementUpdates.dx
                  ),
                  -2
                );
              }

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

          // then, reset
          perFrameMovementUpdates.dx = 0;
          perFrameMovementUpdates.dy = 0;
        }); // start client-side game loop
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
    handleAccPlayerLeft(): void;
    handleAccPlayerRight(): void;
    handleAccPlayerForward(): void;
    handleAccPlayerBackwards(): void;
  },
  gameProvider: () => GameStore
): () => void {
  const keysState = {
    FORWARD: false,
    BACKWARD: false,
    RIGHT: false,
    LEFT: false,
  };

  document.addEventListener("keydown", (ev) => {
    switch (ev.code) {
      case "KeyA":
      case "ArrowLeft": {
        keysState.LEFT = true;
        break;
      }
      case "KeyW":
      case "ArrowUp": {
        keysState.FORWARD = true;
        break;
      }
      case "KeyS":
      case "ArrowDown": {
        keysState.BACKWARD = true;
        cbs.handleAccPlayerBackwards();
        break;
      }
      case "KeyD":
      case "ArrowRight": {
        keysState.RIGHT = true;
        cbs.handleAccPlayerRight();
        break;
      }
    }
  });
  document.addEventListener("keyup", (ev) => {
    switch (ev.code) {
      case "KeyA":
      case "ArrowLeft": {
        keysState.LEFT = false;
        break;
      }
      case "KeyW":
      case "ArrowUp": {
        keysState.FORWARD = false;
        break;
      }
      case "KeyS":
      case "ArrowDown": {
        keysState.BACKWARD = false;
        break;
      }
      case "KeyD":
      case "ArrowRight": {
        keysState.RIGHT = false;
        break;
      }
    }
  });

  return () => {
    const gameStore = gameProvider();
    // ignore input on non-playing states
    if (gameStore.game?.status === "PAUSED") {
      return;
    }
    if (keysState.FORWARD) {
      cbs.handleAccPlayerForward();
    }
    if (keysState.BACKWARD) {
      cbs.handleAccPlayerBackwards();
    }
    if (keysState.LEFT) {
      cbs.handleAccPlayerLeft();
    }
    if (keysState.RIGHT) {
      cbs.handleAccPlayerRight();
    }
  };
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
  // the world should be clean of all player entities when this is triggered
  world.query(OfPlayer).forEach((e) => {
    e.destroy();
  });
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
    lastUpdated: 0,
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
        this.lastUpdated = Date.now();
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
    setTimeout(() => initGameLoop(gameSimSnapshot), nextScheduledDelay); // Schedule the next tick
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
