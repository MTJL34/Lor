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
    let isDirty = false;
    
    const handleInventoryChange = (key, value) => {
        pendingChanges[key] = value;
        isDirty = true;
        // Update button state
        applyButton.disabled = false;
        applyButton.textContent = '💾 Appliquer les modifications';
    };
    
    const handleApply = () => {
        appState.inventoryByRegion[regionName] = { ...pendingChanges };
        saveState(appState);
        isDirty = false;
        applyButton.disabled = true;
        applyButton.textContent = '✅ Modifications appliquées';
        // Refresh without reload
        updateState(appState);
    };
    
    const handleCraft = (newInv) => {
        pendingChanges = { ...newInv };
        appState.inventoryByRegion[regionName] = newInv;
        saveState(appState);
        updateState(appState);
    };
    
    const handleReset = () => {
        if (confirm('Réinitialiser l\'inventaire de cette région aux valeurs par défaut ?')) {
            pendingChanges = { ...regionBase.inventory_default };
            appState.inventoryByRegion[regionName] = { ...regionBase.inventory_default };
            saveState(appState);
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
            appState.inventoryByRegion[regionName] = cleared;
            saveState(appState);
            updateState(appState);
        }
    };
    
    const backButton = Button('← Retour', () => {
        window.location.hash = '#/regions';
    }, 'secondary');
    
    const applyButton = Button('✅ Tout est à jour', handleApply, 'primary');
    applyButton.disabled = true;
    
    const content = createElement('div', {}, [
        PageHeader(`🗺️ ${formatRegionName(regionName)}`, 'Gérez l\'inventaire de cette région'),
        createElement('div', { style: { marginBottom: '1rem', display: 'flex', gap: '0.5rem' } }, [
            backButton,
            applyButton
        ]),
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

