import { useCallback, useSyncExternalStore } from 'react';

export const coarsePointerQuery = '(pointer: coarse)';

const matchMediaSnapshot = (query: string): boolean => window.matchMedia(query).matches;

export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', onStoreChange);
      return () => mediaQueryList.removeEventListener('change', onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => matchMediaSnapshot(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
