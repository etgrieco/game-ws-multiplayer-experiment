import React, { PropsWithChildren } from "react";
import { createWorld } from "koota";
import { WorldProvider } from "koota/react";
import {
  GameSessionContext,
  gameSessionStoreFactory,
  setupWsCloseReconnectionHandler,
} from "@/net/gameSession";
import { GameContext } from "@/game/game";
import { gameStoreFactory } from "@/game/game";

function createAppComponents() {
  const world = createWorld();
  const gameStore = gameStoreFactory(world);
  const wsStore = gameSessionStoreFactory(() => gameStore.getState());

  // wire up session to game
  gameStore.getState().connectGameNet((...args) => {
    wsStore.getState().sendEvent(...args);
  });

  // add some side-effects
  const subscribe = setupWsCloseReconnectionHandler(wsStore, () =>
    gameStore.getState(),
  );

  return {
    world,
    gameStore,
    sessionStore: wsStore,
    handleSubscribe: subscribe,
  };
}

export const GameComponentsProvider = (props: PropsWithChildren<{}>) => {
  const [{ world, sessionStore, gameStore, handleSubscribe }] =
    React.useState(createAppComponents);

  React.useEffect(() => {
    return handleSubscribe();
  }, []);

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
