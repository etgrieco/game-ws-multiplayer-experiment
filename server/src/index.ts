import { WebSocketServer } from "ws";
import { GameSessionClientEvent } from "@shared/net/messages.js";
import { MultiplayerGameContainer } from "./MultiplayerGameContainer.js";
import { handleEventsIncoming } from "./handle-events-incoming.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait.js";
import { createWorld, World } from "koota";
import { setupGameSimulation } from "./game-factory.js";

const BAK_PATH = path.resolve(import.meta.dirname, "../../bak");
const BAK_FILENAME = "bak.json";
const BAK_FILE_ENC = "utf-8";

console.log("Server started...");

const wss = new WebSocketServer({ port: 8080 });

type SessionMap = Map<string, MultiplayerGameContainer>;
/** Singleton holding our games! */
const sessionsData: SessionMap = new Map(
  (() => {
    try {
      const backupFile = fs
        .readFileSync(path.join(BAK_PATH, BAK_FILENAME))
        .toString(BAK_FILE_ENC);
      const backupData = JSON.parse(backupFile) as ReturnType<
        typeof toJSONBackup
      >[];
      return fromJSONBackup(backupData);
    } catch (e) {
      console.error("Backup read failed, return empty");
      return [];
    }
  })(),
);

function toWorldJSONBackup(container: World) {
  return container.query(Position2, Velocity2, OfPlayer).map((e) => {
    return {
      player: e.get(OfPlayer),
      pos: e.get(Position2),
      vel: e.get(Velocity2),
    };
  });
}

function toJSONBackup(id: string, sess: MultiplayerGameContainer) {
  return [id, toWorldJSONBackup(sess.gameSim.gameData.world)] as const;
}

function fromJSONBackup(b: ReturnType<typeof toJSONBackup>[]): SessionMap {
  const map: SessionMap = new Map();

  const players: MultiplayerGameContainer["players"] = [null, null];
  b.forEach(([id, backupWorldEntities]) => {
    const world = createWorld();
    backupWorldEntities.forEach((e) => {
      if (e.player) {
        players[e.player.playerNumber - 1] = e.player.playerId;
        world.spawn(Position2(e.pos), Velocity2(e.vel), OfPlayer(e.player));
      } else {
        console.warn(
          "I do not know how to spawn non-player entity... moving on",
        );
      }
    });
    map.set(id, {
      id,
      broadcaster: null,
      gameStatus: "PAUSED_AWAITING_PLAYERS",
      connections: [null, null],
      gameSim: setupGameSimulation(id, world),
      players: players,
    });
  });
  return map;
}

process.on("exit", () => {
  console.log("closing! backing up data");
  fs.mkdirSync(BAK_PATH, { recursive: true });

  const data = Array.from(sessionsData.entries()).map(([id, sess]) => {
    return toJSONBackup(id, sess);
  });

  fs.writeFileSync(path.join(BAK_PATH, BAK_FILENAME), JSON.stringify(data), {
    encoding: BAK_FILE_ENC,
  });
});

console.log(Array.from(sessionsData.keys()).join("\n"));

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  // Handle incoming messages
  ws.on(
    "message",
    tryCatchLog(function message(data, isBinary) {
      if (isBinary) {
        console.log("Message is binary; rejecting.");
        return;
      }
      const strData = data.toString("utf-8");
      const jsonParsed = JSON.parse(strData) as GameSessionClientEvent;
      handleEventsIncoming(jsonParsed, {
        sessionsData,
        ws,
      });
    }),
  );
});

function tryCatchLog<T extends (...args: any[]) => any>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    try {
      return fn(...args);
    } catch (error) {
      console.error("Error in function:", error);
      return undefined;
    }
  };
}
