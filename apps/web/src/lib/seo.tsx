import { useEffect } from 'react';

export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL || import.meta.env.VITE_API_BASE || '') as string
).replace(/\/+$/, '');

const SITE_NAME = '.learn';
const SEO_MARK = 'data-seo';

export interface SeoAlternates {
  ru?: string | undefined;
  en?: string | undefined;
}

export interface SeoProps {
  title?: string | undefined;
  description?: string | undefined;
  canonicalPath?: string | undefined;
  robots?: string | undefined;
  ogType?: 'website' | 'article' | undefined;
  ogImagePath?: string | undefined;
  lang?: 'ru' | 'en' | undefined;
  alternates?: SeoAlternates | undefined;
}

const absoluteUrl = (path: string): string =>
  `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const upsertMeta = (attr: 'name' | 'property', key: string, content: string | undefined): void => {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === undefined) {
    if (existing?.getAttribute(SEO_MARK) === '1') existing.remove();
    return;
  }
  const meta = existing ?? document.createElement('meta');
  meta.setAttribute(attr, key);
  meta.setAttribute('content', content);
  meta.setAttribute(SEO_MARK, '1');
  if (!existing) document.head.appendChild(meta);
};

const upsertLink = (rel: string, href: string | undefined): void => {
  const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (href === undefined) {
    if (existing?.getAttribute(SEO_MARK) === '1') existing.remove();
    return;
  }
  const link = existing ?? document.createElement('link');
  link.setAttribute('rel', rel);
  link.setAttribute('href', href);
  link.setAttribute(SEO_MARK, '1');
  if (!existing) document.head.appendChild(link);
};

const setHreflangAlternates = (alternates: SeoAlternates | undefined): void => {
  document.head
    .querySelectorAll(`link[rel="alternate"][hreflang][${SEO_MARK}="1"]`)
    .forEach((el) => el.remove());
  if (!alternates) return;
  const add = (hreflang: string, path: string): void => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', hreflang);
    link.setAttribute('href', absoluteUrl(path));
    link.setAttribute(SEO_MARK, '1');
    document.head.appendChild(link);
  };
  if (alternates.ru) add('ru', alternates.ru);
  if (alternates.en) add('en', alternates.en);
  if (alternates.ru) add('x-default', alternates.ru);
};

export const Seo = ({
  title,
  description,
  canonicalPath,
  robots,
  ogType = 'website',
  ogImagePath = '/og/default.png',
  lang = 'ru',
  alternates,
}: SeoProps) => {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;
    document.documentElement.lang = lang;

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', robots);

    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', ogType);
    upsertMeta('property', 'og:locale', lang === 'en' ? 'en_US' : 'ru_RU');
    upsertMeta('property', 'og:site_name', SITE_NAME);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);

    const hasSite = SITE_URL.length > 0;
    const canonicalUrl = hasSite && canonicalPath ? absoluteUrl(canonicalPath) : undefined;
    const imageUrl = hasSite ? absoluteUrl(ogImagePath) : undefined;

    upsertLink('canonical', canonicalUrl);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('name', 'twitter:image', imageUrl);

    setHreflangAlternates(hasSite ? alternates : undefined);
  }, [
    title,
    description,
    canonicalPath,
    robots,
    ogType,
    ogImagePath,
    lang,
    alternates?.ru,
    alternates?.en,
  ]);

  return null;
};
