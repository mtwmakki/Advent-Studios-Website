/**
 * Rolling text: each [data-roll] label holds its text twice, stacked. On hover/focus of the
 * surrounding link or button, both copies slide up one line (CSS in global.css), so the copy
 * below rolls into place. The second copy is aria-hidden so the accessible name is unchanged.
 */
export function initRollingText(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-roll]').forEach((el) => {
    if (el.querySelector(':scope > [aria-hidden="true"]')) return;
    const text = el.textContent?.trim() ?? '';
    el.textContent = '';
    const main = document.createElement('span');
    main.textContent = text;
    const copy = document.createElement('span');
    copy.textContent = text;
    copy.setAttribute('aria-hidden', 'true');
    el.append(main, copy);
  });
}
