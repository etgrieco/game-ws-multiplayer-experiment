import React from "react";
import { GameStart } from "./ui/GameStart";
import { useQuery } from "koota/react";
import { OfPlayer } from "@shared/ecs/trait";
import { useGameStore } from "./game/game";
import { GameComponentsProvider } from "./ui/GameComponets";
import { Toaster } from "@/components/ui/sonner";
import { prevSessionSubscriptionController } from "./ui/sessionStorageController";

export function App() {
  return (
    <GameComponentsProvider>
      <Toaster />
      <SyncSaveSession />
      <GameStart />
    </GameComponentsProvider>
  );
}

function SyncSaveSession() {
  const gameId = useGameStore((s) => s.game?.gameData.sessionId);
  const players = useQuery(OfPlayer);
  const me = players.find((p) => p.get(OfPlayer)!.isMe);

  React.useEffect(() => {
    if (!gameId) {
      return;
    }
    const meData = me?.get(OfPlayer);
    if (!meData) {
      return;
    }
    if (meData) {
      prevSessionSubscriptionController.setValue({
        gameId: gameId,
        lastUpdated: Date.now(),
        playerId: meData.playerId,
        players: 2,
      });
    }
  }, [me, gameId]);

  return null;
}
