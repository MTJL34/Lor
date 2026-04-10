import { FORCED_API_BASE } from './runtimeConfig.js';

const API_TIMEOUT_MS = 10000;
const DEFAULT_API_BASE = 'http://localhost:3000/api';
const API_BASE_STORAGE_KEY = 'lor_api_base';

let warnShown = false;
let resolvedApiBase = '';

function normalizeApiBase(base) {
  return String(base || '')
    .trim()
    .replace(/\/$/, '');
}

function buildApiUrl(apiBase, path) {
  const cleanedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${apiBase}${cleanedPath}`;
}

function uniqApiBases(bases) {
  return [...new Set(
    bases
      .map(normalizeApiBase)
      .filter(Boolean)
  )];
}

function shouldTryDedicatedApiPort(port) {
  return Boolean(port && port !== '3000' && port !== '80' && port !== '443');
}

function isLikelyFrontendPort(port) {
  return ['4173', '5173', '5500', '8000', '8080'].includes(String(port || ''));
}

function detectApiBases() {
  const forcedApiBase = normalizeApiBase(FORCED_API_BASE);
  if (forcedApiBase) {
    return [forcedApiBase];
  }

  const candidates = [];
  const fromWindow = typeof window !== 'undefined' ? window.__LOR_API_BASE__ : '';
  if (fromWindow) {
    candidates.push(fromWindow);
  }

  if (typeof window !== 'undefined') {
    try {
      const fromLocalStorage = window.localStorage.getItem(API_BASE_STORAGE_KEY);
      if (fromLocalStorage) {
        candidates.push(fromLocalStorage);
      }
    } catch (_) {
      // localStorage can be unavailable in some iframe/privacy contexts.
    }
  }

  if (typeof window !== 'undefined' && window.location) {
    const { hostname, origin, port, protocol } = window.location;

    if (protocol.startsWith('http')) {
      const sameOriginApi = `${origin}/api`;
      const sameHostDedicatedApi = shouldTryDedicatedApiPort(port)
        ? `${protocol}//${hostname}:3000/api`
        : '';

      // When the UI is served from a frontend/static port on another machine,
      // the API usually still lives on the same host but on port 3000.
      if (isLikelyFrontendPort(port) && sameHostDedicatedApi) {
        candidates.push(sameHostDedicatedApi, sameOriginApi);
      } else {
        candidates.push(sameOriginApi, sameHostDedicatedApi);
      }
    }
  }

  candidates.push(DEFAULT_API_BASE);
  return uniqApiBases(candidates);
}

function getApiBasesToTry() {
  const detectedApiBases = detectApiBases();
  if (!resolvedApiBase) {
    return detectedApiBases;
  }

  return uniqApiBases([resolvedApiBase, ...detectedApiBases]);
}

async function requestOnce(apiBase, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(apiBase, path), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const text = await response.text();
    let json = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch (error) {
        if (response.ok) {
          const parseError = new Error('Invalid JSON response');
          parseError.code = 'INVALID_JSON';
          parseError.status = response.status;
          parseError.cause = error;
          throw parseError;
        }
      }
    }

    if (!response.ok) {
      const message = json && json.message ? json.message : `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = json;
      throw error;
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetryWithAnotherApiBase(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  if (error instanceof TypeError) return true;
  if (error.code === 'INVALID_JSON') return true;
  return [404, 502, 503, 504].includes(Number(error.status));
}

async function request(path, options = {}) {
  let lastError = null;

  for (const apiBase of getApiBasesToTry()) {
    try {
      const response = await requestOnce(apiBase, path, options);
      resolvedApiBase = apiBase;
      return response;
    } catch (error) {
      lastError = error;
      if (!shouldRetryWithAnotherApiBase(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('API unavailable');
}

function logApiWarningOnce(error, context) {
  if (warnShown) return;
  warnShown = true;
  console.warn(`[API] ${context}: ${error.message}. Fallback local active.`);
}

export function getApiBase() {
  return resolvedApiBase || detectApiBases()[0] || DEFAULT_API_BASE;
}

export function getPreferredApiBase() {
  if (normalizeApiBase(FORCED_API_BASE)) {
    return normalizeApiBase(FORCED_API_BASE);
  }

  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return normalizeApiBase(window.localStorage.getItem(API_BASE_STORAGE_KEY));
  } catch (_) {
    return '';
  }
}

export function setPreferredApiBase(apiBase) {
  const normalizedApiBase = normalizeApiBase(apiBase);

  if (normalizeApiBase(FORCED_API_BASE)) {
    return normalizeApiBase(FORCED_API_BASE);
  }

  if (typeof window === 'undefined') {
    resolvedApiBase = normalizedApiBase;
    return normalizedApiBase;
  }

  try {
    if (normalizedApiBase) {
      window.localStorage.setItem(API_BASE_STORAGE_KEY, normalizedApiBase);
    } else {
      window.localStorage.removeItem(API_BASE_STORAGE_KEY);
    }
  } catch (_) {
    // Ignore localStorage failures and still try to use the in-memory value.
  }

  resolvedApiBase = normalizedApiBase;
  warnShown = false;
  return normalizedApiBase;
}

export function clearPreferredApiBase() {
  return setPreferredApiBase('');
}

export async function probeApiBase(apiBase) {
  const normalizedApiBase = normalizeApiBase(apiBase);

  if (!normalizedApiBase) {
    throw new Error('API base vide');
  }

  const response = await requestOnce(normalizedApiBase, '/site-data');
  return response && response.data ? response.data : null;
}

export async function fetchSiteDataFromApi() {
  const response = await request('/site-data');
  return response && response.data ? response.data : null;
}

export async function fetchAppStateFromApi() {
  const response = await request('/inventory/export');
  return response && response.appState ? response.appState : null;
}

export async function pushAppStateToApi(appState) {
  let nextAppState = appState;

  try {
    const currentAppState = await fetchAppStateFromApi();
    if (currentAppState && typeof currentAppState === 'object') {
      nextAppState = {
        ...currentAppState,
        ...(appState || {})
      };
    }
  } catch (_) {
    // If the fetch fails, fall back to the provided payload only.
  }

  await request('/inventory/import', {
    method: 'POST',
    body: { appState: nextAppState }
  });
  return true;
}

export async function withApiFallback(remoteFn, fallbackFn, contextLabel) {
  try {
    return await remoteFn();
  } catch (error) {
    logApiWarningOnce(error, contextLabel);
    return fallbackFn();
  }
}
