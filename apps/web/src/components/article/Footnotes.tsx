import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useTranslation } from 'react-i18next';

interface FootnoteRegistry {
  register: (id: string) => () => void;
  numberOf: (id: string) => number | null;
}

const FootnoteContext = createContext<FootnoteRegistry | null>(null);

export const FootnoteProvider = ({ children }: { children: ReactNode }) => {
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
  const value = useMemo<FootnoteRegistry>(() => ({ register, numberOf }), [register, numberOf]);
  return <FootnoteContext.Provider value={value}>{children}</FootnoteContext.Provider>;
};

export const Ref = ({ id }: { id: string }) => {
  const registry = useContext(FootnoteContext);
  const register = registry?.register;
  useEffect(() => {
    if (!register) return undefined;
    return register(id);
  }, [register, id]);
  const number = registry?.numberOf(id) ?? null;
  if (number === null) return null;
  return (
    <sup id={`ref-${id}`} className="not-prose">
      <a
        href={`#fn-${id}`}
        className="text-accent text-[0.72em] font-semibold no-underline hover:underline px-0.5"
      >
        {number}
      </a>
    </sup>
  );
};

interface FootnotesProps {
  notes: { id: string; text: ReactNode }[];
}

export const Footnotes = ({ notes }: FootnotesProps) => {
  const { t } = useTranslation('viz');
  const registry = useContext(FootnoteContext);
  const ordered = [...notes].sort((a, b) => {
    const an = registry?.numberOf(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bn = registry?.numberOf(b.id) ?? Number.MAX_SAFE_INTEGER;
    return an - bn;
  });
  return (
    <aside className="not-prose mt-10 pt-4 border-t border-border-base">
      <div className="eyebrow mb-3">{t('footnotes.title', { defaultValue: 'Примечания' })}</div>
      <ol className="space-y-2">
        {ordered.map((note) => {
          const number = registry?.numberOf(note.id);
          return (
            <li key={note.id} id={`fn-${note.id}`} className="flex gap-2 text-[13px] text-fg-muted leading-relaxed">
              <a
                href={`#ref-${note.id}`}
                className="shrink-0 text-accent font-semibold no-underline hover:underline"
              >
                {number ?? '·'}.
              </a>
              <span>{note.text}</span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
};
