/** Tiny event bus for the global busy overlay (no imports, so it can be used anywhere without cycles). */
let busyCount = 0;
export function signalBusy(delta: 1 | -1) {
  busyCount = Math.max(0, busyCount + delta);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hf:busy', { detail: busyCount }));
}
export function signalNavigate() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('hf:navigate')); }
