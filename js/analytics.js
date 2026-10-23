/**
 * Thin GA4 wrapper — never throws into gameplay.
 * Measurement ID is configured in index.html (gtag).
 *
 * @param {string} name
 * @param {Record<string, string | number | boolean | undefined>} [params]
 */
export function trackEvent(name, params = {}) {
  try {
    const gtag = /** @type {undefined | ((...args: unknown[]) => void)} */ (
      /** @type {any} */ (globalThis).gtag
    );
    if (typeof gtag !== "function") return;
    gtag("event", name, params);
  } catch {
    // ignore
  }
}
