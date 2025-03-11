import { MultiplayerGameStatus } from "@shared/game/types";

type SuccessOrFailure<T extends any> =
  | { data: T; isSuccess: true; failureMessage?: undefined }
  | { data?: undefined; failureMessage: string; isSuccess: false };

/** Events sent *from* the server to the client */
export type GameSessionServerEvent =
  | {
      type: "CREATE_NEW_SESSION_RESPONSE";
      id: string;
      data: SuccessOrFailure<{ id: string; playerId: string }>;
    }
  | {
      type: "JOIN_SESSION_RESPONSE";
      id: string;
      data: SuccessOrFailure<{
        id: string;
        playerId: string;
        gameStatus: MultiplayerGameStatus;
      }>;
    }
  | {
      type: "REJOIN_EXISTING_SESSION_RESPONSE";
      id: string;
      data: SuccessOrFailure<{
        id: string;
        playerId: string;
        playerNumber: 1 | 2;
        gameStatus: MultiplayerGameStatus;
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
        playerPositions: [{ x: number; y: number }, { x: number; y: number }];
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
