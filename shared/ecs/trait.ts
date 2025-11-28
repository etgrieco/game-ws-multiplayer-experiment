import { trait } from "koota";

/** 2-D position data */
export const Position2 = trait({ x: 0, z: 0 });
/** 2-D velocity data */
export const Velocity2 = trait({ x: 0, z: 0 });
/** Basic player properties. isMe applicable for client-side evaluation */
export const Player = trait({
  playerNumber: 1,
  isMe: false,
  playerId: "",
});
/** Data tag tag for specific landscape properties that do not move */
export const Landscape = trait({ type: "unknown" as "tree" | "unknown" });
/** Data tag marking that upon collision should prevent movement */
export const IsObstacle = trait();
/** 2-D collision bounding box */
export const Collision2 = trait({ width: 0, depth: 0 });
/** Data tag marking entity as an enemy */
export const IsEnemy = trait();
/** Damage properties and owner of damage-giving entity */
export const DamageZone = trait({ playerId: "", dps: 1 });
/** DPS properties on .. the receiving end of damage? */
export const Damage = trait({ dps: 0 });
/** Health properties */
export const Health = trait({ hp: 0 });
