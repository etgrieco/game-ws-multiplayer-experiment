import type { MultiplayerSessionStatus } from "../game/types.js";

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
        multiplayerSessionStatus: MultiplayerSessionStatus;
        initialPlayersState: {
          pos: { x: number; z: number };
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
        multiplayerSessionStatus: MultiplayerSessionStatus;
        initialPlayersState: {
          pos: { x: number; z: number };
          playerId: string;
          playerAssignment: 1 | 2;
        }[];
      }>;
    }
  | {
      type: "REJOIN_EXISTING_SESSION_RESPONSE";
      id: string;
      data: SuccessOrFailure<{
        multiplayerSessionStatus: MultiplayerSessionStatus;
        id: string;
        myPlayerId: string;
        initialPlayersState: {
          pos: { x: number; z: number };
          playerId: string;
          playerAssignment: 1 | 2;
        }[];
      }>;
    }
  | {
      type: "START_SESSION_GAME_RESPONSE";
      id: string;
      data: SuccessOrFailure<{
        id: string;
        multiplayerSessionStatus: MultiplayerSessionStatus;
      }>;
    }
  | {
      type: "POSITIONS_UPDATE";
      id: string;
      data: {
        playerPositions: { x: number; z: number; playerId: string }[];
        damagePositions: { x: number; z: number; playerId: string }[];
      };
    }
  | {
      type: "LEVEL_UPDATE";
      id: string;
      data: {
        treePositions: { x: number; z: number }[];
        badGuyPositions: { x: number; z: number }[];
      };
    }
  | {
      type: "GAME_STATUS_UPDATE";
      id: string;
      data: {
        sessionId: string;
        multiplayerSessionStatus: MultiplayerSessionStatus;
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
          z: number;
        };
      };
    }
);
