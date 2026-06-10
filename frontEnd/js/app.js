// Main app entry point

import { $, render, setActiveNav } from './ui.js';
import { loadState, saveState } from './storage.js';
import { validateState, createEmptyInventory } from './types.js';
import { fetchSiteDataFromApi, getApiBase } from './api.js';
import { DashboardPage } from './pages/dashboard.js';
import { RegionsPage } from './pages/regions.js';
import { RegionDetailPage } from './pages/regionDetail.js';
import { ChampionDetailPage } from './pages/championDetail.js';
import { ChampionsPage } from './pages/champions.js';
import { AddChampionPage } from './pages/addChampion.js';
import { EditChampionPage } from './pages/editChampion.js';
import { ExportImportPage } from './pages/exportImport.js';
import { HelpRulesPage } from './pages/helpRules.js';
import { PoCEmbedPage } from './pages/pocEmbed.js';
import { applyComputedRegionTotals } from './calc.js';
import { Champion as PoCChampions } from '../data/Champion.js';
import { Cost } from '../data/Cost.js';
import { Region as PoCRegions } from '../data/Region.js';
import { Stars } from '../data/Stars.js';
import siteDataFallback from '../data/site_data.js';
import {
    buildMainAppChampion,
    inferSyncedChampionSource,
    mapPoCRegionNameToAppRegion,
    normalizeChampionName,
    removeChampionFromAppState,
    removeChampionFromBaseData,
    resolveChampionForEdit,
    setMainAppBridge,
    syncChampionToMainApp,
    upsertChampionInAppState,
    upsertChampionInBaseData
} from './championState.js';
import {
    getChampionOverrides,
    getCustomChampions,
    initializePoCSharedState
} from './pocSharedState.js';

// Global state object that can be imported
export const globalState = {
    baseData: null,
    appState: null
};

function setMainNavOpen(isOpen) {
    const sidebar = $('#appSidebar');
    const toggle = $('#appNavToggle');
    const backdrop = $('#appNavBackdrop');

    if (!sidebar || !toggle || !backdrop) {
        return;
    }

    sidebar.classList.toggle('is-open', isOpen);
    backdrop.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    document.body.classList.toggle('app-nav-open', isOpen);
}

function setupResponsiveNav() {
    const toggle = $('#appNavToggle');
    const close = $('#appNavClose');
    const backdrop = $('#appNavBackdrop');
    const sidebar = $('#appSidebar');

    if (!toggle || !backdrop || !sidebar) {
        return;
    }

    sidebar.setAttribute('aria-hidden', 'true');
    setMainNavOpen(false);

    toggle.addEventListener('click', () => {
        const isOpen = sidebar.classList.contains('is-open');
        setMainNavOpen(!isOpen);
    });

    close?.addEventListener('click', () => setMainNavOpen(false));
    backdrop.addEventListener('click', () => setMainNavOpen(false));

    sidebar.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('a')) {
            setMainNavOpen(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setMainNavOpen(false);
        }
    });
}

async function loadBaseData() {
    try {
        const apiData = await fetchSiteDataFromApi();
        if (apiData) {
            console.log(`🌐 Base data loaded from API (${getApiBase()})`);
            return apiData;
        }
    } catch (e) {
        console.warn('API site-data unavailable, fallback to local data:', e.message);
    }

    try {
        if (siteDataFallback) {
            console.log('📦 Base data loaded from bundled site_data.json module');
            return siteDataFallback;
        }
    } catch (e) {
        console.warn('JSON module fallback unavailable, trying fetch fallback:', e.message);
    }

    try {
        const response = await fetch('./data/site_data.json');
        if (!response.ok) throw new Error('Failed to load local site_data.json');
        console.log('📁 Base data loaded from local site_data.json');
        return await response.json();
    } catch (e) {
        console.error('Error loading base data:', e);
        return null;
    }
}

async function initializeState() {
    const saved = await loadState();
    
    if (saved && validateState(saved)) {
        console.log('📦 Loading saved state');
        
        // Restore custom champions to baseData
        if (saved.customChampions) {
            for (const [regionName, champions] of Object.entries(saved.customChampions)) {
                if (globalState.baseData.regions[regionName]) {
                    for (const customChamp of champions) {
                        upsertChampionInBaseData(globalState.baseData, regionName, customChamp);
                    }
                }
            }
        }
        
        applyComputedRegionTotals(globalState.baseData);
        return saved;
    }
    
    console.log('🆕 Initializing NEW state from base data');
    
    // Initialize from base data
    const inventoryByRegion = {};
    const resourceKeys = Object.keys(globalState.baseData.resources.regional);
    
    for (const [regionName, regionBase] of Object.entries(globalState.baseData.regions)) {
        if (regionBase.inventory_default) {
            inventoryByRegion[regionName] = { ...regionBase.inventory_default };
            console.log(`  ✅ ${regionName}:`, regionBase.inventory_default);
        } else {
            inventoryByRegion[regionName] = createEmptyInventory(resourceKeys);
            console.log(`  ⚠️ ${regionName}: using empty inventory`);
        }
    }
    
    const newState = {
        version: 1,
        options: {
            showSimulatedCraftView: false
        },
        inventoryByRegion,
        customChampions: {}
    };
    
    console.log('💾 Saving new state');
    saveState(newState);
    
    applyComputedRegionTotals(globalState.baseData);
    return newState;
}

function registerMainAppBridge() {
    setMainAppBridge({
        upsertChampion(regionName, champion, options = {}) {
            if (!globalState.appState || !globalState.baseData || !regionName || !champion?.name) {
                return false;
            }

            const lookupRegionName = options.originalRegionName || regionName;
            const lookupChampionName = options.originalChampionName || champion.name;
            const existingChampion = resolveChampionForEdit(
                globalState.appState,
                globalState.baseData,
                lookupRegionName,
                lookupChampionName
            );

            if (options.onlyIfMissing && existingChampion) {
                return false;
            }

            if (
                lookupRegionName !== regionName
                || normalizeChampionName(lookupChampionName) !== normalizeChampionName(champion.name)
            ) {
                removeChampionFromAppState(globalState.appState, lookupRegionName, lookupChampionName);
                removeChampionFromBaseData(globalState.baseData, lookupRegionName, lookupChampionName);
            }

            const nextChampion = {
                ...(existingChampion || {}),
                ...champion,
                icon: champion.icon || existingChampion?.icon || '',
                source: champion.source || inferSyncedChampionSource(existingChampion)
            };

            upsertChampionInAppState(globalState.appState, regionName, nextChampion);
            upsertChampionInBaseData(globalState.baseData, regionName, nextChampion);
            applyComputedRegionTotals(globalState.baseData);
            saveState(globalState.appState);
            return true;
        }
    });
}

function getPoCRegionName(champion) {
    return PoCRegions.find((region) => Number(region.Region_ID) === Number(champion?.Region_ID))?.Region_Name || '';
}

function getPoCCostValue(champion) {
    return Number(Cost.find((cost) => Number(cost.Cost_ID) === Number(champion?.Cost_ID))?.Cost_Value) || 0;
}

function getPoCStarsValue(champion) {
    return Number(Stars.find((star) => Number(star.Stars_ID) === Number(champion?.Stars_ID))?.Stars_Value) || 0;
}

function isRealConstellationChampion(champion) {
    return Boolean(
        champion?.Champion_Name
        && champion.POC
        && Number(champion.Constellation_Number_ID) > 1
    );
}

async function syncPoCChampionsIntoMainApp() {
    if (!globalState.baseData) {
        return;
    }

    try {
        await initializePoCSharedState();

        const availableRegionNames = Object.keys(globalState.baseData.regions || {});
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

            if (!isRealConstellationChampion(effectiveChampion)) {
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
                icon: effectiveChampion.Champion_Icon || '',
                regionName,
                source: 'custom'
            });

            await syncChampionToMainApp({
                regionName,
                champion: nextChampion,
                onlyIfMissing: true
            });
        }
    } catch (error) {
        console.warn('Unable to synchronize PoC champions into the main app:', error?.message || error);
    }
}

function route() {
    const hash = window.location.hash || '#/champions';
    const [path, queryString] = hash.substring(2).split('?');
    const parts = path.split('/');
    
    console.log('Routing to:', path, 'parts:', parts);
    
    let page = null;
    let activeNav = 'champions';

    if (globalState.baseData) {
        applyComputedRegionTotals(globalState.baseData);
    }
    
    try {
        if (path === '' || path === 'champions' || path === 'poc-champions') {
            page = PoCEmbedPage({
                title: 'Champions',
                subtitle: 'Gestion des champions PoC dans la même application',
                src: 'pages/poc_champions_embed.html'
            });
            activeNav = 'champions';
        } else if (path === 'dashboard') {
            page = DashboardPage(globalState.appState, globalState.baseData);
            activeNav = 'dashboard';
        } else if (path === 'regions') {
            page = RegionsPage(globalState.appState, globalState.baseData);
            activeNav = 'regions';
        } else if (parts[0] === 'region' && parts[1]) {
            const regionName = decodeURIComponent(parts[1]);
            page = RegionDetailPage(globalState.appState, globalState.baseData, regionName, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'regions';
        } else if (parts[0] === 'champion' && parts[1] && parts[2]) {
            const regionName = decodeURIComponent(parts[1]);
            const championName = decodeURIComponent(parts[2]);
            page = ChampionDetailPage(globalState.appState, globalState.baseData, regionName, championName, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'constellation';
        } else if (path === 'constellation') {
            page = ChampionsPage(globalState.appState, globalState.baseData, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'constellation';
        } else if (path === 'add-champion') {
            page = AddChampionPage(globalState.appState, globalState.baseData, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'constellation';
        } else if (parts[0] === 'edit-champion' && parts[1] && parts[2]) {
            const regionName = decodeURIComponent(parts[1]);
            const championName = decodeURIComponent(parts[2]);
            page = EditChampionPage(globalState.appState, globalState.baseData, regionName, championName, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'constellation';
        } else if (path === 'export') {
            page = ExportImportPage(globalState.appState, globalState.baseData, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'export';
        } else if (path === 'help') {
            page = HelpRulesPage();
            activeNav = 'help';
        } else if (path === 'poc-relics') {
            page = PoCEmbedPage({
                title: 'PoC Reliques',
                subtitle: 'Catalogue des reliques PoC',
                src: 'pages/poc_relics_embed.html'
            });
            activeNav = 'poc-relics';
        } else {
            // 404
            page = document.createElement('div');
            page.innerHTML = '<h2>404 - Page not found</h2>';
        }
    } catch (e) {
        console.error('Routing error:', e);
        console.error('Stack:', e.stack);
        page = document.createElement('div');
        page.innerHTML = `<div class="alert alert-danger">Erreur: ${e.message}<br><pre>${e.stack}</pre></div>`;
    }
    
    console.log('Page to render:', page);
    render('#page-container', page);
    setActiveNav(activeNav);
    setMainNavOpen(false);
}

async function init() {
    const container = $('#page-container');
    
    if (!container) {
        console.error('Container #page-container not found');
        return;
    }
    
    container.innerHTML = '<div class="loading">⏳ Chargement...</div>';
    
    globalState.baseData = await loadBaseData();
    if (!globalState.baseData) {
        container.innerHTML = '<div class="alert alert-danger">❌ Erreur: Impossible de charger site_data.json<br>Assurez-vous d\'utiliser Live Server (HTTP) et que le fichier existe dans ./data/</div>';
        return;
    }
    
    globalState.appState = await initializeState();
    registerMainAppBridge();
    await syncPoCChampionsIntoMainApp();
    saveState(globalState.appState);
    setupResponsiveNav();
    
    window.addEventListener('hashchange', route);
    route();
    
    console.log('✅ App initialized');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
