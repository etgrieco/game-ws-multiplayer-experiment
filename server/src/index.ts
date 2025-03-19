import * as fs from "node:fs";
import * as path from "node:path";
import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait.js";
import type { GameSessionClientEvent } from "@shared/net/messages.js";
import { type World, createWorld } from "koota";
import { WebSocketServer } from "ws";
import type { MultiplayerGameContainer } from "./MultiplayerGameContainer.js";
import { createGameBroadcaster, setupGameSimulation } from "./game-factory.js";
import { handleEventsIncoming } from "./handle-events-incoming.js";
import { wsSend } from "./wsSend.js";

const BAK_PATH = path.resolve(import.meta.dirname, "../../bak");
const createBakFileName = (date: Date) => `bak-${date.getTime()}.json`;
const BAK_FILE_ENC = "utf-8";

console.log("Server started...");

const wss = new WebSocketServer({ port: 8080 });

type SessionMap = Map<string, MultiplayerGameContainer>;
/** Singleton holding our games! */
const sessionsData: SessionMap = new Map(
  (() => {
    try {
      const dirFiles = fs.readdirSync(BAK_PATH).sort();
      const mostRecentBakFilename = dirFiles[dirFiles.length - 1];
      if (!mostRecentBakFilename) {
        return;
      }
      const filePath = path.join(BAK_PATH, mostRecentBakFilename);
      console.log("loading backup: ", filePath);
      const backupFile = fs.readFileSync(filePath).toString(BAK_FILE_ENC);
      const backupData = JSON.parse(backupFile) as ReturnType<
        typeof toJSONBackup
      >[];
      return fromJSONBackup(backupData);
    } catch (e) {
      console.error("Backup read failed, return empty");
      return [];
    }
  })()
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

  b.forEach(([id, backupWorldEntities]) => {
    const world = createWorld();
    backupWorldEntities.forEach((e) => {
      if (e.player) {
        world.spawn(Position2(e.pos), Velocity2(e.vel), OfPlayer(e.player));
      } else {
        console.warn(
          "I do not know how to spawn non-player entity... moving on"
        );
      }
    });
    const gameSim = setupGameSimulation(id, world);
    map.set(id, {
      id,
      broadcaster: createGameBroadcaster(gameSim.gameData, [null, null]),
      gameStatus: "PAUSED_AWAITING_PLAYERS",
      gameSim: gameSim,
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

  fs.writeFileSync(
    path.join(BAK_PATH, createBakFileName(new Date())),
    JSON.stringify(data),
    {
      encoding: BAK_FILE_ENC,
    }
  );
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
    })
  );

  ws.on("close", function close(_code, _reason) {
    for (const [sessionId, sessionData] of sessionsData.entries()) {
      const foundWs = sessionData.broadcaster.connections.includes(ws);
      if (!foundWs) {
        continue;
      }
      // tell other users a disconnect has happened!
      sessionData.broadcaster.connections.forEach((ws) => {
        if (!ws) return;
        wsSend(ws, {
          id: crypto.randomUUID(),
          type: "GAME_STATUS_UPDATE",
          data: {
            sessionId: sessionId,
            multiplayerSessionStatus: "PAUSED_AWAITING_PLAYERS",
          },
        });
      });
      // then, pause the game
      sessionData.gameSim.pause();
      break;
    }
  });
});

// biome-ignore lint/suspicious/noExplicitAny: This would otherwise be a difficult thing to type
function tryCatchLog<T extends (...args: any[]) => any>(
  fn: T
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
