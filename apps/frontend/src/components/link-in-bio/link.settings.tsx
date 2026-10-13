'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  LinkEditor,
  LinkRequestError,
  badgeLocked,
  domainLocked,
  linkLocked,
  linkSend,
  useLinkPage,
} from '@gitroom/frontend/components/link-in-bio/link.api';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { LinkField, LinkModal, LinkToggle, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
import { stkCard, stkSub, stkTitle } from '@gitroom/frontend/components/stalker/stalker.chrome';
import { LockedFeature } from '@gitroom/frontend/components/billing/billing.ui';

const fieldClass =
  'h-[44px] min-h-[44px] w-full rounded-[18px] border border-newBorder bg-newBgColorInner px-[14px] text-[14px] font-[500] shadow-[var(--arc-shadow-resting)] outline-none';

const statusCopy: Record<LinkEditor['domainStatus'], string> = {
  NONE: 'Not connected',
  WAITING: 'Waiting for DNS',
  VERIFYING: 'Verifying',
  LIVE: 'Live',
  ERROR: 'Error',
};

const statusClass: Record<LinkEditor['domainStatus'], string> = {
  NONE: 'lib-pill',
  WAITING: 'lib-pill lib-pill-amber',
  VERIFYING: 'lib-pill lib-pill-cyan',
  LIVE: 'lib-pill lib-pill-green',
  ERROR: 'lib-pill lib-pill-red',
};

const checkedLabel = (iso: string | null) => {
  if (!iso) {
    return '';
  }
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) {
    return 'Last checked just now';
  }
  if (minutes < 60) {
    return `Last checked ${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return `Last checked ${hours} hr ago`;
};

export const LinkSettingsScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const { data, error, isLoading, mutate } = useLinkPage();
  const [slug, setSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [sensitive, setSensitive] = useState(false);
  const [hideBadge, setHideBadge] = useState(false);
  const [domain, setDomain] = useState('');
  const [slugState, setSlugState] = useState<{ ok: boolean; message: string } | null>(null);
  const [domainNote, setDomainNote] = useState<'upgrade' | 'unavailable' | ''>('');
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  if (data && !ready) {
    setSlug(data.slug);
    setSeoTitle(data.seoTitle);
    setSeoDescription(data.seoDescription);
    setIsPublic(data.isPublic);
    setSensitive(data.sensitive);
    setHideBadge(data.hideBadge);
    setDomain(data.customDomain || '');
    setReady(true);
  }

  useEffect(() => {
    if (!data) {
      return;
    }
    let ignore = false;
    const timer = setTimeout(async () => {
      if (!slug || slug === data.slug) {
        setSlugState(slug ? { ok: true, message: 'Available' } : null);
        return;
      }
      const response = await fetch(`/link-in-bio/slug?slug=${encodeURIComponent(slug)}`);
      const body = await response.json().catch(() => ({ ok: false, message: 'Could not check that username' }));
      if (!ignore) {
        setSlugState({ ok: !!body.ok, message: body.message || '' });
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [slug, data, fetch]);

  useEffect(() => {
    if (!data) {
      return;
    }
    let url = '';
    let cancel = false;
    (async () => {
      const response = await fetch('/link-in-bio/qr.png', { headers: { Accept: 'image/png' } });
      if (!response.ok || cancel) {
        return;
      }
      url = URL.createObjectURL(await response.blob());
      if (cancel) {
        URL.revokeObjectURL(url);
        return;
      }
      setQr(url);
    })();
    return () => {
      cancel = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [data, fetch]);

  if (isLoading || !data || !ready) {
    return (
      <div className="flex min-w-0 flex-col gap-[12px] pb-[24px]">
        <h1 className={stkTitle}>Page settings</h1>
        <div className={`${stkCard} flex items-center gap-[12px]`}>
          {error ? <HugeIcon name="alert" size={20} className="shrink-0 text-textItemBlur" /> : null}
          <p className="text-[14px] font-[500] text-textItemBlur">{error ? 'Could not load your page.' : 'Loading your page…'}</p>
        </div>
      </div>
    );
  }

  const origin = data.publicOrigin.replace(/^https?:\/\//, '');
  const applyPage = (next: LinkEditor, note?: string) => {
    mutate(next, { revalidate: false });
    setSlug(next.slug);
    setDomain(next.customDomain || '');
    setHideBadge(next.hideBadge);
    setIsPublic(next.isPublic);
    setSensitive(next.sensitive);
    if (note) {
      toast.show(note, 'success');
    }
  };

  const save = async () => {
    if (slugState && !slugState.ok) {
      return;
    }
    setBusy(true);
    try {
      let current = data;
      if (slug !== data.slug) {
        current = await linkSend(fetch, '/link-in-bio/slug', 'PUT', { slug });
      }
      const body: Record<string, unknown> = {
        seoTitle,
        seoDescription,
        isPublic,
        sensitive,
      };
      if (!badgeLocked(data) && hideBadge !== data.hideBadge) {
        body.hideBadge = hideBadge;
      }
      current = await linkSend(fetch, '/link-in-bio', 'PUT', body);
      applyPage(current, 'Changes saved');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Something went wrong', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setDomainNote('');
    if (!data.domainAvailable) {
      setDomainNote('unavailable');
      return;
    }
    if (domainLocked(data)) {
      setDomainNote('upgrade');
      return;
    }
    setBusy(true);
    try {
      const result = await linkSend(fetch, '/link-in-bio/domain', 'POST', { domain });
      if (result.available === false) {
        setDomainNote('unavailable');
        return;
      }
      applyPage(result.page, result.page.domainStatus === 'LIVE' ? 'Domain connected' : undefined);
      if (result.page.domainStatus === 'LIVE') {
        toast.show(`${result.page.customDomain} is live`, 'success');
      }
      setRecordsOpen(true);
    } catch (err) {
      if (err instanceof LinkRequestError && err.upgrade) {
        setDomainNote('upgrade');
      } else {
        toast.show(err instanceof Error ? err.message : 'Could not connect that domain', 'warning');
      }
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    try {
      const result = await linkSend(fetch, '/link-in-bio/domain/check', 'POST');
      if (result.available === false) {
        setDomainNote('unavailable');
        return;
      }
      const becameLive = data.domainStatus !== 'LIVE' && result.page.domainStatus === 'LIVE';
      applyPage(result.page, becameLive ? 'Domain connected' : undefined);
      if (becameLive) {
        toast.show(`${result.page.customDomain} is live`, 'success');
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not check DNS', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await linkSend(fetch, '/link-in-bio/domain', 'DELETE');
      if (result.available === false) {
        setDomainNote('unavailable');
        toast.show('Cloudflare is not configured, so this domain was left in place', 'warning');
        return;
      }
      applyPage(result.page, 'Domain removed');
      setRecordsOpen(false);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not remove that domain', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const download = async (format: 'png' | 'svg') => {
    const response = await fetch(`/link-in-bio/qr.${format}`, {
      headers: { Accept: format === 'png' ? 'image/png' : 'image/svg+xml' },
    });
    if (!response.ok) {
      toast.show('Could not download the QR code', 'warning');
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `crea8-${data.slug}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="lib-settings flex min-w-0 flex-col gap-[16px] overflow-y-auto pb-[24px]">
      <div className="flex flex-col items-start gap-[12px] sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <h1 className={stkTitle}>Page settings</h1>
          <p className={stkSub}>Address, custom domain, sharing and search for {origin}/{data.slug}</p>
        </div>
        <button type="button" className={linkPrimary} disabled={busy || (slugState ? !slugState.ok : false)} onClick={save}>
          Save changes
        </button>
      </div>

      <section className={stkCard}>
        <h2 className="text-[16px] font-[600]">Your page address</h2>
        <div className="mt-[12px] grid gap-[6px]">
          <span className="text-[14px] font-[500]">Username</span>
          <div className="relative">
            <input
              className={`${fieldClass} ${slugState?.ok ? 'pe-[100px]' : ''}`}
              value={slug}
              maxLength={30}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              aria-label="Username"
            />
            {slugState?.ok ? (
              <span className="pointer-events-none absolute inset-y-0 end-[12px] flex items-center text-[13px] font-[600] text-[color:var(--arc-success)]">
                {slugState.message}
              </span>
            ) : null}
          </div>
          <p className="text-[13px] text-textItemBlur">Letters, numbers, dots and underscores · 3 to 30 characters</p>
          {slugState && !slugState.ok ? <p className="text-[13px] font-[600] text-[color:var(--arc-danger)]">{slugState.message}</p> : null}
          <p className="text-[13px] text-textItemBlur">Opens {origin}/{slug || data.slug}</p>
        </div>
      </section>

      <section className={stkCard}>
        <div className="mb-[12px] flex items-center justify-between gap-[12px]">
          <h2 className="text-[16px] font-[600]">Custom domain</h2>
          {data.domainStatus !== 'NONE' ? <span className={statusClass[data.domainStatus]}>{statusCopy[data.domainStatus]}</span> : null}
        </div>
        {data.domainStatus === 'NONE' ? (
          <div className="flex flex-col gap-[8px] sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <HugeIcon name="link" size={16} className="pointer-events-none absolute start-[14px] top-1/2 -translate-y-1/2 text-textItemBlur" />
              <input
                className={`${fieldClass} ps-[38px]`}
                value={domain}
                placeholder="links.yourdomain.com"
                disabled={domainLocked(data)}
                onChange={(event) => setDomain(event.target.value)}
                aria-label="Custom domain"
              />
            </div>
            {domainLocked(data) ? (
              <Link href="/billing" className={linkSecondary}>
                Upgrade
              </Link>
            ) : (
              <button type="button" className={linkSecondary} disabled={busy || !domain.trim()} onClick={connect}>
                Connect domain
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[12px]">
            <p className="text-[14px]">{data.customDomain}</p>
            {data.domainError ? <p className="text-[13px] text-[#f07178]">{data.domainError}</p> : null}
            {data.domainRecords.length ? (
              <div className="lib-table-wrap">
              <table className="lib-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Value</th>
                    <th>TTL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.domainRecords.map((record) => (
                    <tr key={`${record.type}-${record.name}`}>
                      <td data-label="Type">{record.type}</td>
                      <td data-label="Name">{record.name}</td>
                      <td data-label="Value">{record.value}</td>
                      <td data-label="TTL">{record.ttl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-[8px]">
              <span className="text-[13px] text-textItemBlur">{checkedLabel(data.domainCheckedAt)}</span>
                <div className="flex flex-wrap gap-[8px]">
                <button type="button" className={linkSecondary} disabled={busy} onClick={check}>
                  Check again
                </button>
                <button type="button" className={linkSecondary} disabled={busy} onClick={remove}>
                  Remove domain
                </button>
              </div>
            </div>
          </div>
        )}
        {domainNote === 'unavailable' ? (
          <p className="mt-[8px] text-[13px] text-textItemBlur">Custom domains are unavailable until Cloudflare is configured.</p>
        ) : null}
        {domainLocked(data) || domainNote === 'upgrade' ? (
          <div className="mt-[8px]">
            <LockedFeature title="Custom domain" detail="A custom domain is included on every paid plan." />
          </div>
        ) : null}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-[16px] md:grid-cols-2">
        <section className={stkCard}>
          <h2 className="mb-[12px] text-[16px] font-[600]">Page visibility</h2>
          <div className="mb-[14px] flex items-center justify-between gap-[12px]">
            <div className="min-w-0">
              <div className="text-[14px] font-[500]">Page is public</div>
              <p className="text-[13px] text-textItemBlur">Turn off to show a “coming soon” page</p>
            </div>
            <LinkToggle checked={isPublic} label="Page is public" onChange={setIsPublic} />
          </div>
          <div className="mb-[14px] flex items-center justify-between gap-[12px]">
            <div className="min-w-0">
              <div className="text-[14px] font-[500]">Sensitive content warning</div>
              <p className="text-[13px] text-textItemBlur">Ask visitors to confirm before opening</p>
            </div>
            <LinkToggle checked={sensitive} label="Sensitive content warning" onChange={setSensitive} />
          </div>
          <div className="flex items-center justify-between gap-[12px]">
            <div className="min-w-0">
              <div className="text-[14px] font-[500]">Show “made with crea8.one”</div>
              <p className="text-[13px] text-textItemBlur">
                {badgeLocked(data) ? 'Hiding the badge is on a paid plan' : 'Paid plans can hide the badge'}
              </p>
              {badgeLocked(data) ? (
                <LockedFeature title="Badge removal" detail="Removing the made with crea8.one badge is included on every paid plan." />
              ) : null}
            </div>
            <LinkToggle
              checked={!hideBadge}
              label="Show made with crea8.one"
              onChange={(show) => {
                if (!show && badgeLocked(data)) {
                  setDomainNote('');
                  toast.show('Removing the badge is on a paid plan', 'warning');
                  return;
                }
                setHideBadge(!show);
              }}
            />
          </div>
          {linkLocked(data) ? (
            <p className="mt-[8px] text-[13px] text-textItemBlur">
              <Link href="/billing" className="text-[#00D9FF]">
                Upgrade
              </Link>{' '}
              to remove the badge.
            </p>
          ) : null}
        </section>

        <section className={stkCard}>
          <h2 className="mb-[12px] text-[16px] font-[600]">QR code</h2>
          <div className="flex flex-wrap items-center gap-[16px]">
            <div className="grid h-[120px] w-[120px] place-items-center overflow-hidden rounded-[12px] bg-white">
              {qr ? <img src={qr} alt={`QR code for ${data.publicUrl}`} className="h-full w-full" /> : null}
            </div>
            <div className="flex flex-col gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => download('png')}>
                <HugeIcon name="download" size={16} />
                Download PNG
              </button>
              <button type="button" className={linkSecondary} onClick={() => download('svg')}>
                <HugeIcon name="download" size={16} />
                SVG
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className={stkCard}>
        <h2 className="mb-[12px] text-[16px] font-[600]">Search and sharing</h2>
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
          <LinkField label="Page title">
            <input value={seoTitle} maxLength={70} onChange={(event) => setSeoTitle(event.target.value)} />
          </LinkField>
          <LinkField label="Meta description">
            <textarea value={seoDescription} maxLength={160} onChange={(event) => setSeoDescription(event.target.value)} />
          </LinkField>
        </div>
      </section>

      {recordsOpen && data.domainStatus !== 'NONE' ? (
        <LinkModal title="Connect domain" onClose={() => setRecordsOpen(false)}>
          <p className="mb-[12px] text-[14px] text-textItemBlur">Add these records at your DNS provider</p>
          <p className="mb-[10px] break-all text-[14px]">{data.customDomain}</p>
          <div className="lib-table-wrap">
          <table className="lib-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Value</th>
                <th>TTL</th>
              </tr>
            </thead>
            <tbody>
              {data.domainRecords.map((record) => (
                <tr key={`${record.type}-${record.name}`}>
                  <td data-label="Type">{record.type}</td>
                  <td data-label="Name">{record.name}</td>
                  <td data-label="Value">{record.value}</td>
                  <td data-label="TTL">{record.ttl}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="mt-[8px] text-[13px] text-textItemBlur">{checkedLabel(data.domainCheckedAt)}</p>
          <div className="mt-[14px] flex justify-end">
            <button type="button" className={linkPrimary} onClick={() => setRecordsOpen(false)}>
              Done
            </button>
          </div>
        </LinkModal>
      ) : null}
    </div>
  );
};
