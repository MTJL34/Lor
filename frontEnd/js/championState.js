import { loadState, saveState } from './storage.js';

const MAIN_APP_BRIDGE_KEY = '__lor_main_app_bridge__';

function cloneArrayWithLength(values, length) {
    const nextValues = Array.isArray(values)
        ? values.map((value) => Number(value) || 0).slice(0, length)
        : [];

    while (nextValues.length < length) {
        nextValues.push(0);
    }

    return nextValues;
}

function sumValues(values) {
    return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function createEmptyAppState() {
    return {
        version: 1,
        options: {
            showSimulatedCraftView: false
        },
        inventoryByRegion: {},
        customChampions: {}
    };
}

export function getSharedScope() {
    if (typeof window === 'undefined') {
        return globalThis;
    }

    try {
        if (window.top && window.top.location && window.location && window.top.location.origin === window.location.origin) {
            return window.top;
        }
    } catch (_) {
        // Ignore cross-origin access failures and fallback to the current window.
    }

    return window;
}

export function setMainAppBridge(bridge) {
    const scope = getSharedScope();
    scope[MAIN_APP_BRIDGE_KEY] = bridge;
    return bridge;
}

export function getMainAppBridge() {
    return getSharedScope()[MAIN_APP_BRIDGE_KEY] || null;
}

export function normalizeChampionName(name) {
    return String(name || '').trim().toLowerCase();
}

export function findChampionIndexByName(champions, championName) {
    if (!Array.isArray(champions)) {
        return -1;
    }

    const normalizedName = normalizeChampionName(championName);
    if (!normalizedName) {
        return -1;
    }

    for (let index = champions.length - 1; index >= 0; index -= 1) {
        if (normalizeChampionName(champions[index]?.name) === normalizedName) {
            return index;
        }
    }

    return -1;
}

export function findChampionByName(champions, championName) {
    const index = findChampionIndexByName(champions, championName);
    return index === -1 ? null : champions[index];
}

export function upsertChampionInCollection(collection, champion) {
    if (!Array.isArray(collection) || !champion || !champion.name) {
        return collection;
    }

    const index = findChampionIndexByName(collection, champion.name);

    if (index === -1) {
        collection.push(champion);
    } else {
        collection[index] = champion;
    }

    return collection;
}

export function removeChampionFromCollection(collection, championName) {
    if (!Array.isArray(collection)) {
        return 0;
    }

    const normalizedName = normalizeChampionName(championName);
    if (!normalizedName) {
        return 0;
    }

    let removed = 0;

    for (let index = collection.length - 1; index >= 0; index -= 1) {
        if (normalizeChampionName(collection[index]?.name) === normalizedName) {
            collection.splice(index, 1);
            removed += 1;
        }
    }

    return removed;
}

export function ensureCustomChampionMap(appState) {
    if (!appState || typeof appState !== 'object') {
        return null;
    }

    if (!appState.customChampions || typeof appState.customChampions !== 'object') {
        appState.customChampions = {};
    }

    return appState.customChampions;
}

export function ensureAppStateRegionChampionList(appState, regionName) {
    const customChampions = ensureCustomChampionMap(appState);
    if (!customChampions || !regionName) {
        return null;
    }

    if (!Array.isArray(customChampions[regionName])) {
        customChampions[regionName] = [];
    }

    return customChampions[regionName];
}

export function ensureBaseDataRegionChampionList(baseData, regionName) {
    const regionBase = baseData?.regions?.[regionName];
    if (!regionBase) {
        return null;
    }

    if (!Array.isArray(regionBase.champions)) {
        regionBase.champions = [];
    }

    return regionBase.champions;
}

export function upsertChampionInAppState(appState, regionName, champion) {
    const champions = ensureAppStateRegionChampionList(appState, regionName);
    if (!champions) {
        return false;
    }

    upsertChampionInCollection(champions, champion);
    return true;
}

export function removeChampionFromAppState(appState, regionName, championName) {
    const champions = ensureAppStateRegionChampionList(appState, regionName);
    if (!champions) {
        return 0;
    }

    return removeChampionFromCollection(champions, championName);
}

export function upsertChampionInBaseData(baseData, regionName, champion) {
    const champions = ensureBaseDataRegionChampionList(baseData, regionName);
    if (!champions) {
        return false;
    }

    upsertChampionInCollection(champions, champion);
    return true;
}

export function removeChampionFromBaseData(baseData, regionName, championName) {
    const champions = ensureBaseDataRegionChampionList(baseData, regionName);
    if (!champions) {
        return 0;
    }

    return removeChampionFromCollection(champions, championName);
}

export function isSpiritWorldRegion(regionName) {
    return regionName === 'Spirit World';
}

export function getRegionStarsMax(regionName) {
    return isSpiritWorldRegion(regionName) ? 7 : 6;
}

export function mapPoCRegionNameToAppRegion(regionName, availableRegionNames = []) {
    const normalizedRegionName = String(regionName || '').trim();
    if (!normalizedRegionName) {
        return '';
    }

    if (availableRegionNames.includes(normalizedRegionName)) {
        return normalizedRegionName;
    }

    const regionAliases = {
        'Shadow Isles': '\u00celes Obscures'
    };

    return regionAliases[normalizedRegionName] || normalizedRegionName;
}

export function inferSyncedChampionSource(existingChampion) {
    if (existingChampion?.source === 'custom') {
        return 'custom';
    }

    if (existingChampion) {
        return 'modified';
    }

    return 'custom';
}

export function getChampionResourceTemplate(regionName) {
    if (isSpiritWorldRegion(regionName)) {
        const starCrystalTiers = [40, 10, 50];
        const gemstoneTiers = [100, 200, 250, 350];
        const wildShardsTiers = [800, 10, 60, 80];

        return {
            nova_crystal: 0,
            star_crystal_tiers: starCrystalTiers,
            star_crystal_total: sumValues(starCrystalTiers),
            star_crystal_tier1_region: '',
            gemstone_tiers: gemstoneTiers,
            gemstone_total: sumValues(gemstoneTiers),
            wild_shards_tiers: wildShardsTiers,
            wild_shards_total: sumValues(wildShardsTiers)
        };
    }

    const starCrystalTiers = [10, 40];
    const gemstoneTiers = [150, 250, 250, 350];
    const wildShardsTiers = [200, 60, 80, 100];

    return {
        nova_crystal: 0,
        star_crystal_tiers: starCrystalTiers,
        star_crystal_total: sumValues(starCrystalTiers),
        star_crystal_tier1_region: '',
        gemstone_tiers: gemstoneTiers,
        gemstone_total: sumValues(gemstoneTiers),
        wild_shards_tiers: wildShardsTiers,
        wild_shards_total: sumValues(wildShardsTiers)
    };
}

export function normalizeChampionResources(resources, regionName) {
    const defaults = getChampionResourceTemplate(regionName);
    const starCrystalLength = isSpiritWorldRegion(regionName) ? 3 : 2;
    const starCrystalTiers = cloneArrayWithLength(
        resources?.star_crystal_tiers ?? defaults.star_crystal_tiers,
        starCrystalLength
    );
    const gemstoneTiers = cloneArrayWithLength(
        resources?.gemstone_tiers ?? defaults.gemstone_tiers,
        4
    );
    const wildShardsTiers = cloneArrayWithLength(
        resources?.wild_shards_tiers ?? defaults.wild_shards_tiers,
        4
    );

    return {
        nova_crystal: Number(resources?.nova_crystal ?? defaults.nova_crystal) || 0,
        star_crystal_tiers: starCrystalTiers,
        star_crystal_total: sumValues(starCrystalTiers),
        star_crystal_tier1_region: isSpiritWorldRegion(regionName)
            ? String(resources?.star_crystal_tier1_region ?? defaults.star_crystal_tier1_region ?? '').trim()
            : '',
        gemstone_tiers: gemstoneTiers,
        gemstone_total: sumValues(gemstoneTiers),
        wild_shards_tiers: wildShardsTiers,
        wild_shards_total: sumValues(wildShardsTiers)
    };
}

export function buildMainAppChampion({
    name,
    cost = 0,
    stars = 0,
    poc = 1,
    regionName = '',
    source = 'custom',
    resources
}) {
    const starsMax = getRegionStarsMax(regionName);
    const normalizedStars = Math.max(0, Math.min(starsMax, Number(stars) || 0));

    return {
        name: String(name || '').trim(),
        cost: Number(cost) || 0,
        stars: normalizedStars,
        poc: Number(poc) ? 1 : 0,
        source,
        resources: normalizeChampionResources(resources, regionName)
    };
}

export function resolveChampionForEdit(appState, baseData, regionName, championName) {
    const fromAppState = findChampionByName(appState?.customChampions?.[regionName], championName);
    if (fromAppState) {
        return fromAppState;
    }

    return findChampionByName(baseData?.regions?.[regionName]?.champions, championName);
}

export async function syncChampionToMainApp({ regionName, champion, onlyIfMissing = false }) {
    if (!regionName || !champion?.name) {
        return false;
    }

    const bridge = getMainAppBridge();
    if (bridge && typeof bridge.upsertChampion === 'function') {
        return Boolean(bridge.upsertChampion(regionName, champion, { onlyIfMissing }));
    }

    const state = await loadState() || createEmptyAppState();
    const existingChampion = findChampionByName(state.customChampions?.[regionName], champion.name);

    if (onlyIfMissing && existingChampion) {
        return false;
    }

    upsertChampionInAppState(state, regionName, champion);
    saveState(state);
    return true;
}
