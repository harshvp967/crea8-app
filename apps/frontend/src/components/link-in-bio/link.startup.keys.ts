export function linkStartupKeys(pathname: string) {
  const link = pathname === '/link' || pathname.startsWith('/link/');
  return {
    page: link ? '/link-in-bio' : null,
    posts: pathname === '/link' ? '/link-in-bio/posts' : null,
    leads: pathname === '/link/leads' ? '/link-in-bio/leads?status=&q=' : null,
  };
}
