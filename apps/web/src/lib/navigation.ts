export const isNavPathActive = (pathname: string, path: string): boolean => {
  if (path === '/') {
    return pathname === '/' || pathname.startsWith('/topics');
  }
  return pathname.startsWith(path);
};
