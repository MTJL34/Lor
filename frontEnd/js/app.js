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
        console.warn('API site-data unavailable, fallback to local file:', e.message);
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
                    // Apply custom or modified champions over base data
                    for (const customChamp of champions) {
                        const existingIndex = globalState.baseData.regions[regionName].champions.findIndex(
                            c => c.name === customChamp.name
                        );
                        if (existingIndex !== -1) {
                            globalState.baseData.regions[regionName].champions[existingIndex] = customChamp;
                        } else {
                            globalState.baseData.regions[regionName].champions.push(customChamp);
                        }
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

function route() {
    const hash = window.location.hash || '#/poc-champions';
    const [path, queryString] = hash.substring(2).split('?');
    const parts = path.split('/');
    
    console.log('Routing to:', path, 'parts:', parts);
    
    let page = null;
    let activeNav = 'poc-champions';

    if (globalState.baseData) {
        applyComputedRegionTotals(globalState.baseData);
    }
    
    try {
        if (path === '' || path === 'poc-champions') {
            page = PoCEmbedPage({
                title: 'PoC Champions',
                subtitle: 'Gestion des champions PoC dans la meme application',
                src: 'pages/poc_champions_embed.html'
            });
            activeNav = 'poc-champions';
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
            activeNav = 'champions';
        } else if (path === 'champions') {
            page = ChampionsPage(globalState.appState, globalState.baseData, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'champions';
        } else if (path === 'add-champion') {
            page = AddChampionPage(globalState.appState, globalState.baseData, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'champions';
        } else if (parts[0] === 'edit-champion' && parts[1] && parts[2]) {
            const regionName = decodeURIComponent(parts[1]);
            const championName = decodeURIComponent(parts[2]);
            page = EditChampionPage(globalState.appState, globalState.baseData, regionName, championName, (newState) => {
                globalState.appState = newState;
                saveState(globalState.appState);
                route();
            });
            activeNav = 'champions';
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


