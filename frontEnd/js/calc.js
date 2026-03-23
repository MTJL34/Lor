// All calculations (pure functions)

import { clampInt } from './types.js';

export function computeNeeded(total, inventory) {
    const t = clampInt(total);
    const i = clampInt(inventory);
    return Math.max(0, t - i);
}

export function computeRegionNeeded(regionBase, inventory) {
    const needed = {};
    const totals = regionBase.totals;
    
    for (const [key, total] of Object.entries(totals)) {
        const inv = inventory[key] || 0;
        needed[key] = computeNeeded(total, inv);
    }
    
    return needed;
}

export function computeRegionProgress(regionBase, inventory) {
    const totals = regionBase.totals;
    let totalSum = 0;
    let neededSum = 0;
    
    for (const [key, total] of Object.entries(totals)) {
        const inv = inventory[key] || 0;
        totalSum += total;
        neededSum += computeNeeded(total, inv);
    }
    
    if (totalSum === 0) return 1;
    return Math.max(0, Math.min(1, 1 - (neededSum / totalSum)));
}

export function computeGlobalNeeded(baseData, inventoryByRegion) {
    const globalNeeded = {};
    const resourceKeys = Object.keys(baseData.resources.regional);
    
    for (const key of resourceKeys) {
        globalNeeded[key] = 0;
    }
    
    for (const [regionName, regionBase] of Object.entries(baseData.regions)) {
        const inv = inventoryByRegion[regionName] || {};
        const needed = computeRegionNeeded(regionBase, inv);
        
        for (const [key, val] of Object.entries(needed)) {
            globalNeeded[key] = (globalNeeded[key] || 0) + val;
        }
    }
    
    return globalNeeded;
}

function sumValues(values) {
    if (!Array.isArray(values)) return 0;
    return values.reduce((sum, val) => sum + (Number(val) || 0), 0);
}

function getResourceTotal(resources, baseKey, tiersKey, totalKey) {
    if (!resources) return 0;
    const tiers = resources[tiersKey];
    if (Array.isArray(tiers)) return sumValues(tiers);
    const total = resources[totalKey];
    if (typeof total === 'number') return total;
    const base = resources[baseKey];
    if (typeof base === 'number') return base;
    return 0;
}

function normalizeRegionKey(regionName) {
    if (!regionName) return '';
    const map = {
        'Shadow Isles': '\u00celes Obscures'
    };
    return map[regionName] || regionName;
}

export function computeChampionResourceTotals(baseData) {
    const totalsByRegion = {};

    for (const regionName of Object.keys(baseData.regions || {})) {
        totalsByRegion[regionName] = {
            wild_shards: 0,
            star_crystal: 0,
            gemstone: 0,
            nova_crystal: 0
        };
    }

    for (const [regionName, regionBase] of Object.entries(baseData.regions || {})) {
        const champions = regionBase.champions || [];
        for (const champ of champions) {
            const resources = champ.resources || {};
            totalsByRegion[regionName].wild_shards += getResourceTotal(
                resources,
                'wild_shards',
                'wild_shards_tiers',
                'wild_shards_total'
            );
            totalsByRegion[regionName].gemstone += getResourceTotal(
                resources,
                'gemstone',
                'gemstone_tiers',
                'gemstone_total'
            );
            totalsByRegion[regionName].nova_crystal += typeof resources.nova_crystal === 'number'
                ? resources.nova_crystal
                : 0;

            const tiers = Array.isArray(resources.star_crystal_tiers) ? resources.star_crystal_tiers : null;
            const tier1Region = normalizeRegionKey(resources.star_crystal_tier1_region);
            if (
                tiers &&
                regionName === 'Spirit World' &&
                tier1Region &&
                tier1Region !== 'Spirit World' &&
                totalsByRegion[tier1Region]
            ) {
                totalsByRegion[tier1Region].star_crystal += Number(tiers[0]) || 0;
                totalsByRegion[regionName].star_crystal += (Number(tiers[1]) || 0) + (Number(tiers[2]) || 0);
            } else {
                totalsByRegion[regionName].star_crystal += getResourceTotal(
                    resources,
                    'star_crystal',
                    'star_crystal_tiers',
                    'star_crystal_total'
                );
            }
        }
    }

    return totalsByRegion;
}

export function applyComputedRegionTotals(baseData) {
    const computed = computeChampionResourceTotals(baseData);

    for (const [regionName, regionBase] of Object.entries(baseData.regions || {})) {
        const baseTotals = regionBase.totals || {};
        const regionTotals = computed[regionName] || {};
        regionBase.totals = {
            ...baseTotals,
            wild_shards: regionTotals.wild_shards ?? baseTotals.wild_shards ?? 0,
            star_crystal: regionTotals.star_crystal ?? baseTotals.star_crystal ?? 0,
            gemstone: regionTotals.gemstone ?? baseTotals.gemstone ?? 0,
            nova_crystal: regionTotals.nova_crystal ?? baseTotals.nova_crystal ?? 0
        };
    }
}

export function computeCraftable(nova_shards) {
    return Math.floor(clampInt(nova_shards) / 100);
}

export function applyCraft(inventory, amount) {
    const crafted = clampInt(amount);
    const shards = clampInt(inventory.nova_shards);
    const crystals = clampInt(inventory.nova_crystal);
    
    if (crafted === 0 || crafted > computeCraftable(shards)) {
        return null;
    }
    
    return {
        ...inventory,
        nova_shards: shards - (crafted * 100),
        nova_crystal: crystals + crafted
    };
}

export function validateDiffs(baseNeeded, computedNeeded) {
    const diffs = {};
    let hasDiffs = false;
    
    for (const key in baseNeeded) {
        const base = baseNeeded[key] || 0;
        const computed = computedNeeded[key] || 0;
        
        if (base !== computed) {
            diffs[key] = { base, computed, diff: computed - base };
            hasDiffs = true;
        }
    }
    
    return hasDiffs ? diffs : null;
}

export function sumInventoryValues(inventory) {
    return Object.values(inventory).reduce((sum, val) => sum + clampInt(val), 0);
}
