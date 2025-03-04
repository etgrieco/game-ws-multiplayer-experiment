import { Position2, Velocity2 } from "./trait";
export function movePosition2System(world) {
    const movables = world.query(Position2, Velocity2);
    movables.updateEach(([p, v]) => {
        p.x += v.x;
        p.y += v.y;
    });
}
