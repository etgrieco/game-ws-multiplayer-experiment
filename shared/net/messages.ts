/** Events sent *from* the server to the client */
export type GameSessionServerEvent =
  | {
      type: "CREATE_SESSION_RESPONSE";
      data: {
        id: string;
      };
    }
  | {
      type: "JOIN_SESSION_RESPONSE";
      data:
        | {
            success: true;
            failure: undefined;
            game: {
              id: string;
            };
          }
        | {
            success: false;
            failure: string;
          };
    };

/** Events sent *from* the client to the server */
export type GameSessionClientEvent = { type: string } & (
  | {
      type: "CREATE_SESSION";
    }
  | {
      type: "JOIN_SESSION";
      data: {
        id: string;
      };
    }
);
