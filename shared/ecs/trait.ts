import { trait } from "koota";

export const Position2 = trait({ x: 0, y: 0 });
export const Velocity2 = trait({ x: 0, y: 0 });
export const OfPlayer = trait({
  playerNumber: 1,
  isMe: false,
  playerId: "",
});
