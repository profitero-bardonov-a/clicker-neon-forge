import {
  getUser,
  handleAuthCallback,
  logout as identityLogout,
  oauthLogin,
  onAuthChange,
} from "https://esm.sh/@netlify/identity@0.2.0";
import { t } from "./i18n.js";
import { getOrCreateGuest } from "./guest.js";
import {
  captureStoredSession,
  ensureFreshAccessToken,
  pinAuthSession,
  restoreStoredSession,
} from "./score-store.js";
import { trackEvent } from "./analytics.js";

/**
 * @typedef {{ id: string, name?: string, email?: string, pictureUrl?: string | null, guest?: boolean }} AuthUser
 */

/**
 * @param {{
 *   onUser: (user: AuthUser | null) => void,
 *   loginBtn: HTMLButtonElement,
 *   menuLoginBtn: HTMLButtonElement,
 *   menuLoginSection: HTMLElement,
 *   logoutBtn: HTMLButtonElement,
 *   logoutConfirmBtn: HTMLButtonElement,
 *   logoutCancelBtn: HTMLButtonElement,
 *   logoutModal: HTMLElement,
 *   logoutBackdrop: HTMLElement,
 *   userEl: HTMLElement,
 *   nameEl: HTMLElement,
 *   avatarEl: HTMLImageElement,
 *   accountSection: HTMLElement,
 *   onOpenLogout?: () => void,
 * }} ui
 */
export async function initAuth(ui) {
  const {
    onUser,
    loginBtn,
    menuLoginBtn,
    menuLoginSection,
    logoutBtn,
    logoutConfirmBtn,
    logoutCancelBtn,
    logoutModal,
    logoutBackdrop,
    userEl,
    nameEl,
    avatarEl,
    accountSection,
    onOpenLogout,
  } = ui;

  /** @type {AuthUser | null} */
  let currentUser = null;
  /** @type {boolean} */
  let currentGoogle = false;

  /**
   * @param {import("@netlify/identity").User | null} raw
   * @returns {AuthUser | null}
   */
  function mapUser(raw) {
    if (!raw) return null;
    const meta = raw.userMetadata || {};
    return {
      id: raw.id,
      name:
        raw.name ||
        /** @type {string|undefined} */ (meta.full_name) ||
        /** @type {string|undefined} */ (meta.name) ||
        raw.email?.split("@")[0] ||
        t("player"),
      email: raw.email,
      pictureUrl:
        raw.pictureUrl ||
        /** @type {string|undefined} */ (meta.avatar_url) ||
        /** @type {string|undefined} */ (meta.picture) ||
        null,
    };
  }

  function closeLogoutModal() {
    logoutModal.hidden = true;
  }

  function openLogoutModal() {
    logoutModal.hidden = false;
    logoutConfirmBtn.focus();
  }

  /**
   * Google session when present, otherwise the stored guest nickname.
   * @param {AuthUser | null} googleUser
   */
  function render(googleUser) {
    const user = googleUser || getOrCreateGuest();
    const isGoogle = Boolean(googleUser);
    const same = currentUser?.id === user.id && currentGoogle === isGoogle;
    currentUser = user;
    currentGoogle = isGoogle;
    loginBtn.hidden = isGoogle;
    menuLoginBtn.hidden = isGoogle;
    menuLoginSection.hidden = isGoogle;
    logoutBtn.hidden = !isGoogle;
    accountSection.hidden = !isGoogle;
    userEl.hidden = false;
    nameEl.textContent = user.name || t("player");
    if (user.pictureUrl) {
      avatarEl.src = user.pictureUrl;
      avatarEl.hidden = false;
    } else {
      avatarEl.removeAttribute("src");
      avatarEl.hidden = true;
    }
    if (!same) onUser(user);
  }

  const startGoogleLogin = () => {
    trackEvent("sign_in_click", { method: "google" });
    oauthLogin("google");
  };

  loginBtn.addEventListener("click", startGoogleLogin);
  menuLoginBtn.addEventListener("click", () => {
    onOpenLogout?.();
    startGoogleLogin();
  });

  logoutBtn.addEventListener("click", () => {
    onOpenLogout?.();
    openLogoutModal();
  });

  logoutCancelBtn.addEventListener("click", closeLogoutModal);
  logoutBackdrop.addEventListener("click", closeLogoutModal);

  logoutConfirmBtn.addEventListener("click", async () => {
    closeLogoutModal();
    await identityLogout();
    render(null);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !logoutModal.hidden) closeLogoutModal();
  });

  /**
   * @param {string | null} snapshot
   * @returns {AuthUser | null}
   */
  function userFromSnapshot(snapshot) {
    if (!snapshot) return null;
    try {
      const data = JSON.parse(snapshot);
      if (!data || typeof data !== "object") return null;
      const meta =
        data.user_metadata && typeof data.user_metadata === "object"
          ? data.user_metadata
          : {};
      const email = typeof data.email === "string" ? data.email : undefined;
      const id =
        (typeof data.id === "string" && data.id) ||
        email ||
        (typeof meta.sub === "string" ? meta.sub : "");
      if (!id) return null;
      const name =
        (typeof data.name === "string" && data.name) ||
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        email?.split("@")[0] ||
        t("player");
      const pictureUrl =
        (typeof meta.avatar_url === "string" && meta.avatar_url) ||
        (typeof meta.picture === "string" && meta.picture) ||
        null;
      return { id, name, email, pictureUrl };
    } catch {
      return null;
    }
  }

  async function resolveUser() {
    let snapshot = captureStoredSession();
    pinAuthSession();
    try {
      await ensureFreshAccessToken();
    } catch (err) {
      console.warn("Token refresh failed", err);
    }
    snapshot = captureStoredSession() || snapshot;

    /** @type {AuthUser | null} */
    let user = null;
    // getUser() deletes the saved login when nf_jwt is missing. Skip that call
    // if the cookie could not be restored and fall back to localStorage.
    if (pinAuthSession() || !snapshot) {
      try {
        user = mapUser(await getUser());
      } catch (err) {
        console.warn("Identity unavailable", err);
      }
    }
    if (!user && snapshot) {
      restoreStoredSession(snapshot);
      user = userFromSnapshot(snapshot);
    }
    return user;
  }

  try {
    await handleAuthCallback();
  } catch (err) {
    console.warn("Auth callback failed", err);
  }

  onAuthChange((event) => {
    if (event === "logout") {
      render(null);
      return;
    }
    void resolveUser().then((user) => {
      if (user) render(user);
    });
  });

  render(await resolveUser());

  const restoreIfNeeded = () => {
    if (document.visibilityState === "hidden") return;
    if (currentUser) {
      void ensureFreshAccessToken();
      return;
    }
    if (!captureStoredSession()) return;
    void resolveUser().then((user) => {
      if (user) render(user);
    });
  };

  document.addEventListener("visibilitychange", restoreIfNeeded);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) restoreIfNeeded();
  });

  return {
    getUser: () => currentUser,
    refreshLabels: () => {
      if (currentUser) nameEl.textContent = currentUser.name || t("player");
    },
  };
}
