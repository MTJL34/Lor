// Champions page

import { createElement, formatRegionName, getRegionStarsMax, createRegionIcon, createResourceIcon, createChampionAvatar } from '../ui.js';
import { applyComputedRegionTotals } from '../calc.js';
import { PageHeader, Card, Button } from '../components/layout.js';
import { Champion as PoCChampions } from '../../data/Champion.js';
import { Cost } from '../../data/Cost.js';
import { Region as PoCRegions } from '../../data/Region.js';
import { Stars } from '../../data/Stars.js';
import {
    buildMainAppChampion,
    mapPoCRegionNameToAppRegion,
    upsertChampionInAppState,
    upsertChampionInBaseData
} from '../championState.js';
import {
    getChampionOverrides,
    getCustomChampions,
    initializePoCSharedState
} from '../pocSharedState.js';

function getPoCRegionName(champion) {
    return PoCRegions.find((region) => Number(region.Region_ID) === Number(champion?.Region_ID))?.Region_Name || '';
}

function getPoCCostValue(champion) {
    return Number(Cost.find((cost) => Number(cost.Cost_ID) === Number(champion?.Cost_ID))?.Cost_Value) || 0;
}

function getPoCStarsValue(champion) {
    return Number(Stars.find((star) => Number(star.Stars_ID) === Number(champion?.Stars_ID))?.Stars_Value) || 0;
}

function syncPoCChampionsIntoVisibleState(baseData, appState) {
    if (!baseData?.regions || !appState) {
        return;
    }

    const availableRegionNames = Object.keys(baseData.regions || {});
    const overrides = getChampionOverrides();
    const customChampions = getCustomChampions();
    const allPoCChampions = [...PoCChampions, ...customChampions];

    for (const champion of allPoCChampions) {
        const effectiveChampion = {
            ...champion,
            ...(overrides[Number(champion.Champion_ID)] || {})
        };

        if (!effectiveChampion?.Champion_Name) {
            continue;
        }

        const regionName = mapPoCRegionNameToAppRegion(getPoCRegionName(effectiveChampion), availableRegionNames);
        if (!regionName) {
            continue;
        }

        const nextChampion = buildMainAppChampion({
            name: effectiveChampion.Champion_Name,
            cost: getPoCCostValue(effectiveChampion),
            stars: getPoCStarsValue(effectiveChampion),
            poc: effectiveChampion.POC ? 1 : 0,
            regionName,
            source: 'custom'
        });

        upsertChampionInAppState(appState, regionName, nextChampion);
        upsertChampionInBaseData(baseData, regionName, nextChampion);
    }

    applyComputedRegionTotals(baseData);
}

export function ChampionsPage(appState, baseData, updateState) {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);

    if (baseData?.regions) {
        const regionEntries = Object.entries(baseData.regions);
        for (const [, regionData] of regionEntries) {
            if (!Array.isArray(regionData?.champions)) {
                regionData.champions = [];
            }
        }
    }

    syncPoCChampionsIntoVisibleState(baseData, appState);
    void initializePoCSharedState()
        .then(() => {
            syncPoCChampionsIntoVisibleState(baseData, appState);
        })
        .catch((error) => {
            console.warn('[Constellation] PoC shared state refresh failed:', error.message);
        });
    const filterRegion = urlParams.get('region');
    
    // Order regions as specified
    const regionOrder = [
        'Bandle', 'Bilgewater', 'Demacia', 'Freljord', 'Ionia', 'Noxus',
        'Piltover & Zaun', '\u00celes Obscures', 'Shurima', 'Targon',
        'Spirit World', 'Runeterra'
    ];
    
    function deleteChampion(regionName, champName) {
        if (!confirm(`Supprimer "${champName}" de ${regionName} ?`)) return;
        
        const regionBase = baseData.regions[regionName];
        if (!regionBase || !regionBase.champions) return;
        
        const index = regionBase.champions.findIndex(c => c.name === champName);
        if (index !== -1) {
            regionBase.champions.splice(index, 1);
            
            // Remove from appState.customChampions
            if (appState.customChampions && appState.customChampions[regionName]) {
                const customIndex = appState.customChampions[regionName].findIndex(
                    c => c.name === champName
                );
                if (customIndex !== -1) {
                    appState.customChampions[regionName].splice(customIndex, 1);
                }
            }
            
            updateState(appState);
            applyComputedRegionTotals(baseData);
            window.location.reload();
        }
    }
    
    function editChampion(regionName, champName) {
        window.location.hash = `#/edit-champion/${encodeURIComponent(regionName)}/${encodeURIComponent(champName)}`;
    }
    
    const groupedByRegion = [];
    
    for (const regionName of regionOrder) {
        const regionBase = baseData.regions[regionName];
        if (!regionBase) continue;
        if (filterRegion && regionName !== filterRegion) continue;
        
        // Sort champions alphabetically
        const sortedChampions = (regionBase.champions || []).sort((a, b) => 
            a.name.localeCompare(b.name)
        );
        
        groupedByRegion.push({
            regionName,
            champions: sortedChampions.map(champ => ({
                ...champ,
                region: regionName
            }))
        });
    }
    
    // Filter select
    const regionSelect = createElement('select', {
        onChange: (e) => {
            const val = e.target.value;
            if (val === 'all') {
                window.location.hash = '#/constellation';
            } else {
                window.location.hash = `#/constellation?region=${encodeURIComponent(val)}`;
            }
        }
    }, [
        createElement('option', { value: 'all', selected: !filterRegion }, ['Toutes les régions']),
        ...regionOrder.map(name => 
            createElement('option', { 
                value: name,
                selected: filterRegion === name
            }, [formatRegionName(name)])
        )
    ]);
    
    // Create region sections

    // Helper: format resource cells — show only non-zero tiers, else show single '✅' when all are zero; hide null/undefined
    function formatResourceCell(val) {
        if (val === null || typeof val === 'undefined') return '';
        if (Array.isArray(val)) {
            // keep only non-zero values
            const nonZero = val.filter(v => v !== 0 && v !== null && typeof v !== 'undefined');
            if (nonZero.length > 0) return nonZero.map(v => String(v)).join(', ');
            // array exists but all zeros
            if (val.length > 0) return '✅';
            return '';
        }
        if (typeof val === 'number') return val === 0 ? '✅' : String(val);
        if (typeof val === 'string') return val === '0' ? '✅' : val;
        return String(val);
    }

    const regionSections = groupedByRegion.map(group => {
        const champRows = group.champions.map(champ => {
            const cells = [
                createElement('td', { className: 'center-cell', style: { cursor: 'pointer' },
                    onClick: () => {
                        window.location.hash = `#/champion/${encodeURIComponent(champ.region)}/${encodeURIComponent(champ.name)}`;
                    }
                }, [
                    createElement('div', { className: 'champion-name-cell' }, [
                        createChampionAvatar(champ.name, 40),
                        createElement('span', { className: 'champion-name-text' }, [champ.name])
                    ])
                ]),
                createElement('td', { className: 'center-cell' }, [String(champ.cost || 0)]),
                createElement('td', { className: 'center-cell' }, [createRegionIcon(champ.region, 22)]),
                createElement('td', { className: 'center-cell' }, [
                    `${champ.stars || 0}/${getRegionStarsMax(champ.region)}`
                ]),
                createElement('td', { className: 'resource-cell' }, [
                    formatResourceCell(champ.resources?.wild_shards_tiers ?? champ.resources?.wild_shards ?? null)
                ]),
                createElement('td', { className: 'resource-cell' }, [
                    formatResourceCell(champ.resources?.wild_shards_total ?? champ.resources?.wild_shards ?? null)
                ]),
                createElement('td', { className: 'resource-cell' }, [
                    formatResourceCell(champ.resources?.star_crystal_tiers ?? champ.resources?.star_crystal ?? null)
                ]),
                createElement('td', { className: 'resource-cell' }, [
                    formatResourceCell(champ.resources?.star_crystal_total ?? champ.resources?.star_crystal ?? null)
                ]),
                createElement('td', { className: 'resource-cell' }, [
                    formatResourceCell(champ.resources?.gemstone_tiers ?? null)
                ]),
                createElement('td', { className: 'resource-cell' }, [
                    formatResourceCell(champ.resources?.gemstone_total ?? champ.resources?.gemstone ?? null)
                ]),
                createElement('td', { className: 'resource-cell' }, [
                    formatResourceCell(champ.resources?.nova_crystal ?? null)
                ])
            ];
            
            // Add edit and delete buttons for ALL champions
            const actionButtons = createElement('div', { style: { display: 'flex', gap: '0.5rem' } }, [
                Button('✏️', () => editChampion(champ.region, champ.name), 'secondary'),
                Button('🗑️', () => deleteChampion(champ.region, champ.name), 'danger')
            ]);
            cells.push(createElement('td', {}, [actionButtons]));
            
            return createElement('tr', {}, cells);
        });
        
        const table = createElement('table', { style: { width: '100%', marginBottom: '1rem' } }, [
            createElement('thead', {}, [
                createElement('tr', {}, [
                    createElement('th', { className: 'center-cell' }, ['Champion']),
                    createElement('th', { className: 'center-cell' }, ['Coût']),
                    createElement('th', { className: 'center-cell' }, ['Région']),
                    createElement('th', { className: 'center-cell' }, ['Étoiles']),
                    createElement('th', { className: 'resource-cell' }, [createResourceIcon('wild_shards', 16)]),
                    createElement('th', { className: 'resource-cell' }, [createResourceIcon('wild_shards', 16)]),
                    createElement('th', { className: 'resource-cell' }, [createResourceIcon('star_crystal', 16)]),
                    createElement('th', { className: 'resource-cell' }, [createResourceIcon('star_crystal', 16)]),
                    createElement('th', { className: 'resource-cell' }, [createResourceIcon('gemstone', 16)]),
                    createElement('th', { className: 'resource-cell' }, [createResourceIcon('gemstone', 16)]),
                    createElement('th', { className: 'resource-cell' }, [createResourceIcon('nova_crystal', 16)]),
                    createElement('th', {}, ['Actions'])
                ])
            ]),
            createElement('tbody', {}, champRows)
        ]);
        
        return Card(`${formatRegionName(group.regionName)}`, [
            createElement('div', { className: 'table-container' }, [table])
        ]);
    });
    
    // Compute totals across all displayed champions
    const allChampions = groupedByRegion.flatMap(g => g.champions);

    function sumArrayLike(val) {
        if (Array.isArray(val)) return val.reduce((s, v) => s + (Number(v) || 0), 0);
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return Number(val) || 0;
        return 0;
    }

    const totals = allChampions.reduce((acc, champ) => {
        // Count champions (we'll display this count in the 'Coût' total cell)
        acc.champion_count = (acc.champion_count || 0) + 1;
        // For stars, count missing stars to reach 6 per champion
        const starsVal = Number(champ.stars) || 0;
        const starsMissing = Math.max(0, getRegionStarsMax(champ.region) - starsVal);
        acc.stars_missing = (acc.stars_missing || 0) + starsMissing;
        acc.wild_palier = (acc.wild_palier || 0) + sumArrayLike(champ.resources?.wild_shards_tiers ?? champ.resources?.wild_shards ?? 0);
        acc.wild_total = (acc.wild_total || 0) + (Number(champ.resources?.wild_shards_total ?? champ.resources?.wild_shards) || 0);
        acc.star_palier = (acc.star_palier || 0) + sumArrayLike(champ.resources?.star_crystal_tiers ?? champ.resources?.star_crystal ?? 0);
        acc.star_total = (acc.star_total || 0) + (Number(champ.resources?.star_crystal_total ?? champ.resources?.star_crystal) || 0);
        acc.gem_palier = (acc.gem_palier || 0) + sumArrayLike(champ.resources?.gemstone_tiers ?? 0);
        acc.gem_total = (acc.gem_total || 0) + (Number(champ.resources?.gemstone_total ?? champ.resources?.gemstone) || 0);
        acc.nova_crystal = (acc.nova_crystal || 0) + (Number(champ.resources?.nova_crystal) || 0);
        return acc;
    }, {});

    // Use champion count for the Coût total cell
    totals.cost = totals.champion_count || 0;

    const totalsTable = createElement('div', { className: 'card', id: 'champion-totals' }, [
        createElement('h3', { style: { marginBottom: '0.75rem' } }, ['Totaux des champions']),
        createElement('div', { className: 'table-container' }, [
            createElement('table', {}, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', { className: 'center-cell' }, ['Champion']),
                        createElement('th', { className: 'center-cell' }, ['Coût']),
                        createElement('th', { className: 'center-cell' }, ['Région']),
                        createElement('th', { className: 'center-cell' }, ['Étoiles']),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('wild_shards', 16)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('wild_shards', 16)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('star_crystal', 16)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('star_crystal', 16)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('gemstone', 16)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('gemstone', 16)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('nova_crystal', 16)]),
                        createElement('th', {}, ['Actions'])
                    ])
                ]),
                createElement('tbody', {}, [
                    createElement('tr', {}, [
                        createElement('td', { className: 'center-cell' }, ['Total']),
                        createElement('td', { className: 'center-cell' }, [String(totals.cost || 0)]),
                        createElement('td', {}, ['']),
                        createElement('td', { className: 'center-cell' }, [String(totals.stars_missing || 0)]),
                        createElement('td', { className: 'resource-cell' }, [String(totals.wild_palier || 0)]),
                        createElement('td', { className: 'resource-cell' }, [String(totals.wild_total || 0)]),
                        createElement('td', { className: 'resource-cell' }, [String(totals.star_palier || 0)]),
                        createElement('td', { className: 'resource-cell' }, [String(totals.star_total || 0)]),
                        createElement('td', { className: 'resource-cell' }, [String(totals.gem_palier || 0)]),
                        createElement('td', { className: 'resource-cell' }, [String(totals.gem_total || 0)]),
                        createElement('td', { className: 'resource-cell' }, [String(totals.nova_crystal || 0)]),
                        createElement('td', {}, [''])
                    ])
                ])
            ])
        ])
    ]);

    const addButton = Button('+ Ajouter un champion', () => {
        window.location.hash = '#/add-champion';
    }, 'primary');
    
    const content = createElement('div', {}, [
        PageHeader('Constellation', 'Tous les champions par région'),
        Card('Filtres', [
            createElement('div', { className: 'form-group' }, [
                createElement('label', { className: 'form-label' }, ['Région']),
                regionSelect
            ]),
            createElement('div', { style: { marginTop: '1rem' } }, [addButton])
        ]),
        ...regionSections,
        totalsTable
    ]);
    
    return content;
}



