import { useFrame } from "@react-three/fiber";
import { Collision2, Position2 } from "@repo/game-shared/ecs/trait";
import type { Trait } from "koota";
import { useQuery, useWorld } from "koota/react";
import { useControls } from "leva";
import * as React from "react";
import * as THREE from "three";

const boxHelperMaterial = new THREE.MeshStandardMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.5,
});
const boxGeometry = new THREE.BoxGeometry(1, 1, 1); // a 'unit' box (all 1 dimensions)
/** Adds a visible bounding box helper around all collidables */
export function CollisionDebug(props: {
  traitFilters?: Trait[];
  trackMovement?: boolean;
}) {
  const instancedMeshRef = React.useRef<THREE.InstancedMesh>(null);

  const { collisionDebug } = useControls({ collisionDebug: false });
  const collidables = useQuery(
    Position2,
    Collision2,
    ...(props.traitFilters ?? []),
  );
  const world = useWorld();

  useFrame(() => {
    if (!instancedMeshRef.current || !props.trackMovement) return;
    // move to new positions without lerping ... maybe add a prop/trait to opt-in?
    const collidables = world.query(
      Position2,
      Collision2,
      ...(props.traitFilters ?? []),
    );

    const tempMatrix = new THREE.Matrix4();
    for (const [i, e] of collidables.entries()) {
      instancedMeshRef.current.getMatrixAt(i, tempMatrix);
      const pos = e.get(Position2)!;
      tempMatrix.setPosition(pos.x, 0, pos.z);
      instancedMeshRef.current.setMatrixAt(i, tempMatrix);
    }
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  React.useEffect(() => {
    // existence of the instancedRef implicitly depends upon whether collisionDebug is enabled
    if (!collisionDebug || !instancedMeshRef.current) return;

    const tempMatrix = new THREE.Matrix4();
    for (let i = 0; i < collidables.length; i++) {
      const e = collidables[i]!;
      const collision = e.get(Collision2)!;
      const position = e.get(Position2)!;
      tempMatrix.identity();
      tempMatrix.compose(
        new THREE.Vector3(position.x, 0, position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(collision.width, 1, collision.depth),
      );
      instancedMeshRef.current.setMatrixAt(i, tempMatrix);
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [collidables, collisionDebug]);

  if (!collisionDebug) return null;

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[boxGeometry, boxHelperMaterial, collidables.length]}
    />
  );
}
