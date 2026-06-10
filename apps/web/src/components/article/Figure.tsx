import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';

import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

interface FigureNumbering {
  register: (id: string) => () => void;
  numberOf: (id: string) => number | null;
}

const FigureNumberingContext = createContext<FigureNumbering | null>(null);

export const FigureProvider = ({ children }: { children: ReactNode }) => {
  const [ids, setIds] = useState<string[]>([]);
  const register = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    return () => setIds((prev) => prev.filter((existing) => existing !== id));
  }, []);
  const numberOf = useCallback(
    (id: string) => {
      const index = ids.indexOf(id);
      return index === -1 ? null : index + 1;
    },
    [ids],
  );
  return (
    <FigureNumberingContext.Provider value={{ register, numberOf }}>
      {children}
    </FigureNumberingContext.Provider>
  );
};

interface FigureProps {
  caption?: ReactNode | undefined;
  id?: string | undefined;
  wide?: boolean | undefined;
  children: ReactNode;
}

export const Figure = ({ caption, id, wide = false, children }: FigureProps) => {
  const { t } = useTranslation('viz');
  const autoId = useId();
  const figureId = id ?? autoId;
  const numbering = useContext(FigureNumberingContext);
  useEffect(() => {
    if (!numbering) return undefined;
    return numbering.register(figureId);
  }, [numbering, figureId]);
  const number = numbering?.numberOf(figureId) ?? null;

  return (
    <figure
      id={id}
      className={cx(
        'not-prose my-7',
        wide && 'lg:-mx-16 xl:-mx-24',
      )}
    >
      <div className="rounded-lg border border-border-base bg-surface px-4 py-5 overflow-x-auto">
        {children}
      </div>
      {(caption || number !== null) && (
        <figcaption className="mt-2.5 pl-3 border-l-2 border-accent/60 text-[13px] leading-relaxed text-fg-muted">
          {number !== null && (
            <span className="font-semibold text-fg mr-1.5">
              {t('figure.label', { defaultValue: 'Рис.' })} {number}.
            </span>
          )}
          {caption}
        </figcaption>
      )}
    </figure>
  );
};
