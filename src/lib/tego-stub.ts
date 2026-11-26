/**
 * Inline pre-load stub for the TEGO pixel, rendered in <head> ahead of the
 * deferred tego.js. A deferred script can run AFTER React hydrates, so a mount
 * effect that calls `window.tego?.()` (the /success?session_id=… order event)
 * could find nothing there and the event was lost. With the stub, early calls
 * queue on `window.tego.q`, and the deployed tego.js drains that queue once it
 * boots (it checks `.loaded`, which the stub does not set). Same snippet
 * tego.js documents in its own header.
 */
export const TEGO_QUEUE_STUB =
  "window.tego=window.tego||function(){(window.tego.q=window.tego.q||[]).push(arguments)}";
