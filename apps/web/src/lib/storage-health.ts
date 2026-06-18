import { useCallback, useEffect, useRef, useState } from 'react';

export interface StorageHealth {
  supported: boolean;
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
  percent: number | null;
}

const UNSUPPORTED_HEALTH: StorageHealth = {
  supported: false,
  persisted: null,
  usageBytes: null,
  quotaBytes: null,
  percent: null,
};

const getStorageManager = (): StorageManager | null => {
  if (typeof navigator === 'undefined') return null;
  const manager = navigator.storage;
  if (!manager || typeof manager.estimate !== 'function') return null;
  return manager;
};

const supportsPersist = (manager: StorageManager): boolean =>
  typeof manager.persist === 'function' && typeof manager.persisted === 'function';

export const isStorageHealthSupported = (): boolean => getStorageManager() !== null;

const readPersisted = async (manager: StorageManager): Promise<boolean | null> => {
  if (typeof manager.persisted !== 'function') return null;
  try {
    return await manager.persisted();
  } catch {
    return null;
  }
};

export const probeStorageHealth = async (): Promise<StorageHealth> => {
  const manager = getStorageManager();
  if (!manager) return UNSUPPORTED_HEALTH;
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    const estimate = await manager.estimate();
    usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null;
    quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null;
  } catch {
    usageBytes = null;
    quotaBytes = null;
  }
  const percent =
    usageBytes !== null && quotaBytes !== null && quotaBytes > 0
      ? Math.min(100, (usageBytes / quotaBytes) * 100)
      : null;
  return {
    supported: true,
    persisted: await readPersisted(manager),
    usageBytes,
    quotaBytes,
    percent,
  };
};

const PERSIST_REQUESTED_KEY = 'dotlearn:storage-persist-requested';

const markPersistRequested = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PERSIST_REQUESTED_KEY, '1');
  } catch {
    /* ignore */
  }
};

const wasPersistRequested = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PERSIST_REQUESTED_KEY) === '1';
  } catch {
    return false;
  }
};

export const requestPersistentStorage = async (): Promise<boolean | null> => {
  const manager = getStorageManager();
  if (!manager || !supportsPersist(manager)) return null;
  try {
    const already = await manager.persisted();
    if (already) return true;
    const granted = await manager.persist();
    markPersistRequested();
    return granted;
  } catch {
    return null;
  }
};

export const requestPersistAfterFirstWrite = (): void => {
  const manager = getStorageManager();
  if (!manager || !supportsPersist(manager)) return;
  if (wasPersistRequested()) return;
  void requestPersistentStorage();
};

export const useStorageHealth = (): StorageHealth => {
  const [health, setHealth] = useState<StorageHealth>(() =>
    isStorageHealthSupported() ? { ...UNSUPPORTED_HEALTH, supported: true } : UNSUPPORTED_HEALTH,
  );
  const mounted = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    const next = await probeStorageHealth();
    if (mounted.current) setHealth(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return health;
};
