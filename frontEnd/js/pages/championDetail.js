// Champion detail page

import { createElement, formatRegionName, getRegionStarsMax } from '../ui.js';
import { PageHeader, Card, Button, Alert } from '../components/layout.js';
import { ResourceTable } from '../components/resourceTable.js';
import { CraftPanel } from '../components/craftPanel.js';
import { saveState } from '../storage.js';

export function ChampionDetailPage(appState, baseData, regionName, championName, updateState) {
    const regionBase = baseData.regions[regionName];
    
    if (!regionBase) {
        return createElement('div', {}, [
            PageHeader('❌ Erreur'),
            Alert('Région introuvable', 'danger')
        ]);
    }
    
    const champion = regionBase.champions.find(c => c.name === championName);
    
    if (!champion) {
        return createElement('div', {}, [
            PageHeader('❌ Erreur'),
            Alert('Champion introuvable', 'danger')
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
        if (updateState) updateState(appState);
    };
    
    const handleReset = () => {
        if (confirm('Réinitialiser l\'inventaire de cette région aux valeurs par défaut ?')) {
            pendingChanges = { ...regionBase.inventory_default };
            syncPendingChanges();
            if (updateState) updateState(appState);
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
            if (updateState) updateState(appState);
        }
    };
    
    const backButton = Button('← Retour à ' + regionName, () => {
        window.location.hash = `#/region/${encodeURIComponent(regionName)}`;
    }, 'secondary');
    
    const refreshButton = Button('🔄 Rafraîchir la vue', () => {
        if (updateState) updateState(appState);
    }, 'primary');
    
    // Créer un objet "totals" basé sur les ressources du champion pour ResourceTable
    const championTotals = {
        nova_crystal: champion.resources?.nova_crystal || 0,
        nova_shards: 0,
        star_crystal: champion.resources?.star_crystal || 0,
        gemstone: champion.resources?.gemstone_total || 0,
        wild_shards: champion.resources?.wild_shards || 0
    };
    
    const championRegionBase = {
        ...regionBase,
        totals: championTotals
    };
    
    const content = createElement('div', {}, [
        PageHeader(
            `⭐ ${champion.name}`,
            `${formatRegionName(regionName)} - ${champion.stars}/${getRegionStarsMax(regionName)} étoiles - PoC ${champion.poc}`
        ),
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
        Card('Inventaire de ' + regionName, [
            ResourceTable(championRegionBase, pendingChanges, handleInventoryChange, regionName)
        ], [
            Button('🗑️ Tout à 0', handleClear, 'danger'),
            Button('🔄 Reset', handleReset, 'secondary')
        ]),
        Card('Craft Nova', [
            CraftPanel(pendingChanges, handleCraft)
        ])
    ]);
    
    return content;
}

