import { useState } from 'react';

import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const AddTopicButton = () => {
  const { t } = useTranslation('addTopic');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const goSubmit = () => {
    setOpen(false);
    navigate({ to: '/submit' });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap bg-indigo-500 hover:bg-indigo-400 text-white shadow-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('button')}
      >
        <span className="md:hidden lg:inline">{t('button')}</span>
        <span className="hidden md:inline lg:hidden" aria-hidden>
          +
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 rounded-lg border border-border-base bg-surface shadow-xl p-2"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={goSubmit}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-surface-2"
          >
            <div className="text-sm font-medium text-fg">{t('suggest')}</div>
            <div className="text-xs text-fg-muted mt-0.5">{t('suggestHint')}</div>
          </button>
          <Link
            to="/"
            className="block px-3 py-2 rounded-md hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            <a
              href="https://github.com/your-org/dotlearn/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noreferrer"
              className="block"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="text-sm font-medium text-fg">{t('pr')}</div>
              <div className="text-xs text-fg-muted mt-0.5">{t('prHint')}</div>
            </a>
          </Link>
        </div>
      ) : null}
    </div>
  );
};
