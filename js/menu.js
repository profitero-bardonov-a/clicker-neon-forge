/**
 * Burger menu open/close.
 * @param {{
 *   root: HTMLElement,
 *   button: HTMLButtonElement,
 *   closeBtn: HTMLButtonElement,
 *   backdrop: HTMLElement,
 * }} ui
 */
export function initMenu(ui) {
  const { root, button, closeBtn, backdrop } = ui;

  function open() {
    root.hidden = false;
    button.setAttribute("aria-expanded", "true");
    button.classList.add("is-open");
    document.body.classList.add("is-menu-open");
  }

  function close() {
    root.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.classList.remove("is-open");
    document.body.classList.remove("is-menu-open");
  }

  function toggle() {
    if (root.hidden) open();
    else close();
  }

  button.addEventListener("click", toggle);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !root.hidden) close();
  });

  return { open, close, toggle };
}
