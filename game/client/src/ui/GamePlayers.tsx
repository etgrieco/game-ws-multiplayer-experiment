import { useFrame } from "@react-three/fiber";
import { DamageZone, Player, Position2 } from "game-shared/ecs/trait";
import { useQuery, useWorld } from "koota/react";
import * as React from "react";
import * as THREE from "three";

const MOVEMENT_LERP_FACTOR = 0.08;

function DamageRing(props: { playerId: string }) {
  const transparencyRef = React.useRef(0);
  const meshRef = React.useRef<THREE.Mesh>(null!);
  const materialRef = React.useRef<THREE.Material>(null!);
  const world = useWorld();

  useFrame((_s, deltaTime) => {
    // Movement
    const myPlayerDamage = world
      .query(Position2, DamageZone)
      .find((p) => p.get(DamageZone)!.playerId === props.playerId);

    if (!myPlayerDamage) {
      console.error("Can't find damage entity for component. huh?");
      return;
    }
    const myPlayerPos = myPlayerDamage.get(Position2)!;
    meshRef.current.position.lerp(
      new THREE.Vector3(
        myPlayerPos.x,
        meshRef.current.position.y,
        myPlayerPos.z,
      ),
      MOVEMENT_LERP_FACTOR,
    );
    // Cycle transparency
    transparencyRef.current = (transparencyRef.current % 1) + 0.5 * deltaTime;
    materialRef.current.opacity = 0.4 + Math.sin(transparencyRef.current) * 0.5;
  });

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0, "XYZ"]}>
      <torusGeometry args={[0.5, 0.2, 16, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        flatShading
        color={0xff0000}
        transparent
        opacity={0.5}
      />
    </mesh>
  );
}

export function GamePlayer(props: { playerId: string; color: number }) {
  const meshRef = React.useRef<THREE.Mesh>(null!);
  const world = useWorld();

  useFrame((_s) => {
    const myPlayer = world
      .query(Position2, Player)
      .find((p) => p.get(Player)!.playerId === props.playerId);
    if (!myPlayer) {
      console.error("Can't find player entity for component. huh?");
      return;
    }
    const myPlayerPos = myPlayer.get(Position2)!;
    meshRef.current.position.lerp(
      new THREE.Vector3(
        myPlayerPos.x,
        meshRef.current.position.y,
        myPlayerPos.z,
      ),
      MOVEMENT_LERP_FACTOR,
    );
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial flatShading color={props.color} />
    </mesh>
  );
}

const PLAYER_COLORS = [0x00ff00, 0xff0000];
export function GamePlayers() {
  const players = useQuery(Position2, Player);
  return players.map((p, idx) => {
    const playerId = p.get(Player)!.playerId;
    return (
      <React.Fragment key={playerId}>
        <GamePlayer
          color={PLAYER_COLORS[idx % PLAYER_COLORS.length]!}
          playerId={playerId}
        />
        <DamageRing playerId={playerId} />
      </React.Fragment>
    );
  });
}
