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

export type ConfettiIntensity = 'soft' | 'normal' | 'grand';

interface IntensityProfile {
  mainCount: number;
  mainVelocity: number;
  trailCount: number;
}

const INTENSITY_PROFILES: Record<ConfettiIntensity, IntensityProfile> = {
  soft: { mainCount: 36, mainVelocity: 32, trailCount: 12 },
  normal: { mainCount: 60, mainVelocity: 38, trailCount: 20 },
  grand: { mainCount: 120, mainVelocity: 46, trailCount: 44 },
};

export const burstConfetti = (
  origin?: { x?: number; y?: number },
  intensity: ConfettiIntensity = 'normal',
): void => {
  const x = origin?.x ?? 0.5;
  const y = origin?.y ?? 0.55;
  const accent = readPaletteColors();
  const profile = INTENSITY_PROFILES[intensity];
  void confetti({
    particleCount: profile.mainCount,
    spread: 70,
    startVelocity: profile.mainVelocity,
    origin: { x, y },
    colors: accent,
    scalar: 0.85,
    gravity: 1.05,
    decay: 0.92,
    ticks: 180,
    disableForReducedMotion: true,
  });
  void confetti({
    particleCount: profile.trailCount,
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

export type CelebrationKind = 'goal-reached' | 'streak-milestone' | 'queue-cleared';

const CELEBRATION_INTENSITY: Record<CelebrationKind, ConfettiIntensity> = {
  'goal-reached': 'normal',
  'streak-milestone': 'grand',
  'queue-cleared': 'soft',
};

export const celebrate = (kind: CelebrationKind): void => {
  burstConfetti(undefined, CELEBRATION_INTENSITY[kind]);
};
