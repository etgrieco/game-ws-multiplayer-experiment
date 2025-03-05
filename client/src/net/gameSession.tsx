import { Position2, Velocity2 } from "@shared/ecs/trait";
import { GameSimulation } from "@shared/game/types";
import {
  GameSessionClientEvent,
  GameSessionServerEvent,
} from "@shared/net/messages";
import { createWorld } from "koota";
import { createStore } from "zustand";

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

export const gameSessionStore = createStore<WsStore>()((set, getStore) => {
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
          // attempt to re-connect! (TODO: avoid infinite loop? use a flag?)
          state.initWs();
        });

        ws.addEventListener("message", function (e) {
          console.log(`Received message: `, e.data);
        });

        ws.addEventListener("message", function (e) {
          console.log("received data", e);
          if (typeof e.data === "string") {
            try {
              const jsonData = JSON.parse(e.data) as GameSessionServerEvent;
              switch (jsonData.type) {
                case "CREATE_SESSION_RESPONSE":
                  {
                    set(() => {
                      // TODO: actually set up world
                      const world = createWorld();
                      world.spawn(Position2, Velocity2);

                      return {
                        game: {
                          tick() {
                            // TODO: actually set up tick
                          },
                          data: {
                            id: jsonData.data.id,
                            world: world,
                          },
                        },
                      };
                    });
                  }
                  break;
                case "JOIN_SESSION_RESPONSE":
                  if (jsonData.data.success) {
                    const data = jsonData.data;
                    // TODO: actually set up world
                    const world = createWorld();
                    world.spawn(Position2, Velocity2);
                    set({
                      game: {
                        data: {
                          id: data.game.id,
                          world: world,
                        },
                        tick() {
                          // TODO: actually set up tick
                        },
                      },
                    });
                  } else {
                    const data = jsonData.data;
                    set({
                      initGameError: {
                        message: data.failure,
                      },
                    });
                  }
                  break;
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
