const DEFAULT_API_BASE = 'http://localhost:3000/api';
const API_TIMEOUT_MS = 10000;

let warnShown = false;

function normalizeApiBase(base) {
  return String(base || '')
    .trim()
    .replace(/\/$/, '');
}

function detectApiBase() {
  const fromWindow = typeof window !== 'undefined' ? window.__LOR_API_BASE__ : '';
  if (fromWindow) return normalizeApiBase(fromWindow);

  if (typeof window !== 'undefined') {
    const fromLocalStorage = window.localStorage.getItem('lor_api_base');
    if (fromLocalStorage) return normalizeApiBase(fromLocalStorage);
  }

  return DEFAULT_API_BASE;
}

const API_BASE = detectApiBase();

function buildUrl(path) {
  const cleanedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanedPath}`;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

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

function logApiWarningOnce(error, context) {
  if (warnShown) return;
  warnShown = true;
  console.warn(`[API] ${context}: ${error.message}. Fallback local active.`);
}

export function getApiBase() {
  return API_BASE;
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
  await request('/inventory/import', {
    method: 'POST',
    body: { appState }
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
