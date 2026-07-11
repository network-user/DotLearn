interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

export const isConstrainedConnection = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection) return false;
  if (connection.saveData === true) return true;
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
};
