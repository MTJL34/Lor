// LocalStorage management

import {
    fetchAppStateFromApi,
    pushAppStateToApi,
    withApiFallback
} from './api.js';

const STORAGE_KEY = 'lor_calc_state_v1';
let syncTimer = null;
let pendingState = null;

function loadStateFromLocalStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const state = JSON.parse(raw);
        return state;
    } catch (e) {
        console.error('Error loading state:', e);
        return null;
    }
}

function saveStateToLocalStorage(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (e) {
        console.error('Error saving state:', e);
        return false;
    }
}

function scheduleRemoteSync(state) {
    pendingState = state;
    if (syncTimer) {
        clearTimeout(syncTimer);
    }

    syncTimer = setTimeout(async () => {
        syncTimer = null;
        if (!pendingState) return;
        const toSync = pendingState;
        pendingState = null;

        try {
            await pushAppStateToApi(toSync);
        } catch (e) {
            console.warn('[Storage] remote sync failed:', e.message);
        }
    }, 350);
}

export async function loadState() {
    const localFallback = () => loadStateFromLocalStorage();

    const remoteState = await withApiFallback(
        async () => fetchAppStateFromApi(),
        async () => localFallback(),
        'loadState'
    );

    if (remoteState) {
        saveStateToLocalStorage(remoteState);
        return remoteState;
    }

    return localFallback();
}

export function saveState(state) {
    const localOk = saveStateToLocalStorage(state);
    if (localOk) {
        scheduleRemoteSync(state);
    }
    return localOk;
}

export function clearState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        pendingState = null;
        if (syncTimer) {
            clearTimeout(syncTimer);
            syncTimer = null;
        }
        return true;
    } catch (e) {
        console.error('Error clearing state:', e);
        return false;
    }
}
