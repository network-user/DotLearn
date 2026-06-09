import {
  forwardRef,
  useEffect,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cx } from './cx';

type Intensity = 'subtle' | 'medium' | 'strong' | 'liquid';
type Tint = 'neutral' | 'accent';

interface Props extends HTMLAttributes<HTMLDivElement> {
  intensity?: Intensity;
  tint?: Tint;
  interactive?: boolean;
  bordered?: boolean;
  noiseOverlay?: boolean;
  shine?: boolean;
  asChildClass?: string;
  children?: ReactNode;
}

const intensityClass: Record<Intensity, string> = {
  subtle: 'glass--subtle',
  medium: 'glass--medium',
  strong: 'glass--strong',
  liquid: 'glass--liquid',
};

const tintClass: Record<Tint, string> = {
  neutral: '',
  accent: 'glass--tint-accent',
};

export const GlassSurface = forwardRef<HTMLDivElement, Props>(function GlassSurface(
  {
    intensity = 'medium',
    tint = 'neutral',
    interactive = false,
    bordered = true,
    noiseOverlay = false,
    shine,
    className,
    children,
    style,
    ...rest
  },
  ref,
) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const setRefs = (el: HTMLDivElement | null): void => {
    localRef.current = el;
    if (typeof ref === 'function') {
      ref(el);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }
  };

  useEffect(() => {
    if (!interactive) {
      return;
    }
    const el = localRef.current;
    if (!el) {
      return;
    }
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return;
    }
    const onMove = (e: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--gx', `${x}%`);
      el.style.setProperty('--gy', `${y}%`);
    };
    const reset = (): void => {
      el.style.setProperty('--gx', '50%');
      el.style.setProperty('--gy', '0%');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    reset();
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
    };
  }, [interactive]);

  const classes = cx(
    'glass',
    intensityClass[intensity],
    tintClass[tint],
    interactive && 'glass--interactive',
    bordered && 'glass--bordered',
    className,
  );

  const showShine =
    shine ?? (intensity === 'medium' || intensity === 'strong' || intensity === 'liquid');

  const merged: CSSProperties = style ?? {};

  return (
    <div ref={setRefs} className={classes} style={merged} {...rest}>
      <span aria-hidden="true" className="glass__highlight" />
      {showShine && <span aria-hidden="true" className="glass__shine" />}
      {noiseOverlay && <span aria-hidden="true" className="glass__noise" />}
      <span className="glass__content block">{children}</span>
    </div>
  );
});
