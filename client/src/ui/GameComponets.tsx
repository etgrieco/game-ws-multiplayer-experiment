import { GameContext } from "@client/game/game";
import { gameStoreFactory } from "@client/game/game";
import {
  GameSessionContext,
  gameSessionStoreFactory,
  setupWsCloseReconnectionHandler,
} from "@client/net/gameSession";
import { createWorld, universe } from "koota";
import { WorldProvider } from "koota/react";
import React, { type PropsWithChildren } from "react";

function createAppComponents() {
  universe.reset();
  const world = createWorld();
  const gameStore = gameStoreFactory(world);
  const wsStore = gameSessionStoreFactory(() => gameStore.getState());

  // wire up session to game
  gameStore.getState().connectGameNet((...args) => {
    wsStore.getState().sendEvent(...args);
  });

  // add some side-effects
  const subscribe = setupWsCloseReconnectionHandler(wsStore, () =>
    gameStore.getState()
  );

  return {
    world,
    gameStore,
    sessionStore: wsStore,
    initializeSubscriptions: subscribe,
  };
}

export const GameComponentsProvider = (props: PropsWithChildren) => {
  const [{ world, sessionStore, gameStore, initializeSubscriptions }] =
    React.useState(createAppComponents);

  React.useEffect(() => {
    return initializeSubscriptions();
  }, [initializeSubscriptions]);

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
