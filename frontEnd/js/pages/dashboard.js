// Dashboard page

import { createElement, formatNumber, formatPercent, formatRegionName } from '../ui.js';
import { computeGlobalNeeded, computeRegionProgress, sumInventoryValues } from '../calc.js';
import { PageHeader, Card } from '../components/layout.js';

export function DashboardPage(appState, baseData) {
    const globalNeeded = computeGlobalNeeded(baseData, appState.inventoryByRegion);
    
    // Stats cards
    const statsCards = [];
    for (const [key, needed] of Object.entries(globalNeeded)) {
        statsCards.push(
            createElement('div', { className: 'stat-card' }, [
                createElement('div', { className: 'stat-label' }, [key]),
                createElement('div', { className: 'stat-value' }, [formatNumber(needed)])
            ])
        );
    }
    
    const statsGrid = createElement('div', { className: 'stats-grid' }, statsCards);
    
    // Top regions by needed
    const regionStats = [];
    for (const [regionName, regionBase] of Object.entries(baseData.regions)) {
        const inv = appState.inventoryByRegion[regionName] || {};
        const progress = computeRegionProgress(regionBase, inv);
        const neededSum = sumInventoryValues(
            Object.fromEntries(
                Object.entries(regionBase.totals).map(([k, total]) => [
                    k,
                    Math.max(0, total - (inv[k] || 0))
                ])
            )
        );
        
        regionStats.push({
            name: regionName,
            progress,
            neededSum
        });
    }
    
    regionStats.sort((a, b) => b.neededSum - a.neededSum);
    
    const topRegionsList = regionStats.slice(0, 5).map(stat => {
        return createElement('div', {
            className: 'card',
            style: { cursor: 'pointer', transition: 'transform 0.2s' },
            onClick: () => {
                window.location.hash = `#/region/${encodeURIComponent(stat.name)}`;
            },
            onMouseenter: (e) => e.currentTarget.style.transform = 'scale(1.02)',
            onMouseleave: (e) => e.currentTarget.style.transform = 'scale(1)'
        }, [
            createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' } }, [
                createElement('strong', {}, [formatRegionName(stat.name)]),
                createElement('span', { 
                    className: 'badge badge-warning' 
                }, [formatNumber(stat.neededSum)])
            ]),
            createElement('div', { className: 'progress' }, [
                createElement('div', { 
                    className: 'progress-bar',
                    style: { width: formatPercent(stat.progress) }
                })
            ]),
            createElement('div', { 
                style: { fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' } 
            }, [`Progression: ${formatPercent(stat.progress)}`])
        ]);
    });
    
    const content = createElement('div', {}, [
        PageHeader('📊 Dashboard', 'Vue d\'ensemble de vos ressources'),
        Card('Ressources Manquantes Globales', [statsGrid]),
        Card('Top 5 Régions par Besoins', topRegionsList)
    ]);
    
    return content;
}
