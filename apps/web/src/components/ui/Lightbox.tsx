import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import * as RadixDialog from '@radix-ui/react-dialog';
import { Download, ExternalLink, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from './cx';

export type LightboxItem =
  | { kind: 'image'; src: string; alt?: string; caption?: ReactNode }
  | { kind: 'node'; node: ReactNode; caption?: ReactNode };

interface LightboxContextValue {
  open: (item: LightboxItem) => void;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

export const InsideZoomableContext = createContext(false);

class LightboxContextError extends Error {
  constructor() {
    super('useLightbox must be used within a LightboxProvider');
    this.name = 'LightboxContextError';
  }
}

export const useLightbox = (): LightboxContextValue => {
  const value = useContext(LightboxContext);
  if (!value) throw new LightboxContextError();
  return value;
};

export const LightboxProvider = ({ children }: { children: ReactNode }) => {
  const [item, setItem] = useState<LightboxItem | null>(null);
  const open = useCallback((next: LightboxItem) => setItem(next), []);
  const close = useCallback(() => setItem(null), []);
  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      <LightboxOverlay item={item} onClose={close} />
    </LightboxContext.Provider>
  );
};

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 };
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const BUTTON_FACTOR = 1.5;
const DOUBLE_TAP_SCALE = 2.5;
const WHEEL_INTENSITY = 380;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const zoomAround = (
  base: Transform,
  nextScale: number,
  stage: HTMLElement | null,
  originX?: number,
  originY?: number,
): Transform => {
  const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  if (scale === MIN_SCALE) return IDENTITY;
  if (!stage || originX === undefined || originY === undefined) {
    return { ...base, scale };
  }
  const rect = stage.getBoundingClientRect();
  const px = originX - rect.left - rect.width / 2;
  const py = originY - rect.top - rect.height / 2;
  const ratio = scale / base.scale;
  return {
    scale,
    tx: px - (px - base.tx) * ratio,
    ty: py - (py - base.ty) * ratio,
  };
};

const LightboxOverlay = ({ item, onClose }: { item: LightboxItem | null; onClose: () => void }) => {
  const { t } = useTranslation('viz');
  const stageRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [animate, setAnimate] = useState(false);
  const [entered, setEntered] = useState(false);
  const transformRef = useRef<Transform>(IDENTITY);

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; base: Transform } | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const isOpen = item !== null;

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      return undefined;
    }
    setTransform(IDENTITY);
    setAnimate(false);
    pointers.current.clear();
    pinchRef.current = null;
    panRef.current = null;
    setEntered(false);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [item, isOpen]);

  const applyZoom = useCallback((factor: number, originX?: number, originY?: number) => {
    setTransform((prev) =>
      zoomAround(prev, prev.scale * factor, stageRef.current, originX, originY),
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onWheel = (event: WheelEvent) => {
      const stage = stageRef.current;
      if (!stage || !stage.contains(event.target as Node)) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
      const factor = Math.exp((-event.deltaY * unit) / WHEEL_INTENSITY);
      setAnimate(false);
      applyZoom(factor, event.clientX, event.clientY);
    };
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () =>
      document.removeEventListener('wheel', onWheel, { capture: true } as EventListenerOptions);
  }, [isOpen, applyZoom]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setAnimate(false);
    if (pointers.current.size === 2) {
      const points = [...pointers.current.values()];
      const a = points[0];
      const b = points[1];
      if (a && b) {
        pinchRef.current = { dist: distance(a, b), base: transformRef.current };
        panRef.current = null;
      }
    } else {
      panRef.current = {
        x: event.clientX,
        y: event.clientY,
        tx: transformRef.current.tx,
        ty: transformRef.current.ty,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && pinchRef.current) {
      const points = [...pointers.current.values()];
      const a = points[0];
      const b = points[1];
      if (!a || !b) return;
      const factor = distance(a, b) / pinchRef.current.dist;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const base = pinchRef.current.base;
      setTransform(zoomAround(base, base.scale * factor, stageRef.current, midX, midY));
      return;
    }

    if (panRef.current && transformRef.current.scale > MIN_SCALE) {
      const dx = event.clientX - panRef.current.x;
      const dy = event.clientY - panRef.current.y;
      setTransform((prev) => ({
        ...prev,
        tx: panRef.current!.tx + dx,
        ty: panRef.current!.ty + dy,
      }));
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) {
      panRef.current = null;
    } else {
      const remaining = [...pointers.current.values()][0];
      if (remaining) {
        panRef.current = {
          x: remaining.x,
          y: remaining.y,
          tx: transformRef.current.tx,
          ty: transformRef.current.ty,
        };
      }
    }
  };

  const onDoubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    setAnimate(true);
    if (transformRef.current.scale > MIN_SCALE) {
      setTransform(IDENTITY);
    } else {
      setTransform(
        zoomAround(IDENTITY, DOUBLE_TAP_SCALE, stageRef.current, event.clientX, event.clientY),
      );
    }
  };

  const zoomIn = () => {
    setAnimate(true);
    applyZoom(BUTTON_FACTOR);
  };
  const zoomOut = () => {
    setAnimate(true);
    applyZoom(1 / BUTTON_FACTOR);
  };
  const resetZoom = () => {
    setAnimate(true);
    setTransform(IDENTITY);
  };

  const zoomed = transform.scale > MIN_SCALE;
  const isImage = item?.kind === 'image';

  return (
    <RadixDialog.Root
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-canvas/85 backdrop-blur-md data-[state=open]:animate-fade-in motion-reduce:animate-none" />
        <RadixDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="fixed inset-0 z-[var(--z-modal)] flex flex-col outline-none"
        >
          <RadixDialog.Title className="sr-only">
            {t('lightbox.title', { defaultValue: 'Просмотр вложения' })}
          </RadixDialog.Title>

          {item && (
            <>
              <div
                ref={stageRef}
                onClick={(event) => {
                  if (event.target === event.currentTarget) onClose();
                }}
                onDoubleClick={onDoubleClick}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={cx(
                  'relative grid flex-1 touch-none select-none place-items-center overflow-hidden p-4',
                  zoomed
                    ? 'cursor-grab active:cursor-grabbing'
                    : isImage
                      ? 'cursor-zoom-in'
                      : 'cursor-default',
                )}
              >
                <div
                  className={cx(
                    'flex items-center justify-center transition-[opacity,transform] duration-slow ease-emph motion-reduce:transition-none',
                    isImage && 'h-full w-full',
                    entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
                  )}
                >
                  <div
                    style={{
                      transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
                    }}
                    className={cx(
                      'flex origin-center items-center justify-center',
                      isImage && 'h-full w-full will-change-transform',
                      animate
                        ? 'transition-transform duration-med ease-emph motion-reduce:transition-none'
                        : '',
                    )}
                  >
                    {item.kind === 'image' ? (
                      <img
                        src={item.src}
                        alt={item.alt ?? ''}
                        draggable={false}
                        className="h-full w-full select-none object-contain"
                      />
                    ) : (
                      <InsideZoomableContext.Provider value={true}>
                        <div className="max-h-[86vh] max-w-[92vw]">{item.node}</div>
                      </InsideZoomableContext.Provider>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative z-[1] flex shrink-0 flex-col items-center gap-3 px-3 pb-[calc(16px+var(--safe-bottom))] pt-3">
                {item.caption && (
                  <p className="max-w-prose px-4 text-center text-[13px] leading-relaxed text-fg-muted">
                    {item.caption}
                  </p>
                )}
                <div className="glass-chrome flex items-center gap-0.5 rounded-pill border border-border-base p-1 shadow-float">
                  <ControlButton
                    onClick={zoomOut}
                    label={t('lightbox.zoomOut', { defaultValue: 'Отдалить' })}
                  >
                    <ZoomOut size={18} />
                  </ControlButton>
                  <ControlButton
                    onClick={zoomIn}
                    label={t('lightbox.zoomIn', { defaultValue: 'Приблизить' })}
                  >
                    <ZoomIn size={18} />
                  </ControlButton>
                  <ControlButton
                    onClick={resetZoom}
                    label={t('lightbox.reset', { defaultValue: 'Сбросить масштаб' })}
                  >
                    <RotateCcw size={17} />
                  </ControlButton>
                  {item.kind === 'image' && (
                    <>
                      <span className="mx-0.5 h-5 w-px bg-border-base" aria-hidden="true" />
                      <ControlLink
                        href={item.src}
                        download
                        label={t('lightbox.download', { defaultValue: 'Скачать' })}
                      >
                        <Download size={17} />
                      </ControlLink>
                      <ControlLink
                        href={item.src}
                        target="_blank"
                        label={t('lightbox.openOriginal', { defaultValue: 'Открыть оригинал' })}
                      >
                        <ExternalLink size={17} />
                      </ControlLink>
                    </>
                  )}
                </div>
              </div>

              <RadixDialog.Close
                aria-label={t('lightbox.close', { defaultValue: 'Закрыть' })}
                className="glass-chrome absolute right-3 top-3 z-[2] grid min-h-[var(--tap)] min-w-[var(--tap)] place-items-center rounded-full border border-border-base text-fg transition-colors duration-fast hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <X size={18} />
              </RadixDialog.Close>
            </>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

const controlClass =
  'grid min-h-[var(--tap)] min-w-[var(--tap)] place-items-center rounded-full text-fg transition-colors duration-fast hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';

const ControlButton = ({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) => (
  <button type="button" onClick={onClick} aria-label={label} className={controlClass}>
    {children}
  </button>
);

const ControlLink = ({
  href,
  label,
  children,
  download,
  target,
}: {
  href: string;
  label: string;
  children: ReactNode;
  download?: boolean;
  target?: string;
}) => (
  <a
    href={href}
    aria-label={label}
    download={download}
    target={target}
    rel={target ? 'noreferrer' : undefined}
    className={controlClass}
  >
    {children}
  </a>
);
