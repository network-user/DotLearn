import { useEffect, useRef, useState, type RefObject } from 'react';

export const useInViewport = <T extends Element>(): [RefObject<T>, boolean] => {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    let onScreen = false;
    let tabVisible = document.visibilityState === 'visible';
    const update = (): void => setVisible(onScreen && tabVisible);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        onScreen = entry.isIntersecting;
        update();
      },
      { threshold: 0.12 },
    );
    observer.observe(element);

    const handleVisibilityChange = (): void => {
      tabVisible = document.visibilityState === 'visible';
      update();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return [ref, visible];
};
