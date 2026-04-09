import { FORCED_API_BASE } from './runtimeConfig.js';

const API_TIMEOUT_MS = 10000;
const DEFAULT_API_BASE = 'http://localhost:3000/api';

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
      const fromLocalStorage = window.localStorage.getItem('lor_api_base');
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

const API_BASES = detectApiBases();

function getApiBasesToTry() {
  if (!resolvedApiBase) {
    return API_BASES;
  }

  return uniqApiBases([resolvedApiBase, ...API_BASES]);
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
  return resolvedApiBase || API_BASES[0] || DEFAULT_API_BASE;
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
