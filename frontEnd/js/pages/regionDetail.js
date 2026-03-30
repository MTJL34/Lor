// Region detail page

import { createElement, formatRegionName } from '../ui.js';
import { PageHeader, Card, Button, Alert } from '../components/layout.js';
import { ResourceTable } from '../components/resourceTable.js';
import { CraftPanel } from '../components/craftPanel.js';
import { saveState } from '../storage.js';

export function RegionDetailPage(appState, baseData, regionName, updateState) {
    const regionBase = baseData.regions[regionName];
    
    if (!regionBase) {
        return createElement('div', {}, [
            PageHeader('❌ Erreur'),
            Alert('Région introuvable', 'danger')
        ]);
    }
    
    const inv = appState.inventoryByRegion[regionName] || {};
    let pendingChanges = { ...inv };

    const syncPendingChanges = () => {
        appState.inventoryByRegion[regionName] = { ...pendingChanges };
        saveState(appState);
    };
    
    const handleInventoryChange = (key, value) => {
        pendingChanges[key] = value;
        syncPendingChanges();
    };
    
    const handleCraft = (newInv) => {
        pendingChanges = { ...newInv };
        syncPendingChanges();
        updateState(appState);
    };
    
    const handleReset = () => {
        if (confirm('Réinitialiser l\'inventaire de cette région aux valeurs par défaut ?')) {
            pendingChanges = { ...regionBase.inventory_default };
            syncPendingChanges();
            updateState(appState);
        }
    };
    
    const handleClear = () => {
        if (confirm('Mettre tout l\'inventaire de cette région à 0 ?')) {
            const cleared = {};
            for (const key of Object.keys(regionBase.totals)) {
                cleared[key] = 0;
            }
            pendingChanges = cleared;
            syncPendingChanges();
            updateState(appState);
        }
    };
    
    const backButton = Button('← Retour', () => {
        window.location.hash = '#/regions';
    }, 'secondary');
    
    const refreshButton = Button('🔄 Rafraîchir la vue', () => {
        updateState(appState);
    }, 'primary');
    
    const content = createElement('div', {}, [
        PageHeader(`🗺️ ${formatRegionName(regionName)}`, 'Gérez l\'inventaire de cette région'),
        createElement('div', { style: { marginBottom: '1rem', display: 'flex', gap: '0.5rem' } }, [
            backButton,
            refreshButton
        ]),
        createElement('p', {
            style: {
                marginBottom: '1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem'
            }
        }, ['Les modifications sont sauvegardées automatiquement en base.']),
        Card('Inventaire', [
            ResourceTable(regionBase, pendingChanges, handleInventoryChange, regionName)
        ], [
            Button('🗑️ Tout à 0', handleClear, 'danger'),
            Button('🔄 Reset', handleReset, 'secondary')
        ]),
        Card('Craft Nova', [
            CraftPanel(pendingChanges, handleCraft)
        ]),
        Card('Champions', [
            createElement('div', { className: 'champions-list' }, 
                regionBase.champions.map(champ => {
                    const card = createElement('div', { 
                        className: 'champion-card',
                        style: { 
                            padding: '1rem', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '8px',
                            marginBottom: '0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }
                    }, [
                        createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, [champ.name]),
                        createElement('div', { style: { fontSize: '0.9rem', color: 'var(--text-secondary)' } }, [
                            `⭐ ${champ.stars}/6 | 💎 ${champ.cost} | ${champ.source === 'bundle' ? '📦 Bundle' : '🎮 Normal'}`
                        ])
                    ]);
                    
                    card.addEventListener('mouseenter', () => {
                        card.style.borderColor = 'var(--primary)';
                        card.style.backgroundColor = 'var(--hover-bg)';
                    });
                    card.addEventListener('mouseleave', () => {
                        card.style.borderColor = 'var(--border-color)';
                        card.style.backgroundColor = '';
                    });
                    card.addEventListener('click', () => {
                        window.location.hash = `#/champion/${regionName}/${encodeURIComponent(champ.name)}`;
                    });
                    
                    return card;
                })
            )
        ])
    ]);
    
    return content;
}

