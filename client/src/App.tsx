import { Toaster } from "@client/components/ui/sonner";
import { Player } from "@shared/ecs/trait";
import { useQuery } from "koota/react";
import React from "react";
import { useGameStore } from "./game/game";
import { GameComponentsProvider } from "./ui/GameComponents";
import { GameStart } from "./ui/GameStart";
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
  const players = useQuery(Player);
  const me = players.find((p) => p.get(Player)!.isMe);

  React.useEffect(() => {
    if (!gameId) {
      return;
    }
    const meData = me?.get(Player);
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
