import type { MultiplayerGameStatus } from "@shared/game/types";

type SuccessOrFailure<T> =
  | { data: T; isSuccess: true; failureMessage?: undefined }
  | { data?: undefined; failureMessage: string; isSuccess: false };

/** Events sent *from* the server to the client */
export type GameSessionServerEvent =
  | {
      type: "CREATE_NEW_SESSION_RESPONSE";
      id: string;
      data: SuccessOrFailure<{
        id: string;
        myPlayerId: string;
        initialState: {
          pos: { x: number; y: number };
          playerId: string;
          playerAssignment: 1 | 2;
        }[];
      }>;
    }
  | {
      type: "JOIN_SESSION_RESPONSE";
      id: string;
      data: SuccessOrFailure<{
        id: string;
        myPlayerId: string;
        initialState: {
          pos: { x: number; y: number };
          playerId: string;
          playerAssignment: 1 | 2;
        }[];
      }>;
    }
  | {
      type: "REJOIN_EXISTING_SESSION_RESPONSE";
      id: string;
      data: SuccessOrFailure<{
        gameStatus: MultiplayerGameStatus;
        id: string;
        myPlayerId: string;
        initialState: {
          pos: { x: number; y: number };
          playerId: string;
          playerAssignment: 1 | 2;
        }[];
      }>;
    }
  | {
      type: "START_SESSION_GAME_RESPONSE";
      id: string;
      data: SuccessOrFailure<{ id: string; gameStatus: MultiplayerGameStatus }>;
    }
  | {
      type: "POSITIONS_UPDATE";
      id: string;
      data: {
        playerPositions: { x: number; y: number; playerId: string }[];
      };
    }
  | {
      type: "GAME_STATUS_UPDATE";
      id: string;
      data: {
        sessionId: string;
        gameStatus: MultiplayerGameStatus;
      };
    };

/** Events sent *from* the client to the server */
export type GameSessionClientEvent = { type: string } & (
  | {
      type: "CREATE_NEW_SESSION";
    }
  | {
      type: "JOIN_SESSION";
      data: {
        id: string;
      };
    }
  | {
      type: "REJOIN_EXISTING_SESSION";
      data: {
        id: string;
        playerId: string;
      };
    }
  | {
      type: "START_SESSION_GAME";
      data: {
        id: string;
      };
    }
  | {
      type: "PLAYER_UPDATE";
      data: {
        id: string;
        vel: {
          x: number;
          y: number;
        };
      };
    }
);
