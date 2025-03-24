import { trait } from "koota";

export const Position2 = trait({ x: 0, z: 0 });
export const Velocity2 = trait({ x: 0, z: 0 });
export const Player = trait({
  playerNumber: 1,
  isMe: false,
  playerId: "",
});
export const Landscape = trait({ type: "unknown" as "tree" | "unknown" });
export const Collision2 = trait({ width: 0, depth: 0 });
