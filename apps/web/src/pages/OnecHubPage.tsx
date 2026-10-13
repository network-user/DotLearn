import type { LucideIcon } from 'lucide-react';
import { Factory, Stethoscope, Warehouse } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Surface } from '@/components/ui/Surface';
import { Seo } from '@/lib/seo';
import { topicTitleOf } from '@/lib/topics';
import { getTrack } from '@/lib/tracks';

const WINDOWS = [
  {
    key: 'goods',
    to: '/workbench',
    lesson: 'onec-workbench',
    icon: Warehouse,
  },
  {
    key: 'plant',
    to: '/plant',
    lesson: 'plant-case',
    icon: Factory,
  },
  {
    key: 'clinic',
    to: '/clinic',
    lesson: null,
    icon: Stethoscope,
  },
] as const;

export const OnecHubPage = () => {
  const { t } = useTranslation('onec');
  const { t: tSeo } = useTranslation('seo');
  const track = getTrack('onec');

  return (
    <div className="space-y-10">
      <Seo title={t('title')} description={tSeo('onecDescription')} canonicalPath="/onec" />
      <header className="space-y-2">
        <p className="eyebrow text-fg-subtle">{t('eyebrow')}</p>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tightish">{t('windowsTitle')}</h2>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {WINDOWS.map((window) => (
            <li key={window.key}>
              <WindowCard
                icon={window.icon}
                title={t(`windows.${window.key}.title`)}
                body={t(`windows.${window.key}.body`)}
                openLabel={t(`windows.${window.key}.open`)}
                to={window.to}
                lesson={window.lesson}
                {...(window.lesson === null
                  ? {}
                  : { lessonLabel: t(`windows.${window.key}.lesson`) })}
                {...(window.key === 'goods' ? { note: t('startHere') } : {})}
              />
            </li>
          ))}
        </ul>
      </section>

      {track && track.topicSlugs.length > 0 ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tightish">{t('pathTitle')}</h2>
            <p className="max-w-prose text-sm text-fg-muted">{t('pathLead')}</p>
          </div>
          <ol className="space-y-2">
            {track.topicSlugs.map((slug, index) => (
              <li key={slug}>
                <Link
                  to="/topics/$slug"
                  params={{ slug }}
                  className="flex min-h-[var(--tap)] items-center gap-3 rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg hover:border-border-strong"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] tabular-nums text-fg-muted">
                    {index + 1}
                  </span>
                  <span className="font-medium">{topicTitleOf(slug) ?? slug}</span>
                </Link>
              </li>
            ))}
          </ol>
          <Link
            to="/tracks/$id"
            params={{ id: track.id }}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg sm:w-auto"
          >
            {t('openTrack')}
          </Link>
        </section>
      ) : null}
    </div>
  );
};

const WindowCard = ({
  icon: Icon,
  title,
  body,
  openLabel,
  to,
  lesson,
  lessonLabel,
  note,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  openLabel: string;
  to: '/workbench' | '/plant' | '/clinic';
  lesson: 'onec-workbench' | 'plant-case' | null;
  lessonLabel?: string;
  note?: string;
}) => (
  <Surface className="h-full">
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg leading-tight tracking-tightish text-fg">{title}</h3>
        <Icon size={18} aria-hidden className="shrink-0 text-accent" />
      </div>
      {note ? <p className="eyebrow text-[10px] text-accent">{note}</p> : null}
      <p className="text-[13px] leading-relaxed text-fg-muted">{body}</p>
      <div className="mt-auto flex flex-col gap-2 pt-1">
        <Link
          to={to}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-surface"
        >
          {openLabel}
        </Link>
        {lesson && lessonLabel ? (
          <Link
            to="/topics/$slug"
            params={{ slug: lesson }}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg"
          >
            {lessonLabel}
          </Link>
        ) : null}
      </div>
    </div>
  </Surface>
);
