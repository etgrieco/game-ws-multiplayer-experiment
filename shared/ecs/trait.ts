import { trait } from "koota";

export const Position2 = trait({ x: 0, z: 0 });
export const Velocity2 = trait({ x: 0, z: 0 });
export const OfPlayer = trait({
  playerNumber: 1,
  isMe: false,
  playerId: "",
});
export const IsObstacle = trait();
export const IsLandscape = trait({ type: "unknown" as "tree" | "unknown" });
