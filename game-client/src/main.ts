import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
   <button id="session-trigger">trigger new session</button>
  </div>
`;

(
  document.querySelector("#session-trigger")! as HTMLButtonElement
).addEventListener("click", () => {
  console.log("sending...");
  ws.send(
    JSON.stringify({
      type: "CREATE_SESSION",
    }),
  );
});

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
