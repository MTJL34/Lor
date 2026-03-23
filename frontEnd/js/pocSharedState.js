const SHARED_STATE_KEY = "__lor_poc_shared_state__";
const CUSTOM_RELICS_STORAGE_KEY = "lor_poc_custom_relics_v1";

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

function readCustomRelicsFromStorage() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(CUSTOM_RELICS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(cloneRelic)
      .filter(isStoredRelic);
  } catch (_) {
    return [];
  }
}

function persistCustomRelics(relics) {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(
      CUSTOM_RELICS_STORAGE_KEY,
      JSON.stringify(relics.map(cloneRelic).filter(isStoredRelic))
    );
    return true;
  } catch (_) {
    return false;
  }
}

function getSharedState() {
  const scope = getSharedScope();

  if (!scope[SHARED_STATE_KEY]) {
    scope[SHARED_STATE_KEY] = {
      customRelics: readCustomRelicsFromStorage()
    };
  }

  return scope[SHARED_STATE_KEY];
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
    ...state.customRelics.filter(existingRelic => existingRelic.Relic_ID !== nextRelic.Relic_ID),
    nextRelic
  ].filter(isStoredRelic);

  persistCustomRelics(state.customRelics);
  return getCustomRelics();
}
