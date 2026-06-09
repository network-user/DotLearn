import type { ProviderCredentials, ProviderId } from '@dotlearn/ai-providers';

import { db, type ProviderCredentialsRecord } from './progress-db';

const recordToCredentials = (record: ProviderCredentialsRecord): ProviderCredentials => {
  const out: ProviderCredentials = {};
  if (record.apiKey !== undefined) out.apiKey = record.apiKey;
  if (record.baseUrl !== undefined) out.baseUrl = record.baseUrl;
  if (record.defaultModel !== undefined) out.defaultModel = record.defaultModel;
  return out;
};

export const loadCredentials = async (providerId: ProviderId): Promise<ProviderCredentials> => {
  const record = await db.providerCredentials.get(providerId);
  return record ? recordToCredentials(record) : {};
};

export const saveCredentials = async (
  providerId: ProviderId,
  credentials: ProviderCredentials,
): Promise<void> => {
  const trimmed = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined;
    const next = value.trim();
    return next.length === 0 ? undefined : next;
  };
  const record: ProviderCredentialsRecord = {
    providerId,
    updatedAt: new Date().toISOString(),
  };
  const apiKey = trimmed(credentials.apiKey);
  const baseUrl = trimmed(credentials.baseUrl);
  const defaultModel = trimmed(credentials.defaultModel);
  if (apiKey !== undefined) record.apiKey = apiKey;
  if (baseUrl !== undefined) record.baseUrl = baseUrl;
  if (defaultModel !== undefined) record.defaultModel = defaultModel;
  await db.providerCredentials.put(record);
};

export const clearCredentials = async (providerId: ProviderId): Promise<void> => {
  await db.providerCredentials.delete(providerId);
};
