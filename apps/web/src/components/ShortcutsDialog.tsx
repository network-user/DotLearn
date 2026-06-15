import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog } from '@/components/ui/Dialog';
import { Kbd } from '@/components/ui/Kbd';

interface ShortcutRow {
  id: string;
  keys: string[];
  label: string;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.isContentEditable ||
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    Boolean(element.closest('.monaco-editor'))
  );
};

export const ShortcutsHost = () => {
  const { t } = useTranslation('help');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== '?') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const rows: ShortcutRow[] = [
    { id: 'search', keys: ['⌘', 'K'], label: t('shortcuts.rows.search') },
    { id: 'nextConcept', keys: ['j'], label: t('shortcuts.rows.nextConcept') },
    { id: 'prevConcept', keys: ['k'], label: t('shortcuts.rows.prevConcept') },
    { id: 'focus', keys: ['f'], label: t('shortcuts.rows.focus') },
    { id: 'exit', keys: ['Esc'], label: t('shortcuts.rows.exit') },
    { id: 'flip', keys: ['Space'], label: t('shortcuts.rows.flip') },
    { id: 'rate', keys: ['1', '2', '3', '4'], label: t('shortcuts.rows.rate') },
    { id: 'help', keys: ['?'], label: t('shortcuts.rows.help') },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      placement="sheet"
      size="md"
      title={t('shortcuts.title')}
      description={t('shortcuts.hint')}
    >
      <ul className="divide-y divide-border-base">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm text-fg">{row.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((key, index) => (
                <Kbd key={`${row.id}-${index}`}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
};
