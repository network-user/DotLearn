import { useEffect, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';

import { getAllManifests, loadHiddenSlugs } from './topics';

export const useVisibleManifests = (): TopicManifest[] => {
  const [manifests, setManifests] = useState<TopicManifest[]>(() => getAllManifests());

  useEffect(() => {
    let cancelled = false;
    void loadHiddenSlugs().then((hidden) => {
      if (cancelled || hidden.size === 0) return;
      setManifests((prev) => prev.filter((manifest) => !hidden.has(manifest.slug)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return manifests;
};
