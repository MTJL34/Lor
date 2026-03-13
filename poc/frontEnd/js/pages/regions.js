// Regions list page

import { createElement, formatNumber, formatPercent, formatRegionName, createRegionIcon, createResourceIcon } from '../ui.js';
import { computeRegionNeeded, computeRegionProgress, sumInventoryValues } from '../calc.js';
import { PageHeader } from '../components/layout.js';

export function RegionsPage(appState, baseData) {
    const regionCards = [];
    const totalAccumulator = {
        totals: {},
        inventory: {}
    };
    
    for (const [regionName, regionBase] of Object.entries(baseData.regions)) {
        const inv = appState.inventoryByRegion[regionName] || {};
        const needed = computeRegionNeeded(regionBase, inv);
        const progress = computeRegionProgress(regionBase, inv);
        const neededSum = sumInventoryValues(needed);

        for (const [key, totalVal] of Object.entries(regionBase.totals || {})) {
            totalAccumulator.totals[key] = (totalAccumulator.totals[key] || 0) + (totalVal || 0);
        }
        for (const [key, invVal] of Object.entries(inv || {})) {
            totalAccumulator.inventory[key] = (totalAccumulator.inventory[key] || 0) + (invVal || 0);
        }
        
        const card = createElement('div', {
            className: 'card',
            style: { cursor: 'pointer', transition: 'all 0.2s' },
            onClick: () => {
                window.location.hash = `#/region/${encodeURIComponent(regionName)}`;
            },
            onMouseenter: (e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
            },
            onMouseleave: (e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }
        }, [
            createElement('h3', { style: { marginBottom: '1rem' } }, [
                createRegionIcon(regionName, 28)
            ]),
            createElement('div', { style: { marginBottom: '1rem' } }, [
                createElement('div', { style: { fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' } }, 
                    ['Champions: ', String(regionBase.champions?.length || 0)]),
                createElement('div', { style: { fontSize: '0.9rem', color: 'var(--text-secondary)' } }, 
                    ['Ressources manquantes: ', formatNumber(neededSum)])
            ]),
            createElement('div', { className: 'progress' }, [
                createElement('div', { 
                    className: 'progress-bar',
                    style: { width: formatPercent(progress) }
                })
            ]),
            createElement('div', { 
                style: { fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' } 
            }, [`Progression: ${formatPercent(progress)}`])
        ]);
        
        regionCards.push(card);
    }

    const totalRegionBase = { totals: totalAccumulator.totals };
    const totalNeededAll = computeRegionNeeded(totalRegionBase, totalAccumulator.inventory);
    const totalProgress = computeRegionProgress(totalRegionBase, totalAccumulator.inventory);
    const totalNeededSum = sumInventoryValues(totalNeededAll);

    const totalChampionCount = Object.values(baseData.regions || {}).reduce(
        (sum, regionBase) => sum + (regionBase.champions?.length || 0),
        0
    );

    const totalCard = createElement('div', {
        className: 'card',
        style: { cursor: 'default' }
    }, [
        createElement('h3', { style: { marginBottom: '1rem' } }, ['Total']),
        createElement('div', { style: { marginBottom: '1rem' } }, [
            createElement('div', { style: { fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' } }, 
                ['Champions: ', String(totalChampionCount)]),
            createElement('div', { style: { fontSize: '0.9rem', color: 'var(--text-secondary)' } }, 
                ['Ressources manquantes: ', formatNumber(totalNeededSum)])
        ]),
        createElement('div', { className: 'progress' }, [
            createElement('div', { 
                className: 'progress-bar',
                style: { width: formatPercent(totalProgress) }
            })
        ]),
        createElement('div', { 
            style: { fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' } 
        }, [`Progression: ${formatPercent(totalProgress)}`])
    ]);

    regionCards.push(totalCard);
    
    // Resource summary rows will be generated below near the summary table (deduplicated)


    // Needed resources per region (what is missing to reach totals)
    const regionEntries = Object.entries(baseData.regions);

    if (regionEntries.length === 0) {
        const noRegions = createElement('div', { className: 'card' }, [
            createElement('p', {}, ['Aucune région définie dans les données.'])
        ]);
        const content = createElement('div', {}, [
            PageHeader('🗺️ Régions', 'Cliquez sur une région pour gérer son inventaire'),
            noRegions
        ]);
        return content;
    }

    const neededRows = regionEntries.map(([regionName, regionBase]) => {
        const inv = appState.inventoryByRegion[regionName] || {};
        const needed = computeRegionNeeded(regionBase, inv);
        return createElement('tr', {}, [
            createElement('td', {}, [createRegionIcon(regionName, 20)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(needed.wild_shards || 0)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(needed.star_crystal || 0)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(needed.gemstone || 0)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(needed.nova_shards || 0)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(needed.nova_crystal || 0)])
        ]);
    });

    // Aggregates for needed table
    const totalNeeded = regionEntries.reduce((acc, [regionName, regionBase]) => {
        const inv = appState.inventoryByRegion[regionName] || {};
        const needed = computeRegionNeeded(regionBase, inv);
        acc.wild_shards = (acc.wild_shards || 0) + (needed.wild_shards || 0);
        acc.star_crystal = (acc.star_crystal || 0) + (needed.star_crystal || 0);
        acc.gemstone = (acc.gemstone || 0) + (needed.gemstone || 0);
        acc.nova_shards = (acc.nova_shards || 0) + (needed.nova_shards || 0);
        acc.nova_crystal = (acc.nova_crystal || 0) + (needed.nova_crystal || 0);
        return acc;
    }, {});

    const neededTable = createElement('div', { className: 'card', id: 'needed-table' }, [
        createElement('h3', { style: { marginBottom: '0.75rem' } }, ['Ressources nécessaires par région']),
        createElement('div', { className: 'table-container' }, [
            createElement('table', {}, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Région']),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('wild_shards', 18)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('star_crystal', 18)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('gemstone', 18)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('nova_shards', 18)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('nova_crystal', 18)])
                    ])
                ]),
                createElement('tbody', {}, neededRows),
                createElement('tfoot', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Total']),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalNeeded.wild_shards || 0)]),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalNeeded.star_crystal || 0)]),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalNeeded.gemstone || 0)]),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalNeeded.nova_shards || 0)]),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalNeeded.nova_crystal || 0)])
                    ])
                ])
            ])
        ])
    ]);

    const summaryRows = regionEntries.map(([regionName, regionBase]) => {
        const inv = appState.inventoryByRegion[regionName] || regionBase.inventory_default || {};
        return createElement('tr', {}, [
            createElement('td', {}, [createRegionIcon(regionName, 20)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(inv.wild_shards || 0)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(inv.star_crystal || 0)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(inv.gemstone || 0)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(inv.nova_shards || 0)]),
            createElement('td', { className: 'resource-cell' }, [formatNumber(inv.nova_crystal || 0)]),
            createElement('td', { className: 'resource-cell' }, [
                createElement('button', {
                    className: 'btn btn-secondary',
                    onClick: () => {
                        window.location.hash = `#/region/${encodeURIComponent(regionName)}`;
                    }
                }, ['Editer'])
            ])
        ]);
    });

    // Aggregates for summary table
    const totalSummary = regionEntries.reduce((acc, [regionName, regionBase]) => {
        const inv = appState.inventoryByRegion[regionName] || regionBase.inventory_default || {};
        acc.wild_shards = (acc.wild_shards || 0) + (inv.wild_shards || 0);
        acc.star_crystal = (acc.star_crystal || 0) + (inv.star_crystal || 0);
        acc.gemstone = (acc.gemstone || 0) + (inv.gemstone || 0);
        acc.nova_shards = (acc.nova_shards || 0) + (inv.nova_shards || 0);
        acc.nova_crystal = (acc.nova_crystal || 0) + (inv.nova_crystal || 0);
        return acc;
    }, {});

    const summaryTable = createElement('div', { className: 'card', id: 'summary-table' }, [
        createElement('h3', { style: { marginBottom: '0.75rem' } }, ['Résumé des ressources par région']),
        createElement('div', { className: 'table-container' }, [
            createElement('table', {}, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Région']),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('wild_shards', 18)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('star_crystal', 18)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('gemstone', 18)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('nova_shards', 18)]),
                        createElement('th', { className: 'resource-cell' }, [createResourceIcon('nova_crystal', 18)]),
                        createElement('th', { className: 'resource-cell' }, ['Edition'])
                    ])
                ]),
                createElement('tbody', {}, summaryRows),
                createElement('tfoot', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Total']),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalSummary.wild_shards || 0)]),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalSummary.star_crystal || 0)]),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalSummary.gemstone || 0)]),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalSummary.nova_shards || 0)]),
                        createElement('th', { className: 'resource-cell' }, [formatNumber(totalSummary.nova_crystal || 0)]),
                        createElement('th', { className: 'resource-cell' }, ['-'])
                    ])
                ])
            ])
        ])
    ]);

    const content = createElement('div', {}, [
        PageHeader('🗺️ Régions', 'Cliquez sur une région pour gérer son inventaire'),
        createElement('div', { className: 'card-grid' }, regionCards),
        neededTable,
        summaryTable
    ]);
    
    return content;
}
