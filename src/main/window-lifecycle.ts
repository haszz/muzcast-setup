/** Electron keeps destroyed BrowserWindow objects alive in JS after a window is closed. */
export interface FocusableWindow {
  isDestroyed(): boolean
  isMinimized(): boolean
  restore(): void
  focus(): void
}
export function revealWindow(window: FocusableWindow | null, create: () => void, ready: boolean, quitting: boolean): void {
  if (!ready || quitting) return
  if (!window || window.isDestroyed()) { create(); return }
  if (window.isMinimized()) window.restore()
  window.focus()
}
