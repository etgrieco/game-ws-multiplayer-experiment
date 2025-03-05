import React, { useRef } from "react";
import { useStore } from "zustand";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { gameSessionStore } from "../net/gameSession";

export function App() {
  const ws = useStore(gameSessionStore, (s) => s.ws);
  const game = useStore(gameSessionStore, (s) => s.game);
  const initGameError = useStore(gameSessionStore, (s) => s.initGameError);
  const sendEvent = useStore(gameSessionStore, (s) => s.sendEvent);

  React.useEffect(() => {
    const state = gameSessionStore.getState();

    if (!state.ws) {
      state.initWs();
    }
    return () => {
      state.removeWs();
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
            type: "CREATE_SESSION",
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

const useGame = () => {
  const game = useStore(gameSessionStore, (s) => s.game);
  if (!game) {
    throw new Error("The game is not yet initialized");
  }
  return game;
};

function GameUI() {
  const game = useGame();
  return (
    <div className="w-full max-w-[1024px] max-h-[768px] h-full absolute">
      <div className="text-2xl">GAME ID: {game.data.id}</div>
    </div>
  );
}

function Game() {
  return (
    <div className="flex flex-col w-full max-w-[1024px] relative">
      <Canvas>
        <ambientLight intensity={Math.PI / 2} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.15}
          penumbra={1}
          decay={0}
          intensity={Math.PI}
        />
        <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
        <GameContents />
      </Canvas>
      <GameUI />
    </div>
  );
}

function GameContents() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((_s, delta) => {
    meshRef.current.rotation.x += delta;
  });

  return (
    <mesh ref={meshRef} scale={1}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={"orange"} />
    </mesh>
  );
}
