export const COMMAND_PALETTE_EVENT = 'dotlearn:open-command-palette';

export const openCommandPalette = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
};
