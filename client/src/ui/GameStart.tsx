import React from "react";
import { useGameSessionStore } from "@/net/gameSession";
import { useGameStore } from "@/game/game";
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

const recentSessions = [
  {
    id: "id",
    name: "SESSION 1",
    players: 2,
    lastPlayed: new Date(),
  },
];

function SomeCard(props: {
  createSession: () => void;
  handleMySessionCode: (code: string) => void;
}) {
  const [activeTab, setActiveTab] = React.useState("create");
  const [sessionName, setSessionName] = React.useState("");
  // const [recentSessions, setRecentSessions] = React.useState<GameSession[]>([]);

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-700">
            <TabsTrigger
              value="create"
              className="data-[state=active]:bg-primary"
            >
              <GamePlus className="mr-2 h-4 w-4" />
              Create
            </TabsTrigger>
            <TabsTrigger
              value="join"
              className="data-[state=active]:bg-primary"
            >
              <Users className="mr-2 h-4 w-4" />
              Join
            </TabsTrigger>
            <TabsTrigger
              value="restore"
              className="data-[state=active]:bg-primary"
            >
              <History className="mr-2 h-4 w-4" />
              Restore
            </TabsTrigger>
          </TabsList>

          <TabsContent value="join" className="mt-4 space-y-4">
            <div className="space-y-2">
              SESSION CODE INPUT
              {/* <Label htmlFor="session-code" className="text-slate-200">
                Session Code
              </Label>
              <Input
                id="session-code"
                placeholder="Enter 6-digit session code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="bg-slate-700 text-white border-slate-600 tracking-wider font-mono"
                maxLength={6}
              /> */}
            </div>
          </TabsContent>

          <TabsContent value="restore" className="mt-4">
            {recentSessions.length > 0 ? (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-md hover:bg-slate-700 transition-colors cursor-pointer"
                    onClick={() => console.log(session)}
                  >
                    <div>
                      <h3 className="font-medium text-white">{session.name}</h3>
                      <div className="flex items-center text-xs text-slate-400 mt-1">
                        <Users className="h-3 w-3 mr-1" />
                        <span>{session.players} players</span>
                        <span className="mx-2">•</span>
                        <span>
                          Last played {formatRelativeTime(session.lastPlayed)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
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
          // <Button onClick={handleJoinSession}>Join Game</Button>
          <button onClick={() => console.log("join game")}>Join Game</button>
        )}
      </CardFooter>
    </Card>
  );
}

export function GameStart() {
  const ws = useGameSessionStore((s) => s.ws);
  const game = useGameStore((s) => s.game);
  const initGameError = useGameStore((s) => {
    if (s.gameMachineState.name === "INIT_GAME_ERROR") {
      return s.gameMachineState.data;
    }
    return undefined;
  });
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

  if (initGameError) {
    return <div>Error: {initGameError.message}</div>;
  }

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
          <div className="mt-4 p-4 bg-slate-700/50 rounded-md">
            <p className="text-sm text-secondary mb-2">
              Share this code with friends:
            </p>
            <div className="flex items-center justify-between p-3 rounded">
              <code className="text-lg font-mono text-primary font-bold tracking-wider">
                {sessionCode}
              </code>
              <Button variant="ghost" size="sm" onClick={copySessionCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <Game />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-[1024px] items-center w-full">
      <SomeCard
        createSession={() => {
          sendEvent({
            type: "CREATE_NEW_SESSION",
          });
        }}
        handleMySessionCode={() => {}}
      />
      <button
        disabled={!ws}
        onClick={() => {
          sendEvent({
            type: "CREATE_NEW_SESSION",
          });
        }}
        className="h-9 px-4 py-2 bg-green-600 text-green bg-green-600-foreground shadow hover:bg-green-600/90 rounded-sm"
      >
        Create Session
      </button>

      <div className="text-lg">OR</div>

      <div>
        <div>Join a Session</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!ws) {
              throw new Error("WS connection unavailable");
            }

            const values = new FormData(e.target as HTMLFormElement);
            const sessionId = values.get("sessionId") as string;
            sendEvent({
              type: "JOIN_SESSION",
              data: { id: sessionId },
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <fieldset>
              <label htmlFor="sessionId">Session ID: </label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                id="sessionId"
                name="sessionId"
                type="text"
              ></input>
            </fieldset>
            <button className="h-9 px-4 py-2 bg-green-600 text-green bg-green-600-foreground shadow hover:bg-green-600/90 rounded-sm">
              Join
            </button>
          </div>
        </form>
      </div>
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
