/**
 * Client-side conversion events for the TEGO pixel (`tego.js`, loaded in the
 * root layout with `data-slug="house-of-track"`).
 *
 * Convention shared across TEGO client sites:
 *  - `form_submit` fires ONLY after the server confirmed the submission, once
 *    per submission, with a stable kebab-case `formId` and a human `label`.
 *  - NEVER put PII (names, emails, phones, free text) in the event data.
 *  - Never fires on /admin.
 *  - Primary CTAs carry `data-tego-cta="<name>"`; tego.js sends those clicks
 *    itself, so no listeners here. tel:/mailto: links are auto-tracked too.
 *
 * Optional-chained on purpose: an ad blocker or a slow script load must never
 * break a form that already succeeded.
 */
declare global {
  interface Window {
    tego?: (event: string, data?: Record<string, unknown>) => void;
  }
}

/**
 * Returns true only if the event was actually handed to `window.tego` — the
 * real pixel, or the queue stub from the root layout that tego.js drains when
 * it loads.
 */
export function trackFormSubmit(formId: string, label: string): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname.startsWith("/admin")) return false;
  if (typeof window.tego !== "function") return false;
  try {
    window.tego("form_submit", { formId, label });
    return true;
  } catch {
    /* analytics must never break the page */
    return false;
  }
}

/**
 * Same event, but at most once per `onceKey` in this browser tab — for a
 * confirmation page that a refresh (or Back) would otherwise re-count, like
 * /success?session_id=…. The key is stored locally only; it is never sent.
 * It is written only AFTER the call reached `window.tego`, so a render where
 * the pixel (and stub) were missing doesn't burn the key and the next render
 * can still count it.
 */
export function trackFormSubmitOnce(
  formId: string,
  label: string,
  onceKey: string,
): void {
  if (typeof window === "undefined") return;
  const key = `tego:form_submit:${formId}:${onceKey}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
  } catch {
    /* storage blocked — fall through and count it once for this render */
  }
  if (!trackFormSubmit(formId, label)) return;
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* storage blocked — nothing to remember it in */
  }
}
