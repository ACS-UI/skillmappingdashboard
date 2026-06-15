import adobeImsConfig from './adobe-ims-config.js';

const STORAGE_KEYS = {
  authRequest: 'adobe-ims.auth.request',
  session: 'adobe-ims.auth.session',
};

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function randomString(length = 64) {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return toBase64Url(bytes).slice(0, length);
}

async function sha256(value) {
  const buffer = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(digest);
}

async function createPkcePair() {
  const codeVerifier = randomString(96);
  const codeChallenge = toBase64Url(await sha256(codeVerifier));
  return { codeVerifier, codeChallenge };
}

function saveJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readJson(key) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function removeStorage(key) {
  window.localStorage.removeItem(key);
}

function getStoredRequest() {
  return readJson(STORAGE_KEYS.authRequest);
}

function saveStoredRequest(value) {
  saveJson(STORAGE_KEYS.authRequest, value);
}

function clearStoredRequest() {
  removeStorage(STORAGE_KEYS.authRequest);
}

function getStoredSession() {
  return readJson(STORAGE_KEYS.session);
}

function saveStoredSession(value) {
  saveJson(STORAGE_KEYS.session, value);
}

function clearStoredSession() {
  removeStorage(STORAGE_KEYS.session);
}

function normalizeTokenResponse(tokenResponse, currentSession = null) {
  const expiresAt = tokenResponse.expires_in
    ? Date.now() + (tokenResponse.expires_in * 1000)
    : currentSession?.expiresAt || null;

  return {
    accessToken: tokenResponse.access_token || currentSession?.accessToken || '',
    refreshToken: tokenResponse.refresh_token || currentSession?.refreshToken || '',
    idToken: tokenResponse.id_token || currentSession?.idToken || '',
    tokenType: tokenResponse.token_type || currentSession?.tokenType || 'bearer',
    scope: tokenResponse.scope || currentSession?.scope || adobeImsConfig.scopes.join(','),
    expiresAt,
  };
}

function buildAuthorizeUrl({ state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: adobeImsConfig.clientId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: adobeImsConfig.redirectUri,
    scope: adobeImsConfig.scopes.join(','),
    state,
    response_type: 'code',
  });
  return `${adobeImsConfig.authorizationEndpoint}?${params.toString()}`;
}

async function postTokenRequest(body) {
  const url = `${adobeImsConfig.tokenEndpoint}?client_id=${encodeURIComponent(adobeImsConfig.clientId)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!response.ok) {
    throw new Error(`Adobe IMS token request failed with status ${response.status}`);
  }
  return response.json();
}

export function getSession() {
  return getStoredSession();
}

export function clearSession() {
  clearStoredSession();
  clearStoredRequest();
}

export async function login(originalUri) {
  const state = randomString(48);
  const { codeVerifier, codeChallenge } = await createPkcePair();
  saveStoredRequest({ state, codeVerifier, originalUri });
  window.location.assign(buildAuthorizeUrl({ state, codeChallenge }));
}

export async function handleRedirectCallback(callbackUrl = window.location.href) {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedRequest = getStoredRequest();

  if (!code || !state || !storedRequest) {
    throw new Error('Missing Adobe IMS callback parameters.');
  }
  if (storedRequest.state !== state) {
    throw new Error('Adobe IMS callback state validation failed.');
  }

  const tokenResponse = await postTokenRequest({
    code,
    grant_type: 'authorization_code',
    code_verifier: storedRequest.codeVerifier,
  });

  const session = normalizeTokenResponse(tokenResponse);
  saveStoredSession(session);
  clearStoredRequest();

  return { session, originalUri: storedRequest.originalUri || '/' };
}

export async function refreshSession() {
  const session = getStoredSession();
  if (!session?.refreshToken) {
    throw new Error('No Adobe IMS refresh token available.');
  }
  const tokenResponse = await postTokenRequest({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  });
  const nextSession = normalizeTokenResponse(tokenResponse, session);
  saveStoredSession(nextSession);
  return nextSession;
}

export async function isAuthenticated() {
  const session = getStoredSession();
  if (!session?.accessToken) return false;

  if (!session.expiresAt || Date.now() < session.expiresAt) return true;

  if (!session.refreshToken) {
    clearStoredSession();
    return false;
  }

  try {
    await refreshSession();
    return true;
  } catch {
    clearStoredSession();
    return false;
  }
}

export async function getUserProfile() {
  const authenticated = await isAuthenticated();
  if (!authenticated) return null;

  const session = getStoredSession();
  const url = `${adobeImsConfig.userInfoEndpoint}?client_id=${encodeURIComponent(adobeImsConfig.clientId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Adobe IMS user info request failed with status ${response.status}`);
  }
  return response.json();
}

export async function logout() {
  const session = getStoredSession();
  clearSession();

  if (!session?.accessToken) {
    window.location.assign(adobeImsConfig.postLogoutRedirectUri);
    return;
  }

  const revokeUrl = `${adobeImsConfig.revocationEndpoint}?client_id=${encodeURIComponent(adobeImsConfig.clientId)}`;
  try {
    await fetch(revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: session.accessToken }).toString(),
    });
  } catch { /* revocation is best-effort */ }

  window.location.assign(adobeImsConfig.postLogoutRedirectUri);
}
