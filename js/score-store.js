import { getStoredGuest } from "./guest.js";

const STORAGE_KEY = "neon-forge-clicks";
const SYNC_DEBOUNCE_MS = 200;
const GOTRUE_KEY = "gotrue.user";
/** Cookies over ~3.5KB often break Netlify Functions (platform Internal Error). */
const MAX_COOKIE_TOKEN_CHARS = 3200;
/** Refresh a minute before JWT exp. */
const REFRESH_SKEW_SEC = 60;
/** Keep the auth gate cookie across browser and PWA restarts. */
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

/**
 * @param {string} name
 * @param {string} value
 */
function writeAuthCookie(name, value) {
  const secure =
    location.protocol === "https:" || location.hostname === "localhost" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; samesite=lax${secure}`;
}

/**
 * @returns {Record<string, unknown> | null}
 */
function readGotrue() {
  try {
    const raw = localStorage.getItem(GOTRUE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} data
 */
function writeGotrue(data) {
  localStorage.setItem(GOTRUE_KEY, JSON.stringify(data));
}

/**
 * @returns {string | null}
 */
function getAccessToken() {
  const data = readGotrue();
  if (!data) return null;
  const token = data.token;
  if (token && typeof token === "object") {
    const t = /** @type {Record<string, unknown>} */ (token);
    if (typeof t.access_token === "string") return t.access_token;
    if (typeof t.accessToken === "string") return t.accessToken;
  }
  if (typeof data.access_token === "string") return data.access_token;
  return null;
}

/**
 * @returns {string | null}
 */
function getRefreshToken() {
  const data = readGotrue();
  if (!data) return null;
  const token = data.token;
  if (token && typeof token === "object") {
    const t = /** @type {Record<string, unknown>} */ (token);
    if (typeof t.refresh_token === "string") return t.refresh_token;
    if (typeof t.refreshToken === "string") return t.refreshToken;
  }
  if (typeof data.refresh_token === "string") return data.refresh_token;
  const match = document.cookie.match(/(?:^|; )nf_refresh=([^;]*)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * @param {string} token
 * @returns {number | null} exp unix seconds
 */
function jwtExp(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(pad));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} accessToken
 * @param {string} [refreshToken]
 */
function persistTokens(accessToken, refreshToken) {
  const data = readGotrue() || {};
  const prev =
    data.token && typeof data.token === "object"
      ? /** @type {Record<string, unknown>} */ (data.token)
      : {};
  const exp = jwtExp(accessToken);
  const expiresIn =
    exp != null ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 3600;
  data.token = {
    ...prev,
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: exp ?? Math.floor(Date.now() / 1000) + expiresIn,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  };
  writeGotrue(data);
  pinAuthSession();
}

/**
 * @netlify/identity getUser() drops the saved login when nf_jwt is missing.
 * Session cookies vanish when the game is closed; a huge Google JWT must not
 * be stored in a cookie either. Presence of a small persistent cookie is enough.
 * @returns {boolean} true when a stored session was pinned into cookies
 */
export function pinAuthSession() {
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (!access && !refresh) return false;
  const jwtValue = access && access.length <= MAX_COOKIE_TOKEN_CHARS ? access : "1";
  writeAuthCookie("nf_jwt", jwtValue);
  if (refresh && refresh.length <= MAX_COOKIE_TOKEN_CHARS) {
    writeAuthCookie("nf_refresh", refresh);
  }
  return document.cookie.split(";").some((part) => part.trim().startsWith("nf_jwt="));
}

/**
 * @returns {string | null}
 */
export function captureStoredSession() {
  try {
    return localStorage.getItem(GOTRUE_KEY);
  } catch {
    return null;
  }
}

/**
 * Put back a session if Identity cleared it because the cookie was missing.
 * @param {string | null} snapshot
 */
export function restoreStoredSession(snapshot) {
  if (!snapshot) return;
  try {
    if (!localStorage.getItem(GOTRUE_KEY)) localStorage.setItem(GOTRUE_KEY, snapshot);
  } catch {
    // ignore quota / private-mode failures
  }
  pinAuthSession();
}

/**
 * GoTrue refresh — Identity UI can stay "logged in" on an expired JWT.
 * @returns {Promise<string | null>}
 */
export async function ensureFreshAccessToken() {
  const current = getAccessToken();
  if (current) {
    const exp = jwtExp(current);
    const now = Math.floor(Date.now() / 1000);
    if (exp != null && exp > now + REFRESH_SKEW_SEC) return current;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) return current;

  try {
    const res = await fetch("/.netlify/identity/token", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      console.warn("Token refresh failed", res.status);
      return current;
    }
    const data = await res.json();
    const accessToken =
      typeof data?.access_token === "string" ? data.access_token : null;
    if (!accessToken) return current;
    const nextRefresh =
      typeof data?.refresh_token === "string" ? data.refresh_token : refreshToken;
    persistTokens(accessToken, nextRefresh);
    return accessToken;
  } catch (err) {
    console.warn("Token refresh error", err);
    return current;
  }
}

/**
 * Local score, synced for the guest nickname and for a Google account.
 */
export class ScoreStore {
  /**
   * @param {{ onChange?: (score: number) => void }} [opts]
   */
  constructor(opts = {}) {
    this.onChange = opts.onChange;
    this.score = this._readLocal();
    /** @type {null | { id: string, name?: string, pictureUrl?: string | null, guest?: boolean }} */
    this.user = null;
    /** Guest row to drop from the board after a Google login takes the score. */
    this._retireGuestId = "";
    this._syncTimer = 0;
    this._syncing = false;
    this._pending = false;
  }

  _readLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) ? n : 0;
  }

  _writeLocal(score) {
    localStorage.setItem(STORAGE_KEY, String(score));
  }

  /**
   * @param {number} score
   * @param {{ sync?: boolean }} [opts]
   */
  setScore(score, opts = {}) {
    const next = Math.floor(Number(score));
    this.score = Number.isFinite(next) ? next : 0;
    this._writeLocal(this.score);
    this.onChange?.(this.score);
    if (opts.sync !== false && this.user) this.scheduleSync();
  }

  increment() {
    this.setScore(this.score + 1);
  }

  decrement() {
    this.setScore(this.score - 1);
  }

  /**
   * @param {number} delta
   */
  add(delta) {
    const n = Math.floor(Number(delta));
    if (!Number.isFinite(n) || n === 0) return;
    this.setScore(this.score + n);
  }

  scheduleSync() {
    if (!this.user) return;
    if (new URLSearchParams(location.search).has("demo")) return;
    clearTimeout(this._syncTimer);
    this._syncTimer = window.setTimeout(() => {
      void this.flush();
    }, SYNC_DEBOUNCE_MS);
  }

  /**
   * Token goes in JSON body only — Cookie/Authorization with a huge Google
   * avatar JWT crashes Netlify with platform Internal Error.
   * @param {Record<string, unknown>} payload
   */
  async _scoreRequest(payload) {
    /** @type {Record<string, unknown>} */
    const body = { ...payload };
    if (this.user?.guest) {
      body.guestId = this.user.id;
      body.name = this.user.name;
      body.pictureUrl = this.user.pictureUrl || null;
    } else {
      const accessToken = await ensureFreshAccessToken();
      if (!accessToken) {
        return { ok: false, status: 401, data: null, text: "no_token" };
      }
      body.accessToken = accessToken;
      if (this._retireGuestId) body.retireGuestId = this._retireGuestId;
    }
    const res = await fetch("/.netlify/functions/score", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // plain-text platform errors
    }
    return { ok: res.ok, status: res.status, data, text };
  }

  async flush() {
    if (!this.user) return;
    if (this._syncing) {
      this._pending = true;
      return;
    }
    this._syncing = true;
    try {
      const res = await this._scoreRequest({
        op: "set",
        clicks: this.score,
        name: this.user.name || undefined,
      });
      if (res.ok) {
        this._retireGuestId = "";
        const server = Math.floor(Number(res.data?.clicks));
        if (Number.isFinite(server)) {
          this.score = server;
          this._writeLocal(server);
          this.onChange?.(server);
        }
      } else {
        console.warn("Score sync failed", res.status, (res.text || "").slice(0, 300));
      }
    } catch (err) {
      console.warn("Score sync error", err);
    } finally {
      this._syncing = false;
      if (this._pending) {
        this._pending = false;
        this.scheduleSync();
      }
    }
  }

  /**
   * @param {{ id: string, name?: string, pictureUrl?: string | null, guest?: boolean }} user
   */
  async attachUser(user) {
    this.user = user;
    this._retireGuestId = user.guest ? "" : getStoredGuest()?.id || "";
    try {
      const res = await this._scoreRequest({ op: "get" });
      if (res.ok) {
        const server = Math.floor(Number(res.data?.clicks) || 0);
        this.setScore(Math.max(this.score, server), { sync: false });
        await this.flush();
        return;
      }
      console.warn("Score load failed", res.status);
    } catch (err) {
      console.warn("Score load error", err);
    }
    await this.flush();
  }

  detachUser() {
    clearTimeout(this._syncTimer);
    this.user = null;
    this._retireGuestId = "";
  }
}
