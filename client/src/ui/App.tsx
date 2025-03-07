import React from "react";
import { GameSessionProvider, useGameSessionStore } from "../net/gameSession";
import { GameStart } from "./GameStart";
import { useQuery } from "koota/react";
import { OfPlayer } from "@shared/ecs/trait";

export function App() {
  return (
    <GameSessionProvider>
      <RestoreActiveSession />
      <SyncSaveSession />
      <GameStart />
    </GameSessionProvider>
  );
}

const sessionKey = "PREV_SESSION";
type SessionData = {
  lastUpdated: number;
  gameId: string;
  playerId: string;
};
const getPrevSession = () => {
  const sessionStr = sessionStorage.getItem(sessionKey);
  if (sessionStr) {
    return JSON.parse(sessionStr) as SessionData;
  }
  return null;
};

const setPrevSession = (data: SessionData) => {
  sessionStorage.setItem(sessionKey, JSON.stringify(data));
};

function RestoreActiveSession() {
  const [sessionData] = React.useState(() => {
    return getPrevSession();
  });
  const ws = useGameSessionStore((s) => s.ws);
  const sendEvent = useGameSessionStore((s) => s.sendEvent);

  if (sessionData) {
    return (
      <button
        className="border py-2 rounded-sm"
        disabled={!ws}
        onClick={() => {
          if (!ws) {
            return;
          }
          sendEvent({
            type: "REJOIN_EXISTING_SESSION",
            data: {
              id: sessionData.gameId,
              playerId: sessionData.playerId,
            },
          });
        }}
      >
        Restore session {sessionData.gameId}?
      </button>
    );
  }
  return null;
}

function SyncSaveSession() {
  const gameId = useGameSessionStore((s) => s.game?.gameData.id);
  const players = useQuery(OfPlayer);
  const me = players.find((p) => p.get(OfPlayer)!.isMe);

  React.useEffect(() => {
    if (!gameId) {
      return;
    }
    console.log("me!", me, me?.get(OfPlayer));
    const meData = me?.get(OfPlayer);
    if (!meData) {
      return;
    }
    if (meData) {
      setPrevSession({
        gameId: gameId,
        lastUpdated: Date.now(),
        playerId: meData.playerId,
      });
    }
  }, [me, gameId]);

  return null;
}
