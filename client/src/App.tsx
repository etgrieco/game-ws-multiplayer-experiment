import { Player } from "game-shared/ecs/trait";
import { useQuery } from "koota/react";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
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
