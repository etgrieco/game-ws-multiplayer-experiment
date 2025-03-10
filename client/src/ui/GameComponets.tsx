import React, { PropsWithChildren } from "react";
import { createWorld } from "koota";
import { WorldProvider } from "koota/react";
import {
  GameContext,
  GameSessionContext,
  gameSessionStoreFactory,
} from "@/net/gameSession";
import { gameStoreFactory } from "@/game/game";

function createAppComponents() {
  const world = createWorld();
  const gameStore = gameStoreFactory(world);
  const sessionStore = gameSessionStoreFactory(() => gameStore.getState());

  // wire up session to game
  gameStore.getState().connectGameNet((...args) => {
    sessionStore.getState().sendEvent(...args);
  });

  return {
    world,
    gameStore,
    sessionStore,
  };
}

export const GameComponentsProvider = (props: PropsWithChildren<{}>) => {
  const [{ world, sessionStore, gameStore }] =
    React.useState(createAppComponents);

  return (
    <WorldProvider world={world}>
      <GameSessionContext.Provider value={sessionStore}>
        <GameContext.Provider value={gameStore}>
          {props.children}
        </GameContext.Provider>
      </GameSessionContext.Provider>
    </WorldProvider>
  );
};
