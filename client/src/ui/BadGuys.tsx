import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Damage, Health, IsEnemy, Position2 } from "@shared/ecs/trait";
import { useQuery } from "koota/react";
import * as React from "react";
import * as THREE from "three";

type EnemyDefs = { id: string | number; x: number; z: number }[];

export function BadGuys() {
  const enemiesPos2s = useQuery(Position2, IsEnemy);
  const enemyDamages = useQuery(Health, Damage, IsEnemy);
  const getHealths = React.useCallback((dmgs: typeof enemyDamages) => {
    return dmgs.map((d) => d.get(Health)!.hp.toFixed(0)).join("-");
  }, []);

  const enemyDefs = React.useMemo(() => {
    return enemiesPos2s.map((t) => {
      const pos = t.get(Position2)!;
      return {
        id: t.id(),
        x: pos.x,
        z: pos.z,
      };
    }) satisfies EnemyDefs;
  }, [enemiesPos2s]);

  const [healths, setHealths] = React.useState(() => getHealths(enemyDamages));
  const lastUpdateRef = React.useRef(0);
  useFrame((_s, d) => {
    lastUpdateRef.current += d;
    // check every 0.5 seconds
    if (lastUpdateRef.current > 0.5) {
      lastUpdateRef.current = 0;
      const currHealths = getHealths(enemyDamages);
      if (currHealths !== healths) {
        // check health values, signal a change if floats have changed
        setHealths(currHealths);
      }
    }
  });

  return (
    <>
      <EnemyInstances enemyDefs={enemyDefs} />
      {enemyDamages.map((e) => {
        const pos = e.get(Position2)!;
        const health = e.get(Health)!;
        const damage = e.get(Damage)!

        if (damage.dps <= 0) {
          return null
        }
        return (
          // Places a second red sphere + a health indication change to display enemies receiving damage per-frame
          <React.Fragment key={e.id()}>
            <EnemyDamage posX={pos.x} posZ={pos.z} />
            <Text
              letterSpacing={-0.06}
              fontSize={0.5}
              position={[pos.x, 1, pos.z]}
            >
              {health.hp.toFixed(0)}
            </Text>
          </React.Fragment>
        );
      })}
    </>
  );
}

function EnemyDamage(props: { posX: number; posZ: number }) {
  const meshRef = React.useRef<THREE.Mesh>(null!);
  const materialRef = React.useRef<THREE.Material>(null!);
  const opacityRef = React.useRef<number>(0);

  useFrame(() => {
    opacityRef.current += 0.05;
    materialRef.current.opacity = 0.1 + Math.sin(opacityRef.current) * 0.5;
  });

  return (
    <mesh position={[props.posX, 0, props.posZ]} ref={meshRef}>
      <sphereGeometry args={[0.5, 12, 12]} />
      <meshStandardMaterial
        ref={materialRef}
        color={0xff5c00}
        transparent
        opacity={0.5}
      />
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
        new THREE.Vector3(1, 1, 1),
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
