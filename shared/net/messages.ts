/** Events sent *from* the server to the client */
export type GameSessionServerEvent = {
  type: "CREATE_SESSION_RESPONSE";
  data: {
    id: string;
  };
};

/** Events sent *from* the client to the server */
export type GameSessionClientEvent = {
  type: "CREATE_SESSION";
  data?: undefined;
};
