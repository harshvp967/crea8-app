export function linkStartupKeys(pathname: string) {
  const link =
    pathname === '/linkinbio' ||
    pathname.startsWith('/linkinbio/') ||
    pathname === '/link' ||
    pathname.startsWith('/link/');
  const editor = pathname === '/linkinbio' || pathname === '/link';
  const leads = pathname === '/linkinbio/leads' || pathname === '/link/leads';
  return {
    page: link ? '/link-in-bio' : null,
    posts: editor ? '/link-in-bio/posts' : null,
    leads: leads ? '/link-in-bio/leads?status=&q=' : null,
  };
}
