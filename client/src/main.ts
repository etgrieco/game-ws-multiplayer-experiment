import { createWorld } from "koota";
import { Position2, Velocity2 } from "@shared/ecs/trait";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
   <button id="session-trigger">trigger new session</button>
   <div id="canvas-root"></div>
  </div>
`;

/** START GAME CODE */

const world = createWorld();

const myPlayer = world.spawn(Position2, Velocity2);

function setupButtons() {
  const sessionTriggerBtn = document.querySelector(
    "#session-trigger",
  )! as HTMLButtonElement;
  sessionTriggerBtn.addEventListener("click", () => {
    console.log("sending...");
    ws.send(
      JSON.stringify({
        type: "CREATE_SESSION",
      }),
    );
  });
}
setupButtons();

const ws = new WebSocket("ws://localhost:8080");

ws.addEventListener("open", function () {
  console.log("connected to the server");
});

ws.addEventListener("close", function () {
  console.log("server connection closed");
});

ws.addEventListener("message", function (e) {
  console.log(`Received message: `, e.data);
});

ws.addEventListener("message", function (e) {
  console.log("received data", e);
  if (typeof e.data === "string") {
    // parse input
    try {
      const _jsonData = JSON.parse(e.data);
      console.log(_jsonData);
    } catch (e) {
      console.error(e);
    } finally {
    } // no-op, move on
  }
});
