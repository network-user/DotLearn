export const isNavPathActive = (pathname: string, path: string): boolean => {
  if (path === '/') {
    return pathname === '/' || pathname.startsWith('/topics');
  }
  return pathname.startsWith(path);
};

export const isNavItemActive = (
  pathname: string,
  item: { to: string; matchPrefixes?: readonly string[] },
): boolean =>
  isNavPathActive(pathname, item.to) ||
  (item.matchPrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ??
    false);
