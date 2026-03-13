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
        if (updateState) updateState(appState);
    };
    
    const handleCraft = (newInv) => {
        pendingChanges = { ...newInv };
        appState.inventoryByRegion[regionName] = newInv;
        saveState(appState);
        if (updateState) updateState(appState);
    };
    
    const handleReset = () => {
        if (confirm('Réinitialiser l\'inventaire de cette région aux valeurs par défaut ?')) {
            pendingChanges = { ...regionBase.inventory_default };
            appState.inventoryByRegion[regionName] = { ...regionBase.inventory_default };
            saveState(appState);
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
            appState.inventoryByRegion[regionName] = cleared;
            saveState(appState);
            if (updateState) updateState(appState);
        }
    };
    
    const backButton = Button('← Retour à ' + regionName, () => {
        window.location.hash = `#/region/${encodeURIComponent(regionName)}`;
    }, 'secondary');
    
    const applyButton = Button('✅ Tout est à jour', handleApply, 'primary');
    applyButton.disabled = true;
    
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
            applyButton
        ]),
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

