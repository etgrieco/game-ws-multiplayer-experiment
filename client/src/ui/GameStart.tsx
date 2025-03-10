import React from "react";
import { useGameSessionStore } from "../net/gameSession";
import { useGameStore } from "../game/game";
import { Game } from "./Game";

export function GameStart() {
  const ws = useGameSessionStore((s) => s.ws);
  const game = useGameStore((s) => s.game);
  const initGameError = useGameStore((s) => {
    if (s.gameMachineState.name === "INIT_GAME_ERROR") {
      return s.gameMachineState.data;
    }
    return undefined;
  });
  const sendEvent = useGameSessionStore((s) => s.sendEvent);
  const gameSessionStore = useGameSessionStore();

  React.useEffect(() => {
    if (!gameSessionStore.ws) {
      gameSessionStore.initWs();
    }
    return () => {
      gameSessionStore.removeWs();
    };
  }, []);

  if (initGameError) {
    return <div>Error: {initGameError.message}</div>;
  }

  if (game) {
    return <Game />;
  }

  return (
    <div className="flex flex-col gap-4 max-w-[1024px] items-center w-full  ">
      <button
        disabled={!ws}
        onClick={() => {
          sendEvent({
            type: "CREATE_NEW_SESSION",
          });
        }}
        className="h-9 px-4 py-2 bg-green-600 text-green bg-green-600-foreground shadow hover:bg-green-600/90 rounded-sm"
      >
        Create Session
      </button>

      <div className="text-lg">OR</div>

      <div>
        <div>Join a Session</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!ws) {
              throw new Error("WS connection unavailable");
            }

            const values = new FormData(e.target as HTMLFormElement);
            const sessionId = values.get("sessionId") as string;
            sendEvent({
              type: "JOIN_SESSION",
              data: { id: sessionId },
            });
          }}
        >
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
