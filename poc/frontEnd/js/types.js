// Type schemas and validation

export function validateState(state) {
    if (!state || typeof state !== 'object') return false;
    if (state.version !== 1) return false;
    if (!state.inventoryByRegion || typeof state.inventoryByRegion !== 'object') return false;
    // customChampions is optional for backward compatibility
    return true;
}

export function validateRegionInventory(inv, resourceKeys) {
    if (!inv || typeof inv !== 'object') return false;
    for (const key of resourceKeys) {
        if (typeof inv[key] !== 'number' || inv[key] < 0) return false;
    }
    return true;
}

export function clampInt(n) {
    const val = parseInt(n, 10);
    return isNaN(val) || val < 0 ? 0 : val;
}

export function createEmptyInventory(resourceKeys) {
    const inv = {};
    for (const key of resourceKeys) {
        inv[key] = 0;
    }
    return inv;
}
