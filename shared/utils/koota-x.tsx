import {
  type Entity as EntityKoota,
  type QueryResult as QueryResultKoota,
  type Trait as TraitKoota,
  trait as traitKoota,
} from "koota";
import { useQuery as useQueryKoota } from "koota/react";

// biome-ignore lint/suspicious/noExplicitAny: Necessary for this type
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

const traitTagSymbol = Symbol("$$traitTag");
export type Entity<T extends TraitKoota> = EntityKoota & {
  [traitTagSymbol]: T;
};

type TypedEntities<TTraits extends TraitKoota[]> = ReadonlyArray<
  EntityKoota & { [traitTagSymbol]: UnionToIntersection<TTraits[number]> }
>;

export const useQuery = <TTraits extends TraitKoota[]>(
  ...params: TTraits
): TypedEntities<TTraits> & QueryResultKoota<TTraits> => {
  return useQueryKoota(...params) as TypedEntities<TTraits> &
    QueryResultKoota<TTraits>;
};

const traitKeySymbol = Symbol("$$traitKey");
/** A way to type a trait uniquely, for better type-narrowing on functions that require entities with this trait */
export function trait<TTrait extends TraitKoota, TKey extends string>(
  trait: TTrait,
  _traitKey?: TKey,
): TraitKoota & {
  [traitKeySymbol]: TKey;
} {
  return trait as TTrait & {
    [traitKeySymbol]: TKey;
  };
}

/** Example code to prove out ideas */
const Position = trait(traitKoota({ x: 0, y: 0, z: 0 }), "Position");
const IsEnemy = trait(traitKoota(), "IsEnemy");
const IsPlayer = trait(traitKoota(), "IsPlayer");
const Health = trait(traitKoota({ hp: 0 }), "Health");

const thing = {} as Entity<typeof IsEnemy>;
thing[traitTagSymbol][traitKeySymbol] === "IsEnemy";

function MovingPlayer(_props: {
  entity: Entity<typeof Position & typeof IsPlayer>;
}) {
  return null;
}

function MovingEnemy(_props: {
  entity: Entity<typeof Position & typeof IsEnemy>;
}) {
  return null;
}

function WhateverMoves(_props: {
  entity: Entity<typeof Position>;
}) {
  _props.entity[traitTagSymbol][traitKeySymbol] === "Position";
  return null;
}

function PlayerHealth(_props: {
  entity: Entity<typeof IsPlayer & typeof Health>;
}) {
  return null;
}

function EnemyHealth(_props: {
  entity: Entity<typeof IsEnemy & typeof Health>;
}) {
  return null;
}

function Test() {
  const playerEntities = useQuery(Position, IsPlayer);
  const enemyEntities = useQuery(Position, IsEnemy);
  const healthEntities = useQuery(Health);
  const playerHealthEntity = useQuery(IsPlayer, Health)[0]!;
  const enemyHealthEntity = useQuery(IsEnemy, Health)[0]!;

  // Work as expected ✅
  const players = playerEntities.map((e) => MovingPlayer({ entity: e }));
  const enemies = enemyEntities.map((e) => MovingEnemy({ entity: e }));
  const whatevers = [...playerEntities, ...enemyEntities].map((e) =>
    WhateverMoves({ entity: e }),
  );

  // Works weirdly, Player & Position false positive, but works when Position is named?
  const enemiesWrong = playerEntities.map((e) => MovingEnemy({ entity: e }));

  const playersWrong = enemyEntities.map((e) => MovingPlayer({ entity: e }));
  // @ts-expect-error
  const whateverWrong = healthEntities.map((e) => WhateverMoves({ entity: e }));

  // False positive ⚠️ in terms of data sources
  const whateversWrong = [...playerEntities, ...enemyEntities].map((e) =>
    WhateverMoves({ entity: e }),
  );

  const playerHealthObj = PlayerHealth({ entity: playerHealthEntity });
  // False positive ⚠️ in terms of named trait, but true in terms of data stores
  const playerHealthObjWrong = PlayerHealth({ entity: enemyHealthEntity });
  const enemyHealth = EnemyHealth({ entity: enemyHealthEntity });
}
