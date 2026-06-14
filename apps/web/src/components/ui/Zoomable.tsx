import { useContext, type ComponentType, type ImgHTMLAttributes, type ReactNode } from 'react';

import { Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from './cx';
import { InsideZoomableContext, useLightbox } from './Lightbox';

const ExpandButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={cx(
      'absolute right-2 top-2 z-10 grid size-11 place-items-center rounded-full sm:size-9',
      'bg-surface/40 text-fg-muted backdrop-blur-sm',
      'opacity-0 transition group-hover/zoom:opacity-100 focus-visible:opacity-100',
      'hover:bg-surface/70 hover:text-fg',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
      '[@media(hover:none)]:opacity-60',
    )}
  >
    <Maximize2 size={14} />
  </button>
);

export const Zoomable = ({ children, caption }: { children: ReactNode; caption?: ReactNode }) => {
  const insideZoomable = useContext(InsideZoomableContext);
  const { open } = useLightbox();
  const { t } = useTranslation('viz');

  if (insideZoomable) return <>{children}</>;

  return (
    <InsideZoomableContext.Provider value={true}>
      <div className="group/zoom relative">
        {children}
        <ExpandButton
          label={t('lightbox.expand', { defaultValue: 'Развернуть' })}
          onClick={() => open({ kind: 'node', node: children, caption })}
        />
      </div>
    </InsideZoomableContext.Provider>
  );
};

type AnyProps = Record<string, unknown>;

export const withZoom = (Component: ComponentType<AnyProps>): ComponentType<AnyProps> => {
  const Wrapped = (props: AnyProps) => (
    <Zoomable caption={props.caption as ReactNode}>
      <Component {...props} />
    </Zoomable>
  );
  Wrapped.displayName = `withZoom(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Wrapped;
};

export const LightboxImage = (props: ImgHTMLAttributes<HTMLImageElement>) => {
  const insideZoomable = useContext(InsideZoomableContext);
  const { open } = useLightbox();
  const { t } = useTranslation('viz');
  const { src, alt, className, ...rest } = props;

  const imageClass = cx('block h-auto max-w-full rounded-lg border border-border-base', className);

  if (typeof src !== 'string' || src.length === 0) {
    return <img {...props} />;
  }

  if (insideZoomable) {
    return <img {...rest} src={src} alt={alt ?? ''} loading="lazy" className={imageClass} />;
  }

  const openImage = () =>
    open(typeof alt === 'string' ? { kind: 'image', src, alt } : { kind: 'image', src });

  return (
    <span className="group/zoom not-prose relative my-7 block">
      <img
        {...rest}
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        onClick={openImage}
        className={cx(imageClass, 'cursor-zoom-in')}
      />
      <ExpandButton
        label={t('lightbox.expand', { defaultValue: 'Развернуть' })}
        onClick={openImage}
      />
    </span>
  );
};
