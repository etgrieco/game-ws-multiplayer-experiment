import * as fs from "node:fs";
import * as path from "node:path";
import {
  IsEnemy,
  Landscape,
  Player,
  Position2,
  Velocity2,
} from "@shared/ecs/trait.js";
import type { GameSessionClientEvent } from "@shared/net/messages.js";
import { type World, createWorld } from "koota";
import { WebSocketServer } from "ws";
import type { MultiplayerGameContainer } from "./MultiplayerGameContainer.js";
import { createGameBroadcaster, setupGameSimulation } from "./game-factory.js";
import { handleEventsIncoming } from "./handle-events-incoming.js";
import { wsSend } from "./wsSend.js";
import { spawnBadGuy, spawnPlayer, spawnTree } from "@shared/ecs/spawn.js";

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
      let sessionsMap = fromJSONBackup(backupData);
      sessionsMap = new Map(
        Array.from(sessionsMap.entries())
          .sort(([_ka, valueA], [_kb, valueB]) => {
            return valueB.gameSim.lastUpdated - valueA.gameSim.lastUpdated;
          })
          // max latest 5
          .slice(0, 5)
          // max 24 hours ago
          .filter(([_, value]) => {
            return Date.now() - value.gameSim.lastUpdated < 24 * 60 * 60 * 1000;
          })
      );
      console.log(`loading ${sessionsMap.size} backups`);
      return sessionsMap;
    } catch (e) {
      console.error("Backup read failed, return empty");
      return [];
    }
  })()
);

function toWorldJSONBackup(container: World) {
  const playersQuery = container.query(Position2, Velocity2, Player);
  const players = playersQuery.map((e) => {
    return {
      player: e.get(Player)!,
      pos: e.get(Position2)!,
      vel: e.get(Velocity2)!,
    };
  });
  const terrain = container.query(Position2, Landscape).map((e) => {
    return {
      pos: e.get(Position2),
      landscape: e.get(Landscape),
    };
  });
  const enemies = container.query(Position2, IsEnemy).map((e) => {
    return {
      pos: e.get(Position2),
    };
  });

  return {
    players,
    terrain,
    enemies,
  };
}

function toJSONBackup(
  id: string,
  sess: MultiplayerGameContainer,
  lastUpdated: number
) {
  return [
    id,
    {
      lastUpdated: lastUpdated,
      world: toWorldJSONBackup(sess.gameSim.gameData.world),
    },
  ] as const;
}

function fromJSONBackup(b: ReturnType<typeof toJSONBackup>[]): SessionMap {
  const map: SessionMap = new Map();

  b.forEach(([id, { world: backupWorldEntities, lastUpdated }]) => {
    const world = createWorld();
    // handle spawning players
    const players = backupWorldEntities.players;
    console.log(`spawning ${players.length} players`);
    players.forEach((e) => {
      if (e.player) {
        spawnPlayer(world, {
          pos: e.pos,
          player: e.player,
        });
      } else {
        console.warn(
          "I do not know how to spawn non-player entity... moving on"
        );
      }
    });
    // handle spawning terrain
    backupWorldEntities.terrain.forEach((e) => {
      if (e.landscape?.type === "tree") {
        spawnTree(world, e.pos!);
      } else {
        console.warn("I do not know how to spawn non-tree entity... moving on");
      }
    });
    // handle spawning enemies
    backupWorldEntities.enemies.forEach((e) => {
      spawnBadGuy(world, e.pos!);
    });

    const gameSim = setupGameSimulation(id, world, lastUpdated);
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
    return toJSONBackup(id, sess, sess.gameSim.lastUpdated);
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
