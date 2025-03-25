import React from "react";
import * as THREE from "three";
import { Damage, IsEnemy, Position2 } from "@shared/ecs/trait";
import { useQuery, useWorld } from "koota/react";

type EnemyDefs = { id: string | number; x: number; z: number }[];

export function BadGuys() {
  const enemies = useQuery(Position2, IsEnemy);
  const damages = useQuery(Damage, IsEnemy);
  const world = useWorld();

  React.useEffect(() => {
    return world.onChange(Damage, (e) => {
      console.log(e);
    });
  }, [world]);

  const enemyDefs = React.useMemo(() => {
    return enemies.map((t) => {
      const pos = t.get(Position2)!;
      return {
        id: t.id(),
        x: pos.x,
        z: pos.z,
      };
    }) satisfies EnemyDefs;
  }, [enemies]);

  return (
    <>
      <EnemyInstances enemyDefs={enemyDefs} />
      {damages.map((e) => {
        if (e.has(IsEnemy) && e.has(Position2)) {
          const pos = e.get(Position2)!;
          return <EnemyDamage key={e.id()} posX={pos.x} posZ={pos.z} />;
        }
        return null;
      })}
    </>
  );
}

function EnemyDamage(props: { posX: number; posZ: number }) {
  const meshRef = React.useRef<THREE.Mesh>(null!);

  return (
    <mesh position={[props.posX, 0, props.posZ]} ref={meshRef}>
      <sphereGeometry />
      <meshStandardMaterial color={0xff5c00} transparent opacity={0.5} />
    </mesh>
  );
}

const enemyGeometry = new THREE.SphereGeometry(0.5, 12, 12);
const enemyMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  flatShading: true,
});

function EnemyInstances({ enemyDefs }: { enemyDefs: EnemyDefs }) {
  const instancedMeshRef = React.useRef<THREE.InstancedMesh>(null!);

  React.useEffect(() => {
    const tempMatrix = new THREE.Matrix4();
    for (let i = 0; i < enemyDefs.length; i++) {
      tempMatrix.compose(
        new THREE.Vector3(enemyDefs[i]!.x, 0, enemyDefs[i]!.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1)
      );
      instancedMeshRef.current.setMatrixAt(i, tempMatrix);
    }
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [enemyDefs]);

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[enemyGeometry, enemyMaterial, enemyDefs.length]}
    />
  );
}
