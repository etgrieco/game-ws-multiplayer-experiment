import React from "react";
import { useGameSessionStore } from "@/net/gameSession";
import { useGameStore, useVanillaGameStore } from "@/game/game";
import { Game } from "./Game";
import {
  GamepadIcon as GamePlus,
  Users,
  History,
  ArrowRight,
  Copy,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Label } from "@radix-ui/react-label";
import { Input } from "@/components/ui/input";
import { prevSessionSubscriptionController } from "./sessionStorageController";

function CreateOrJoinInterface(props: {
  createSession: () => void;
  joinSession: (sessionId: string) => void;
  restoreSession: (sessionId: string, playerId: string) => void;
}) {
  const [sessionCode, setSessionCode] = React.useState("");
  const storageSession = React.useSyncExternalStore(
    prevSessionSubscriptionController.subscribe,
    prevSessionSubscriptionController.getSnapshot,
  );
  const [activeTab, setActiveTab] = React.useState<
    "create" | "join" | "restore"
  >(storageSession?.gameId ? "restore" : "create");
  const recentSessions = [storageSession].flatMap((s) => (s ? [s] : []));

  return (
    <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 shadow-xl backdrop-blur">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-white">
          Multiplayer Game
        </CardTitle>
        <CardDescription className="text-slate-300">
          Create, join or restore a multiplayer session
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as typeof activeTab);
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 bg-primary/70">
            <TabsTrigger
              value="create"
              className="data-[state=active]:bg-primary data-[state=active]:text-secondary"
            >
              <GamePlus className="mr-2 h-4 w-4" />
              Create
            </TabsTrigger>
            <TabsTrigger
              value="join"
              className="data-[state=active]:bg-primary data-[state=active]:text-secondary"
            >
              <Users className="mr-2 h-4 w-4" />
              Join
            </TabsTrigger>
            <TabsTrigger
              value="restore"
              className="data-[state=active]:bg-primary data-[state=active]:text-secondary"
            >
              <History className="mr-2 h-4 w-4" />
              Restore
            </TabsTrigger>
          </TabsList>

          <TabsContent value="join" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-code" className="text-slate-200">
                Session Code
              </Label>
              <Input
                id="session-code"
                placeholder="Enter session code (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="bg-slate-700 text-white border-slate-600 tracking-wider font-mono"
              />
            </div>
          </TabsContent>

          <TabsContent value="restore" className="mt-4">
            {recentSessions.length > 0 ? (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session?.gameId}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-md hover:bg-slate-700 transition-colors cursor-pointer"
                    onClick={() => {
                      props.restoreSession(session.gameId, session.playerId);
                    }}
                  >
                    <div>
                      <h3 className="font-medium text-white">
                        {session?.gameId}
                      </h3>
                      <div className="flex items-center text-xs text-slate-400 mt-1">
                        <Users className="h-3 w-3 mr-1" />
                        <span>{session.players} players</span>
                        <span className="mx-2">•</span>
                        <span>
                          Last played{" "}
                          {formatRelativeTime(new Date(session.lastUpdated))}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-secondary-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No recent sessions found</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-end">
        {activeTab === "create" && (
          <Button onClick={props.createSession}>Create Session</Button>
        )}
        {activeTab === "join" && (
          <Button
            disabled={!sessionCode}
            onClick={() => {
              if (!sessionCode) return;
              props.joinSession(sessionCode);
            }}
          >
            Join Game
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function GameStart() {
  const game = useGameStore((s) => s.game);
  const sendEvent = useGameSessionStore((s) => s.sendEvent);
  const gameSessionStore = useGameSessionStore();
  const sessionCode = useGameStore((s) => s.game?.gameData.sessionId);

  React.useEffect(() => {
    if (!gameSessionStore.ws) {
      gameSessionStore.initWs();
    }
    return () => {
      gameSessionStore.removeWs();
    };
  }, []);

  const gameStore = useVanillaGameStore();
  React.useEffect(function toastOnNewIncomingError() {
    let currInitError: { id: string; message: string } | undefined;
    const machineState = gameStore.getState().gameMachineState;
    if (machineState.name === "INIT_GAME_ERROR") {
      currInitError = machineState.data;
    }
    return gameStore.subscribe((state) => {
      const machineState = state.gameMachineState;
      const newInitError =
        machineState.name === "INIT_GAME_ERROR" ? machineState.data : null;
      if (newInitError && !Object.is(currInitError?.id, newInitError.id)) {
        currInitError = newInitError;
        toast(<span className="text-red-500 font-bold">Error</span>, {
          description: newInitError.message,
          position: "top-center",
        });
      }
    });
  }, []);

  if (game) {
    // Copy session code to clipboard
    const copySessionCode = () => {
      if (!sessionCode) {
        return;
      }
      navigator.clipboard.writeText(sessionCode);
      toast("Copied!", {
        description: "Session code copied to clipboard",
        position: "top-right",
      });
    };

    return (
      <div className="text-primary">
        {sessionCode && (
          <div className="p-4 bg-slate-700/50 rounded-md">
            <p className="text-sm text-secondary">
              Share this code with friends:
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded">
                <code className="text-lg font-mono text-primary font-bold tracking-wider">
                  {sessionCode}
                </code>
                <Button variant="ghost" size="sm" onClick={copySessionCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="self-end">
                <Button
                  onClick={() => {
                    gameSessionStore.sendEvent({
                      type: "START_SESSION_GAME",
                      data: { id: game.gameData.sessionId },
                    });
                  }}
                >
                  Start Game
                </Button>
              </div>
            </div>
          </div>
        )}
        <Game />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-[1024px] items-center w-full">
      <CreateOrJoinInterface
        createSession={() => {
          sendEvent({
            type: "CREATE_NEW_SESSION",
          });
        }}
        joinSession={(sessionId) => {
          sendEvent({
            type: "JOIN_SESSION",
            data: { id: sessionId },
          });
        }}
        restoreSession={(sessionId, playerId) => {
          sendEvent({
            type: "REJOIN_EXISTING_SESSION",
            data: {
              id: sessionId,
              playerId: playerId,
            },
          });
        }}
      />
    </div>
  );
}

// Format date to relative time (e.g., "2 days ago")
const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  } else {
    return "Just now";
  }
};
