/**
 * Public leaderboard panel — collapsed peek + expand toggle.
 */
import { onLocaleChange, t } from "./i18n.js";
import {
  isLocalDevHost,
  LEADERBOARD_STUBS,
  LEADERBOARD_STUBS_TOTAL,
} from "./leaderboard-stubs.js";
import { filterPublicLeaders } from "./leaderboard-rules.js";
import { trackEvent } from "./analytics.js";

export class Leaderboard {
  /**
   * @param {{
   *   root: HTMLElement,
   *   listEl: HTMLElement,
   *   statusEl: HTMLElement,
   *   countEl?: HTMLElement | null,
   *   toggleBtn: HTMLButtonElement,
   *   onExpanded?: (expanded: boolean) => void,
   * }} ui
   */
  constructor(ui) {
    this.root = ui.root;
    this.listEl = ui.listEl;
    this.statusEl = ui.statusEl;
    this.countEl = ui.countEl || null;
    this.toggleBtn = ui.toggleBtn;
    this.onExpanded = ui.onExpanded || null;
    this._timer = 0;
    this._expanded = false;
    /** @type {Array<{ rank: number, name: string, avatarUrl: string | null, clicks: number, online?: boolean }>} */
    this._leaders = [];
    /** Engaged scorers (clicks ≥ 1) — used for hygiene metrics. */
    this._total = 0;
    /** All score rows including zeros/negatives — UI denominator when larger. */
    this._totalPlayers = 0;
    this._offline = false;
    this._usingStubs = false;

    this.toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._spawnBlast(e.clientX, e.clientY);
      this.setExpanded(!this._expanded);
    });

    onLocaleChange(() => {
      if (this._usingStubs) {
        this.statusEl.textContent = "DEV";
      } else if (this._offline) {
        this.statusEl.textContent = t("offline");
      }
      this._syncToggleLabel();
      this._render(this._leaders);
    });

    this._syncExpandedDom();
  }

  start() {
    if (isLocalDevHost()) {
      this._applyStubs();
    }
    void this.refresh();
    this._timer = window.setInterval(() => {
      void this.refresh();
    }, 15000);
  }

  stop() {
    clearInterval(this._timer);
  }

  /**
   * @param {boolean} expanded
   */
  setExpanded(expanded) {
    if (this._expanded === expanded) return;
    this._expanded = expanded;
    this._syncExpandedDom();
    this.onExpanded?.(expanded);
    if (expanded) trackEvent("leaderboard_expand");
  }

  /**
   * Orange horizontal shockwave from the press point.
   * @param {number} clientX
   * @param {number} clientY
   */
  _spawnBlast(clientX, clientY) {
    const blast = document.createElement("div");
    blast.className = "lb-blast";
    blast.style.left = `${clientX}px`;
    blast.style.top = `${clientY}px`;
    blast.setAttribute("aria-hidden", "true");

    const core = document.createElement("span");
    core.className = "lb-blast__core";
    const wave = document.createElement("span");
    wave.className = "lb-blast__wave";
    const left = document.createElement("span");
    left.className = "lb-blast__front lb-blast__front--left";
    const right = document.createElement("span");
    right.className = "lb-blast__front lb-blast__front--right";

    blast.append(core, wave, left, right);
    document.body.appendChild(blast);

    const cleanup = () => blast.remove();
    wave.addEventListener("animationend", cleanup, { once: true });
    window.setTimeout(cleanup, 650);
  }

  _applyStubs() {
    this._usingStubs = true;
    this._offline = false;
    // Stubs may include deliberate junk rows to exercise hygiene locally.
    this._leaders = filterPublicLeaders([...LEADERBOARD_STUBS]);
    this._total = this._leaders.length;
    this._totalPlayers = Math.max(this._leaders.length, LEADERBOARD_STUBS_TOTAL);
    this._render(this._leaders);
    this.statusEl.textContent = "DEV";
  }

  /**
   * Visible page size / overall player pool (not faked).
   * Prefers API `totalPlayers` (all rows); falls back to engaged `total`.
   * @param {number} shown
   * @param {number} totalPlayers
   */
  _setCount(shown, totalPlayers) {
    if (!this.countEl) return;
    const s = Math.max(0, Math.floor(Number(shown) || 0));
    const total = Math.max(s, Math.floor(Number(totalPlayers) || 0));
    if (total <= 0 && s <= 0) {
      this.countEl.hidden = true;
      this.countEl.textContent = "";
      this.countEl.removeAttribute("title");
      this.countEl.removeAttribute("aria-label");
      return;
    }
    this.countEl.hidden = false;
    this.countEl.textContent = `${s} / ${total}`;
    const label = t("leadersCountLabel", { shown: s, total });
    this.countEl.title = label;
    this.countEl.setAttribute("aria-label", label);
  }

  _syncToggleLabel() {
    const key = this._expanded ? "leadersCollapse" : "leadersExpand";
    this.toggleBtn.setAttribute("aria-label", t(key));
    this.toggleBtn.setAttribute("data-i18n-aria", key);
  }

  _syncExpandedDom() {
    this.root.classList.toggle("is-expanded", this._expanded);
    this.toggleBtn.setAttribute("aria-expanded", this._expanded ? "true" : "false");
    this._syncToggleLabel();
  }

  async refresh() {
    this.statusEl.textContent = t("updating");
    try {
      const res = await fetch("/.netlify/functions/leaderboard", {
        credentials: "omit",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._offline = false;
      this._usingStubs = false;
      // Defense in depth if an older function build still returns ≤0 rows.
      this._leaders = filterPublicLeaders(Array.isArray(data.leaders) ? data.leaders : []);
      const total = Math.floor(Number(data.total));
      const totalPlayers = Math.floor(Number(data.totalPlayers));
      this._total = Number.isFinite(total)
        ? Math.max(this._leaders.length, total)
        : this._leaders.length;
      // Denominator: all players when API provides it; else engaged total (never invent).
      this._totalPlayers = Number.isFinite(totalPlayers)
        ? Math.max(this._leaders.length, totalPlayers)
        : this._total;
      this._render(this._leaders);
      this.statusEl.textContent = "";
    } catch {
      if (isLocalDevHost()) {
        this._applyStubs();
        return;
      }
      this._offline = true;
      this._usingStubs = false;
      this.statusEl.textContent = t("offline");
    }
  }

  /**
   * @param {Array<{ rank: number, name: string, avatarUrl: string | null, clicks: number, online?: boolean }>} leaders
   */
  _render(leaders) {
    this.listEl.innerHTML = "";
    this.root.classList.toggle("is-empty", leaders.length === 0);
    this.root.classList.toggle("is-short", leaders.length > 0 && leaders.length <= 2);
    this._setCount(leaders.length, this._totalPlayers || this._total);

    if (!leaders.length) {
      const empty = document.createElement("li");
      empty.className = "leaderboard__empty";
      empty.textContent = t("emptyLeaders");
      this.listEl.appendChild(empty);
      return;
    }

    for (const row of leaders) {
      const li = document.createElement("li");
      li.className = "leaderboard__row";

      const rank = document.createElement("span");
      rank.className = "leaderboard__rank";
      rank.textContent = String(row.rank);

      const who = document.createElement("div");
      who.className = "leaderboard__who";

      if (row.avatarUrl) {
        const img = document.createElement("img");
        img.className = "leaderboard__avatar";
        img.src = row.avatarUrl;
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        who.appendChild(img);
      } else {
        const stub = document.createElement("span");
        stub.className = "leaderboard__avatar leaderboard__avatar--stub";
        stub.textContent = (row.name || "?").slice(0, 1).toUpperCase();
        who.appendChild(stub);
      }

      const identity = document.createElement("div");
      identity.className = "leaderboard__identity";

      const name = document.createElement("span");
      name.className = "leaderboard__name";
      name.textContent = row.name || t("player");
      identity.appendChild(name);

      if (row.online) {
        const badge = document.createElement("span");
        badge.className = "leaderboard__online";
        badge.textContent = t("online");
        identity.appendChild(badge);
      }

      who.appendChild(identity);

      const clicks = document.createElement("span");
      clicks.className = "leaderboard__clicks";
      clicks.textContent = String(row.clicks);

      li.append(rank, who, clicks);
      this.listEl.appendChild(li);
    }
  }
}
