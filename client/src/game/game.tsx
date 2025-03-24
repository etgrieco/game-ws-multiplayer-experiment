import { spawnPlayer, spawnTree } from "@shared/ecs/spawn";
import { Landscape, OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait";
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
    speed: 3,
    xIncrement: 0.1,
    xDecelerate: 0.5,
    zIncrement: 0.1,
    zDecelerate: 0.5,
    xMax: (1 / Math.sqrt(2)) * 0.5,
    zMax: (1 / Math.sqrt(2)) * 0.5,
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
      pos: { x: number; z: number };
      playerId: string;
      playerAssignment: 1 | 2;
    }[]
  ) => void;
  destroyGameCleanup: () => void;
  connectGameNet: (newSender: (ev: GameSessionClientEvent) => void) => void;
  startGame: (sessionId: string) => void;
  pauseGame: () => void;
  updatePositions: (
    playerPositions: { x: number; z: number; playerId: string }[]
  ) => void;
  setupLevelLandscape: (treePositions: { x: number; z: number }[]) => void;
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
      destroyGameCleanup: () => {
        // no-op, until set during startGame!
      },
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
        // call cleanup on any started games...
        getStore().destroyGameCleanup();
        const gameSimulation = createGameSimulationFactory(
          id,
          myPlayerId,
          initialState,
          mainWorld
        );
        set({
          game: gameSimulation,
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
          dz: 0,
        };

        function normalizeVectors(vec: { dx: number; dz: number }) {
          let { dx, dz } = vec;
          // Normalize movement
          const magnitude = Math.sqrt(dx * dx + dz * dz);
          if (magnitude > 0) {
            dx = (dx / magnitude) * configs.playerSpeed.speed;
            dz = (dz / magnitude) * configs.playerSpeed.speed;
          }
          vec.dx = dx;
          vec.dz = dz;
        }
        const {
          loopCb: gameControlsCb,
          onDestroy: destroyGameControlResources,
        } = setupGameControls(
          {
            handleAccPlayerLeft() {
              perFrameMovementUpdates.dz += 1;
              perFrameMovementUpdates.dx -= 1;
            },
            handleAccPlayerRight() {
              perFrameMovementUpdates.dz -= 1;
              perFrameMovementUpdates.dx += 1;
            },
            handleAccPlayerForward() {
              perFrameMovementUpdates.dx -= 1;
              perFrameMovementUpdates.dz -= 1;
            },
            handleAccPlayerBackwards() {
              perFrameMovementUpdates.dx += 1;
              perFrameMovementUpdates.dz += 1;
            },
          },
          getStore
        );
        set({
          multiplayerSessionStatus: "PLAYING",
        });
        set({
          destroyGameCleanup() {
            destroyGameControlResources();
          },
        });
        gameStore.game.start(() => {
          gameControlsCb();
          // then, handle game systems updates based upon state changes
          game.world.query(OfPlayer, Velocity2).updateEach(([p, vel]) => {
            if (p.isMe) {
              // if nothing held, decelerate towards 0
              if (perFrameMovementUpdates.dz === 0) {
                if (vel.z < 0) {
                  vel.z = Math.min(vel.z + configs.playerSpeed.zDecelerate, 0);
                } else if (vel.z > 0) {
                  vel.z = Math.max(vel.z - configs.playerSpeed.zDecelerate, 0);
                }
              } else {
                vel.z = Math.max(
                  Math.min(
                    configs.playerSpeed.zMax,
                    vel.z + perFrameMovementUpdates.dz
                  ),
                  -configs.playerSpeed.zMax
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
                  -configs.playerSpeed.xMax
                );
              }

              const vec = {
                dx: vel.x,
                dz: vel.z,
              };
              normalizeVectors(vec);
              verifiedInits.sendNetEvent({
                type: "PLAYER_UPDATE",
                data: {
                  id: game.sessionId,
                  vel: {
                    x: vec.dx,
                    z: vec.dz,
                  },
                },
              });
            }
          });

          // then, reset
          perFrameMovementUpdates.dx = 0;
          perFrameMovementUpdates.dz = 0;
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
            spawnPlayer(game.gameData.world, {
              pos: { x: 0, z: 0 },
              player: {
                playerNumber: idx + 1,
                playerId: p.playerId,
                isMe: false,
              },
            });
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
            p.z = matchingPlayer.z;
          });
      },
      setupLevelLandscape(treePositions) {
        // destroy existing terrain
        const gameSimSnapshot = getStore().game?.gameData;
        if (!gameSimSnapshot) {
          throw new Error(
            "Cannot setup level terrain before game world is constructed"
          );
        }
        gameSimSnapshot.world.query(Landscape).forEach((l) => {
          l.destroy();
        });
        // then, spawn
        treePositions.forEach((pos) => {
          spawnTree(gameSimSnapshot.world, pos);
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
): {
  loopCb: () => void;
  onDestroy: () => void;
} {
  const keysState = {
    FORWARD: false,
    BACKWARD: false,
    RIGHT: false,
    LEFT: false,
  };
  function resetKeys() {
    for (const k in keysState) {
      const key = k as keyof typeof keysState;
      keysState[key] = false;
    }
  }

  function setupListeners(abortController: AbortController) {
    document.addEventListener(
      "keydown",
      (ev) => {
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
      },
      { signal: abortController.signal }
    );
    document.addEventListener(
      "keyup",
      (ev) => {
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
      },
      { signal: abortController.signal }
    );
    window.addEventListener(
      "blur",
      () => {
        resetKeys();
      },
      { signal: abortController.signal }
    );
  }

  const abortController = new AbortController();
  setupListeners(abortController);

  return {
    loopCb: () => {
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
    },
    onDestroy() {
      abortController.abort();
    },
  };
}

function createGameSimulationFactory(
  id: string,
  myPlayerId: string,
  initialState: {
    pos: { x: number; z: number };
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
    spawnPlayer(world, {
      pos: p.pos,
      player: {
        playerNumber: idx + 1,
        isMe: myPlayerId === p.playerId,
        playerId: p.playerId,
      },
    });
  });

  let status: GameSimulation["status"] = "PAUSED";
  const simulation: GameSimulation = {
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
        simulation.lastUpdated = Date.now();
      });
      loop(this);
    },
    gameData: {
      sessionId: id,
      world: world,
    },
  };
  return simulation;
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
