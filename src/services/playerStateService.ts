import defaultPlayerState from "../data/playerState.json";

export type PlayerState = {
  hallLevel: number;
  prestige: number;
  territoryCount: number;
  troopCount: number;
  mainTroopPower: number;
  season: string;
  wood: number;
  stone: number;
  food: number;
  iron: number;
  ownedHeroes: string[];
};

const PLAYER_STATE_STORAGE_KEY = "yishanhe-player-state";

function isPlayerState(value: unknown): value is PlayerState {
  if (!value || typeof value !== "object") return false;
  const state = value as PlayerState;

  return (
    typeof state.hallLevel === "number" &&
    typeof state.prestige === "number" &&
    typeof state.territoryCount === "number" &&
    typeof state.troopCount === "number" &&
    typeof state.mainTroopPower === "number" &&
    typeof state.season === "string" &&
    typeof state.wood === "number" &&
    typeof state.stone === "number" &&
    typeof state.food === "number" &&
    typeof state.iron === "number" &&
    (state.ownedHeroes === undefined ||
      (Array.isArray(state.ownedHeroes) &&
        state.ownedHeroes.every((heroName) => typeof heroName === "string")))
  );
}

function normalizePlayerState(state: PlayerState): PlayerState {
  return {
    ...state,
    ownedHeroes: state.ownedHeroes ?? [],
  };
}

export function getPlayerState(): PlayerState {
  if (typeof window === "undefined") return normalizePlayerState(defaultPlayerState as PlayerState);

  try {
    const rawState = window.localStorage.getItem(PLAYER_STATE_STORAGE_KEY);
    if (!rawState) return normalizePlayerState(defaultPlayerState as PlayerState);

    const parsedState = JSON.parse(rawState) as unknown;
    return isPlayerState(parsedState)
      ? normalizePlayerState(parsedState)
      : normalizePlayerState(defaultPlayerState as PlayerState);
  } catch {
    return normalizePlayerState(defaultPlayerState as PlayerState);
  }
}

export function updatePlayerState(nextState: Partial<PlayerState>): PlayerState {
  const updatedState = {
    ...getPlayerState(),
    ...nextState,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(PLAYER_STATE_STORAGE_KEY, JSON.stringify(updatedState));
  }

  return updatedState;
}
