import React from "react";
import { GameSessionProvider } from "../net/gameSession";
import { GameStart } from "./GameStart";

export function App() {
  return (
    <GameSessionProvider>
      <GameStart />
    </GameSessionProvider>
  );
}
