import React from "react";
import { createRoot } from "react-dom/client";
import { createWorld } from "koota";
import { Position2, Velocity2 } from "@shared/ecs/trait";
import { create, useStore } from "zustand";
import { GameSimulation } from "@shared/game/types";
import { GameSessionServerEvent } from "@shared/net/messages";

/** START GAME CODE */

type WsStore = {
  game: GameSimulation | null;
  ws: WebSocket | null;
  initWs: () => void;
  removeWs: () => void;
};

const wsSessionStore = create<WsStore>()((set) => {
  return {
    game: null,
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
      return set((state) => {
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
                default:
                  console.warn(`Unhandled server event, ${jsonData.type}`);
              }
            } catch (e) {
              console.error(e);
            }
          }
        });

        return { ws };
      });
    },
  };
});

function App() {
  const ws = useStore(wsSessionStore, (s) => s.ws);
  const game = useStore(wsSessionStore, (s) => s.game);

  const createSession = () => {
    if (!ws) throw new Error("WS not established!");
    ws.send(
      JSON.stringify({
        type: "CREATE_SESSION",
      }),
    );
  };

  React.useEffect(() => {
    const state = wsSessionStore.getState();

    if (!state.ws) {
      state.initWs();
    }
    return () => {
      state.removeWs();
    };
  }, []);

  if (game) {
    return <Game game={game} />;
  }

  return (
    <div className="flex flex-col gap-4 max-w-[1024px] items-center w-full  ">
      <button
        disabled={!ws}
        onClick={createSession}
        className="h-9 px-4 py-2 bg-green-600 text-green bg-green-600-foreground shadow hover:bg-green-600/90 rounded-sm"
      >
        Create Session
      </button>

      <div className="text-lg">OR</div>

      <div>
        <div>Join a Session</div>
        <form>
          <div className="flex flex-col gap-2">
            <fieldset>
              <label htmlFor="sessionId">Session ID: </label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                id="sessionId"
                name="sessionId"
                type="text"
              ></input>
            </fieldset>
            <button className="h-9 px-4 py-2 bg-green-600 text-green bg-green-600-foreground shadow hover:bg-green-600/90 rounded-sm">
              Join
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Game(props: { game: GameSimulation }) {
  return (
    <div className="flex flex-col w-full max-w-[1024px]">
      <div className="text-2xl">GAME ID: {props.game.data.id}</div>
    </div>
  );
}

const root = createRoot(document.getElementById("app-root")!);
root.render(<App />);
