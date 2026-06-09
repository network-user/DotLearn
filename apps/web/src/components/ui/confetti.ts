import confetti from 'canvas-confetti';

export const burstConfetti = (origin?: { x?: number; y?: number }): void => {
  const x = origin?.x ?? 0.5;
  const y = origin?.y ?? 0.55;
  const accent = ['#6366f1', '#38bdf8', '#14b8a6', '#a78bfa', '#22d3ee'];
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
