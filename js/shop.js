/**
 * Forge Shop panel — menu-driven cosmetics store (visual-only).
 */
import { onLocaleChange, t } from "./i18n.js";
import { trackEvent } from "./analytics.js";
import {
  SHOP_CATALOG,
  purchaseCosmetic,
  equipCosmetic,
  readCosmetics,
  applyRimToCubes,
  applySparksToParticles,
} from "./cosmetics.js";

const TOAST_MS = 2200;

/**
 * @param {{
 *   root: HTMLElement,
 *   listEl: HTMLElement,
 *   closeBtn: HTMLButtonElement,
 *   backdrop: HTMLElement,
 *   toastRoot: HTMLElement,
 *   toastText: HTMLElement,
 *   openBtn: HTMLButtonElement,
 *   scores: { score: number, add: (n: number) => void },
 *   cubes: Iterable<import("./cube.js").Cube>,
 *   particles: import("./particles.js").ParticleSystem,
 *   enabled?: boolean,
 *   readOnly?: boolean,
 *   onOpen?: () => void,
 *   onClose?: () => void,
 *   onScoreChange?: () => void,
 * }} opts
 */
export function initShop(opts) {
  const {
    root,
    listEl,
    closeBtn,
    backdrop,
    toastRoot,
    toastText,
    openBtn,
    scores,
    cubes,
    particles,
    enabled = true,
    readOnly = false,
    onOpen,
    onClose,
    onScoreChange,
  } = opts;

  let toastTimer = 0;
  openBtn.hidden = !enabled;

  function applyVisuals(state = readCosmetics()) {
    applyRimToCubes(cubes, state.equipped.rim);
    applySparksToParticles(particles, state.equipped.sparks);
  }

  /**
   * @param {string} key
   * @param {Record<string, string | number>} [vars]
   */
  function showToast(key, vars) {
    toastText.textContent = t(key, vars);
    toastRoot.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastTimer = 0;
      toastRoot.hidden = true;
    }, TOAST_MS);
  }

  function renderList() {
    const state = readCosmetics();
    listEl.replaceChildren();
    for (const sku of SHOP_CATALOG) {
      const owned = state.owned.includes(sku.id);
      const equipped =
        (sku.slot === "rim" && state.equipped.rim === sku.id) ||
        (sku.slot === "sparks" && state.equipped.sparks === sku.id);

      const row = document.createElement("div");
      row.className = "shop__item";
      row.setAttribute("data-item", sku.id);

      const meta = document.createElement("div");
      meta.className = "shop__meta";
      const name = document.createElement("div");
      name.className = "shop__name";
      name.textContent = t(`shopItem_${sku.id}`);
      const price = document.createElement("div");
      price.className = "shop__price";
      price.textContent = owned ? t("shopOwned") : t("shopPrice", { n: sku.price });
      meta.append(name, price);

      const actions = document.createElement("div");
      actions.className = "shop__actions";

      if (!owned) {
        const buy = document.createElement("button");
        buy.type = "button";
        buy.className = "shop__btn shop__btn--buy";
        buy.textContent = t("shopBuy");
        buy.disabled = readOnly || scores.score < sku.price;
        buy.addEventListener("click", () => {
          const result = purchaseCosmetic({ itemId: sku.id, scores, readOnly });
          if (!result.ok) {
            if (result.reason === "broke") showToast("shopNeedClicks", { n: sku.price });
            return;
          }
          onScoreChange?.();
          applyVisuals(result.state);
          showToast("shopBought", { name: t(`shopItem_${sku.id}`) });
          renderList();
        });
        actions.append(buy);
      } else {
        const equip = document.createElement("button");
        equip.type = "button";
        equip.className = "shop__btn";
        if (equipped) {
          equip.textContent = t("shopEquipped");
          equip.disabled = true;
          equip.classList.add("is-equipped");
        } else {
          equip.textContent = t("shopEquip");
          equip.disabled = readOnly;
          equip.addEventListener("click", () => {
            const next = equipCosmetic(sku.slot, sku.id);
            applyVisuals(next);
            renderList();
          });
        }
        actions.append(equip);
      }

      row.append(meta, actions);
      listEl.append(row);
    }
  }

  function open() {
    if (!enabled) return;
    root.hidden = false;
    document.body.classList.add("is-shop-open");
    trackEvent("shop_open");
    renderList();
    onOpen?.();
    closeBtn.focus();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove("is-shop-open");
    onClose?.();
  }

  openBtn.addEventListener("click", () => {
    open();
  });
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !root.hidden) close();
  });

  onLocaleChange(() => {
    if (!root.hidden) renderList();
    if (!toastRoot.hidden) {
      // leave current toast text; next toast will re-i18n
    }
  });

  applyVisuals();

  return {
    open,
    close,
    isOpen: () => !root.hidden,
    renderList,
    applyVisuals,
    refreshOpenBtn() {
      openBtn.hidden = !enabled;
    },
  };
}
