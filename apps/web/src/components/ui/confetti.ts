import confetti from 'canvas-confetti';

const FALLBACK_COLORS = ['rgb(0 113 227)', 'rgb(88 86 214)', 'rgb(0 160 138)', 'rgb(30 158 76)'];

const readPaletteColors = (): string[] => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return FALLBACK_COLORS;
  const styles = getComputedStyle(document.documentElement);
  const colors = ['--accent-1', '--accent-2', '--accent-3', '--ok']
    .map((token) => styles.getPropertyValue(token).trim())
    .filter((triple) => triple.length > 0)
    .map((triple) => `rgb(${triple})`);
  return colors.length > 0 ? colors : FALLBACK_COLORS;
};

export const burstConfetti = (origin?: { x?: number; y?: number }): void => {
  const x = origin?.x ?? 0.5;
  const y = origin?.y ?? 0.55;
  const accent = readPaletteColors();
  void confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 38,
    origin: { x, y },
    colors: accent,
    scalar: 0.85,
    gravity: 1.05,
    decay: 0.92,
    ticks: 180,
    disableForReducedMotion: true,
  });
  void confetti({
    particleCount: 20,
    spread: 120,
    startVelocity: 22,
    origin: { x, y },
    colors: accent,
    scalar: 0.6,
    gravity: 0.6,
    decay: 0.94,
    ticks: 220,
    disableForReducedMotion: true,
  });
};
