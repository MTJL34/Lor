import {
  fetchAppStateFromApi,
  pushAppStateToApi,
  withApiFallback
} from "./api.js";

const SHARED_STATE_KEY = "__lor_poc_shared_state__";
const STORAGE_KEYS = {
  customRelics: "lor_poc_custom_relics_v1",
  customChampions: "lor_poc_custom_champions_v1",
  championOverrides: "lor_poc_champion_overrides_v1"
};

function getSharedScope() {
  if (typeof window === "undefined") {
    return globalThis;
  }

  try {
    if (window.top && window.top.location && window.location && window.top.location.origin === window.location.origin) {
      return window.top;
    }
  } catch (_) {
    // Access to window.top can fail in some embedding contexts.
  }

  return window;
}

function getStorage() {
  const scope = getSharedScope();

  try {
    if (scope.localStorage) {
      return scope.localStorage;
    }
  } catch (_) {
    // Access to localStorage can fail in restricted iframe/browser contexts.
  }

  try {
    if (globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch (_) {
    // Ignore and fallback to in-memory only mode.
  }

  return null;
}

function readJsonFromStorage(storageKey, fallbackValue) {
  const storage = getStorage();
  if (!storage) return fallbackValue;

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return fallbackValue;
    return JSON.parse(raw);
  } catch (_) {
    return fallbackValue;
  }
}

function writeJsonToStorage(storageKey, value) {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

function normalizeRelicId(value) {
  if (value === 0 || value === "0" || value === "" || value === null || value === undefined) {
    return 0;
  }

  return String(value).trim();
}

function normalizeRelicSlots(values) {
  if (!Array.isArray(values)) {
    return [0, 0, 0];
  }

  const nextValues = values.slice(0, 3).map(normalizeRelicId);
  while (nextValues.length < 3) {
    nextValues.push(0);
  }
  return nextValues;
}

function cloneRelic(relic) {
  return {
    Relic_ID: String(relic?.Relic_ID ?? "").trim(),
    Relic_Name: String(relic?.Relic_Name ?? "").trim(),
    Relic_Rarity: String(relic?.Relic_Rarity ?? "").trim(),
    Relic_Description: String(relic?.Relic_Description ?? "").trim(),
    Relic_Icon: String(relic?.Relic_Icon ?? "").trim()
  };
}

function isStoredRelic(relic) {
  return Boolean(relic && relic.Relic_ID && relic.Relic_Name && relic.Relic_Rarity);
}

function cloneChampion(champion) {
  return {
    Champion_ID: Number(champion?.Champion_ID) || 0,
    Champion_Name: String(champion?.Champion_Name ?? "").trim(),
    Cost_ID: Number(champion?.Cost_ID) || 0,
    POC: Boolean(champion?.POC),
    Champion_Icon: String(champion?.Champion_Icon ?? "").trim(),
    Stars_ID: Number(champion?.Stars_ID) || 0,
    LOR_Exclusive: Boolean(champion?.LOR_Exclusive),
    Constellation_Number_ID: Number(champion?.Constellation_Number_ID) || 1,
    Level_ID: Number(champion?.Level_ID) || 1,
    Region_ID: Number(champion?.Region_ID) || 13,
    AllRelics: normalizeRelicSlots(champion?.AllRelics)
  };
}

function isStoredChampion(champion) {
  return Boolean(champion && champion.Champion_ID > 0 && champion.Champion_Name);
}

function sanitizeChampionOverride(override) {
  if (!override || typeof override !== "object") {
    return {};
  }

  const nextOverride = {};

  if ("Champion_Name" in override) nextOverride.Champion_Name = String(override.Champion_Name ?? "").trim();
  if ("Cost_ID" in override) nextOverride.Cost_ID = Number(override.Cost_ID) || 0;
  if ("POC" in override) nextOverride.POC = Boolean(override.POC);
  if ("Champion_Icon" in override) nextOverride.Champion_Icon = String(override.Champion_Icon ?? "").trim();
  if ("Stars_ID" in override) nextOverride.Stars_ID = Number(override.Stars_ID) || 0;
  if ("LOR_Exclusive" in override) nextOverride.LOR_Exclusive = Boolean(override.LOR_Exclusive);
  if ("Constellation_Number_ID" in override) {
    nextOverride.Constellation_Number_ID = Number(override.Constellation_Number_ID) || 1;
  }
  if ("Level_ID" in override) nextOverride.Level_ID = Number(override.Level_ID) || 1;
  if ("Region_ID" in override) nextOverride.Region_ID = Number(override.Region_ID) || 13;
  if ("AllRelics" in override) nextOverride.AllRelics = normalizeRelicSlots(override.AllRelics);

  return nextOverride;
}

function cloneChampionOverrides(overrides) {
  const nextOverrides = {};

  if (!overrides || typeof overrides !== "object") {
    return nextOverrides;
  }

  Object.entries(overrides).forEach(([championId, override]) => {
    const numericChampionId = Number(championId) || 0;
    const sanitizedOverride = sanitizeChampionOverride(override);

    if (numericChampionId > 0 && Object.keys(sanitizedOverride).length > 0) {
      nextOverrides[numericChampionId] = sanitizedOverride;
    }
  });

  return nextOverrides;
}

function getLocalPoCData() {
  return {
    customRelics: readJsonFromStorage(STORAGE_KEYS.customRelics, [])
      .map(cloneRelic)
      .filter(isStoredRelic),
    customChampions: readJsonFromStorage(STORAGE_KEYS.customChampions, [])
      .map(cloneChampion)
      .filter(isStoredChampion),
    championOverrides: cloneChampionOverrides(
      readJsonFromStorage(STORAGE_KEYS.championOverrides, {})
    )
  };
}

function persistLocalPoCData(pocData) {
  writeJsonToStorage(STORAGE_KEYS.customRelics, pocData.customRelics);
  writeJsonToStorage(STORAGE_KEYS.customChampions, pocData.customChampions);
  writeJsonToStorage(STORAGE_KEYS.championOverrides, pocData.championOverrides);
}

function normalizeRemotePoCData(appState) {
  const raw = appState && typeof appState === "object" && appState.pocData && typeof appState.pocData === "object"
    ? appState.pocData
    : {};

  return {
    customRelics: Array.isArray(raw.customRelics)
      ? raw.customRelics.map(cloneRelic).filter(isStoredRelic)
      : [],
    customChampions: Array.isArray(raw.customChampions)
      ? raw.customChampions.map(cloneChampion).filter(isStoredChampion)
      : [],
    championOverrides: cloneChampionOverrides(raw.championOverrides || {})
  };
}

function isPoCDataEmpty(pocData) {
  if (!pocData || typeof pocData !== "object") {
    return true;
  }

  return pocData.customRelics.length === 0
    && pocData.customChampions.length === 0
    && Object.keys(pocData.championOverrides).length === 0;
}

function applyPoCDataToState(state, pocData) {
  state.customRelics = pocData.customRelics.map(cloneRelic).filter(isStoredRelic);
  state.customChampions = pocData.customChampions.map(cloneChampion).filter(isStoredChampion);
  state.championOverrides = cloneChampionOverrides(pocData.championOverrides);
}

function buildPoCDataSnapshot(state) {
  return {
    customRelics: state.customRelics.map(cloneRelic).filter(isStoredRelic),
    customChampions: state.customChampions.map(cloneChampion).filter(isStoredChampion),
    championOverrides: cloneChampionOverrides(state.championOverrides)
  };
}

function scheduleRemoteSync() {
  const state = getSharedState();

  if (state.remoteSyncTimer) {
    clearTimeout(state.remoteSyncTimer);
  }

  state.remoteSyncTimer = setTimeout(async () => {
    state.remoteSyncTimer = null;
    try {
      await pushAppStateToApi({
        pocData: buildPoCDataSnapshot(state)
      });
    } catch (error) {
      console.warn("[PoC] remote sync failed:", error.message);
    }
  }, 350);
}

function getSharedState() {
  const scope = getSharedScope();

  if (!scope[SHARED_STATE_KEY]) {
    const localPoCData = getLocalPoCData();

    scope[SHARED_STATE_KEY] = {
      customRelics: localPoCData.customRelics,
      customChampions: localPoCData.customChampions,
      championOverrides: localPoCData.championOverrides,
      remoteSyncTimer: null,
      initPromise: null
    };
  }

  return scope[SHARED_STATE_KEY];
}

export async function initializePoCSharedState() {
  const state = getSharedState();
  if (state.initPromise) {
    return state.initPromise;
  }

  state.initPromise = (async () => {
    const localPoCData = buildPoCDataSnapshot(state);

    const remoteAppState = await withApiFallback(
      async () => fetchAppStateFromApi(),
      async () => null,
      "loadPoCSharedState"
    );

    if (!remoteAppState || typeof remoteAppState !== "object") {
      return buildPoCDataSnapshot(state);
    }

    const remotePoCData = normalizeRemotePoCData(remoteAppState);
    const shouldBootstrapRemote = isPoCDataEmpty(remotePoCData) && !isPoCDataEmpty(localPoCData);
    const nextPoCData = shouldBootstrapRemote ? localPoCData : remotePoCData;

    applyPoCDataToState(state, nextPoCData);
    persistLocalPoCData(nextPoCData);

    // Bootstrap the shared backend once, but otherwise treat the API as the source of truth.
    if (shouldBootstrapRemote) {
      scheduleRemoteSync();
    }

    return buildPoCDataSnapshot(state);
  })();

  return state.initPromise;
}

export function getCustomRelics() {
  return getSharedState().customRelics
    .map(cloneRelic)
    .filter(isStoredRelic);
}

export function addCustomRelic(relic) {
  const state = getSharedState();
  const nextRelic = cloneRelic(relic);

  state.customRelics = [
    ...state.customRelics.filter((existingRelic) => existingRelic.Relic_ID !== nextRelic.Relic_ID),
    nextRelic
  ].filter(isStoredRelic);

  persistLocalPoCData(buildPoCDataSnapshot(state));
  scheduleRemoteSync();
  return getCustomRelics();
}

export function getCustomChampions() {
  return getSharedState().customChampions
    .map(cloneChampion)
    .filter(isStoredChampion);
}

export function upsertCustomChampion(champion) {
  const state = getSharedState();
  const nextChampion = cloneChampion(champion);

  state.customChampions = [
    ...state.customChampions.filter((existingChampion) => existingChampion.Champion_ID !== nextChampion.Champion_ID),
    nextChampion
  ].filter(isStoredChampion);

  persistLocalPoCData(buildPoCDataSnapshot(state));
  scheduleRemoteSync();
  return getCustomChampions();
}

export function getChampionOverrides() {
  return cloneChampionOverrides(getSharedState().championOverrides);
}

export function setChampionOverride(championId, override) {
  const state = getSharedState();
  const numericChampionId = Number(championId) || 0;
  const sanitizedOverride = sanitizeChampionOverride(override);

  if (!numericChampionId) {
    return getChampionOverrides();
  }

  if (Object.keys(sanitizedOverride).length === 0) {
    delete state.championOverrides[numericChampionId];
  } else {
    state.championOverrides[numericChampionId] = sanitizedOverride;
  }

  persistLocalPoCData(buildPoCDataSnapshot(state));
  scheduleRemoteSync();
  return getChampionOverrides();
}
