type SessionData = {
  lastUpdated: number;
  gameId: string;
  playerId: string;
  players: 2; // Hard-code to 2 for now
};

const tryJsonParseOrNull = (str: string | null) => {
  if (!str) {
    return null;
  }
  try {
    return JSON.parse(str);
  } catch (_e) {
    return null;
  }
};

const subscribeStorageFactory = <
  TSnapshot extends Record<string, unknown> = Record<string, unknown>,
>(
  storageKey: string,
  /** Depends upon a storage interface that emits the applicable 'storage' event on window(s) upon storage manipulation */
  targetStorage: Storage,
): {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => TSnapshot | null;
  setValue: (newValue: TSnapshot) => void;
} => {
  const registeredCallbacks = new Set<() => void>();

  let currSnapshot: TSnapshot | null = tryJsonParseOrNull(
    sessionStorage.getItem(sessionKey),
  ) as TSnapshot;
  return {
    subscribe(cb) {
      const abortController = new AbortController();
      registeredCallbacks.add(cb);
      window.addEventListener(
        "storage",
        (event) => {
          const { key, oldValue, newValue, storageArea } = event;
          if (storageArea !== targetStorage) {
            return;
          }
          if (key !== storageKey) return;
          if (!Object.is(oldValue, newValue)) {
            if (newValue) {
              currSnapshot = tryJsonParseOrNull(newValue) as TSnapshot;
            } else {
              currSnapshot = null;
            }
            cb();
          }
        },
        {
          signal: abortController.signal,
        },
      );
      return () => {
        abortController.abort();
        registeredCallbacks.delete(cb);
      };
    },
    getSnapshot() {
      return currSnapshot;
    },
    setValue(newValue) {
      sessionStorage.setItem(sessionKey, JSON.stringify(newValue));
      // side-effect: update local snapshot
      const sessionStr = sessionStorage.getItem(storageKey);
      if (sessionStr) {
        currSnapshot = tryJsonParseOrNull(sessionStr) as TSnapshot;
      } else {
        currSnapshot = null;
      }
      // side-effect: trigger all registrations that an update has occurred
      registeredCallbacks.forEach((cb) => {
        cb();
      });
    },
  };
};

const sessionKey = "PREV_SESSION";
export const prevSessionSubscriptionController =
  subscribeStorageFactory<SessionData>(sessionKey, sessionStorage);

export const getStoredSessionData = () => {
  return prevSessionSubscriptionController.getSnapshot();
};
