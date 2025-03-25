import { levelConfig } from "@config/levelConfig";

const TERRAIN_ROTATION = [-Math.PI / 2, 0, 0] as const;
export function Terrain() {
  return (
    <mesh rotation={TERRAIN_ROTATION}>
      <meshStandardMaterial color={levelConfig.terrain.color} />
      <planeGeometry
        args={[levelConfig.terrain.maxX, levelConfig.terrain.maxZ]}
      />
    </mesh>
  );
}
