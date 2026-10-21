'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { LinkRequestError, linkLocked, linkSend, useLinkLeads, useLinkPage, type LinkLead } from '@gitroom/frontend/components/link-in-bio/link.api';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { LinkField, LinkSegments, LinkToggle, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
import { stkCard, stkCardTight, stkIconTile, stkSub, stkTitle } from '@gitroom/frontend/components/stalker/stalker.chrome';

const SOURCE_LOGO: Record<string, string> = {
  instagram: '/icons/platforms/instagram.png',
  x: '/icons/platforms/x.png',
  youtube: '/icons/platforms/youtube.png',
  linkedin: '/icons/platforms/linkedin.png',
  tiktok: '/icons/platforms/tiktok.png',
  facebook: '/icons/platforms/facebook.png',
  reddit: '/icons/platforms/reddit.png',
  pinterest: '/icons/platforms/pinterest.png',
  threads: '/icons/platforms/threads.png',
  bluesky: '/icons/platforms/bluesky.png',
  twitch: '/icons/platforms/twitch.png',
};

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

const countLabel = (label: string, count: number | undefined) => (count === undefined ? label : `${label} · ${count}`);

const StatusPill = ({ status }: { status: LinkLead['status'] }) => (
  <span className={status === 'CONFIRMED' ? 'lib-lead-status lib-lead-ok' : 'lib-lead-status lib-lead-pending'}>
    {status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
  </span>
);

const SourceLabel = ({ source }: { source: string }) => {
  const logo = SOURCE_LOGO[source.trim().toLowerCase()];
  if (!logo) {
    return <>{source}</>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-[8px]">
      <img src={logo} alt="" className="h-[16px] w-[16px] shrink-0 rounded-[4px] object-cover" />
      <span className="truncate">{source}</span>
    </span>
  );
};

export const LinkLeadsScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const page = useLinkPage();
  const [status, setStatus] = useState('');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading, mutate } = useLinkLeads(status, query);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const capture = page.data?.blocks.find((block) => block.type === 'EMAIL_CAPTURE');
  const counts = data?.counts;
  const filters: Array<{ id: string; label: string }> = [
    { id: '', label: countLabel('All', counts?.all) },
    { id: 'CONFIRMED', label: countLabel('Confirmed', counts?.confirmed) },
    { id: 'PENDING', label: countLabel('Pending', counts?.pending) },
  ];

  const exportCsv = async () => {
    setBusy(true);
    try {
      const response = await fetch(
        `/link-in-bio/leads.csv?status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'text/csv' } }
      );
      if (!response.ok) {
        throw new Error('Could not export leads');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'crea8-leads.csv';
      link.click();
      URL.revokeObjectURL(url);
      toast.show('Your CSV will download shortly', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not export leads', 'warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lib-leads flex min-w-0 flex-col gap-[16px] overflow-y-auto pb-[24px]">
      <div className="lib-head flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="lib-kicker">
            <span className="lib-sticker">Link-in-Bio</span>
            <span className="lib-pill lib-pill-live">
              {counts ? `${counts.all.toLocaleString('en-US')} subscribers` : 'Subscribers'}
            </span>
            <span className={`${stkSub} lib-period`}>
              Your leads stay yours: unlimited contacts and CSV export, free.
            </span>
          </div>
          <h1 className={stkTitle}>Leads</h1>
        </div>
        <div className="lib-head-actions flex flex-wrap items-center justify-start gap-[8px] sm:justify-end">
          <button type="button" className={linkSecondary} disabled={busy} onClick={exportCsv}>
            <HugeIcon name="download" size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {error ? null : (
        <div className="flex flex-col items-stretch gap-[8px] md:flex-row md:items-center md:justify-between">
          <div className="max-w-full overflow-x-auto">
            <LinkSegments label="Lead status" value={status} options={filters} onChange={setStatus} />
          </div>
          <label className="lib-search-field relative block w-full md:w-[240px]">
            <HugeIcon name="search" size={16} className="pointer-events-none absolute start-[14px] top-[14px]" />
            <input
              className="lib-input lib-search"
              placeholder="Search emails"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label="Search emails"
            />
          </label>
        </div>
      )}

      {error ? (
        <section className={`${stkCard} stk-state`}>
          <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
            <HugeIcon name="alert" size={20} />
          </span>
          <p className="text-[14px] font-[500]">Could not load leads.</p>
        </section>
      ) : isLoading || !data ? (
        <section className={`${stkCard} lib-loading flex items-center gap-[12px]`}>
          <p className="text-[14px] font-[500] text-textItemBlur">Loading leads…</p>
        </section>
      ) : data.leads.length ? (
        <>
          <section className={`${stkCard} lib-leads-table-wrap overflow-hidden`}>
            <div className="lib-table-wrap">
              <table className="lib-table lib-leads-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Country</th>
                    <th>Signed up from</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((lead) => (
                    <tr key={lead.id}>
                      <td data-label="Name">{lead.name || '—'}</td>
                      <td data-label="Email">{lead.email}</td>
                      <td data-label="Country">{lead.country || '—'}</td>
                      <td data-label="Signed up from">
                        <SourceLabel source={lead.source} />
                      </td>
                      <td data-label="Message">{lead.message || '—'}</td>
                      <td data-label="Status">
                        <StatusPill status={lead.status} />
                      </td>
                      <td data-label="Date">{dayLabel(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="lib-leads-cards">
            {data.leads.map((lead) => (
              <article key={lead.id} className={stkCardTight}>
                <div className="flex items-start justify-between gap-[8px]">
                  <span className="min-w-0 truncate text-[14px] font-[600]">{lead.email}</span>
                  <StatusPill status={lead.status} />
                </div>
                <p className="mt-[4px] text-[13px] font-[500] text-textItemBlur">
                  {[lead.name, lead.country, dayLabel(lead.createdAt)].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-[2px] text-[13px] font-[500] text-textItemBlur">
                  From <SourceLabel source={lead.source} />
                  {lead.message ? ` · ${lead.message}` : ''}
                </p>
              </article>
            ))}
          </div>
        </>
      ) : (
        <section className={`${stkCard} stk-state flex flex-col items-center gap-[8px] py-[28px] text-center`}>
          <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
            <HugeIcon name="mail" size={18} />
          </span>
          <h2 className="text-[16px] font-[600] tracking-[-0.02em]">No leads yet</h2>
          <p className="max-w-[360px] text-[14px] font-[500] text-textItemBlur">
            Turn on Email capture to collect subscribers from your page.
          </p>
          <Link href="/link" className={`${linkPrimary} mt-[8px]`}>
            Email capture
          </Link>
        </section>
      )}

      {capture && counts?.all === 0 ? (
        <section className={`${stkCardTight} flex flex-wrap items-center justify-between gap-[12px]`}>
          <div className="min-w-0">
            <strong className="text-[14px]">Email capture</strong>
            <p className="text-[13px] font-[500] text-textItemBlur">Collecting · {capture.position === 0 ? 'Above links' : 'Below links'}</p>
          </div>
          <LinkToggle
            checked={capture.enabled}
            label="Email capture"
            onChange={async (enabled) => {
              try {
                const next = await linkSend(fetch, `/link-in-bio/blocks/${capture.id}`, 'PUT', { enabled });
                await page.mutate(next, { revalidate: false });
                await mutate();
              } catch (err) {
                toast.show(err instanceof Error ? err.message : 'Could not update email capture', 'warning');
              }
            }}
          />
        </section>
      ) : null}

      {error ? null : <Integrations busy={busy} setBusy={setBusy} />}
    </div>
  );
};

const Integrations = ({ busy, setBusy }: { busy: boolean; setBusy: (value: boolean) => void }) => {
  const fetch = useFetch();
  const toast = useToaster();
  const page = useLinkPage();
  const data = page.data;
  const [mailchimpKey, setMailchimpKey] = useState('');
  const [audience, setAudience] = useState(data?.integrations.mailchimp.audience || '');
  const [convertkitKey, setConvertkitKey] = useState('');
  const [formId, setFormId] = useState(data?.integrations.convertkit.form || '');
  const [webhookUrl, setWebhookUrl] = useState(data?.integrations.webhook.url || '');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [ready, setReady] = useState(false);
  if (data && !ready) {
    setAudience(data.integrations.mailchimp.audience);
    setFormId(data.integrations.convertkit.form);
    setWebhookUrl(data.integrations.webhook.url);
    setReady(true);
  }
  if (!data) {
    return null;
  }
  const save = async (body: Record<string, unknown>) => {
    if (linkLocked(data) && !body.clearMailchimp && !body.clearConvertkit && !body.clearWebhook) {
      toast.show('Lead integrations are on a paid plan', 'warning');
      return;
    }
    setBusy(true);
    try {
      const next = await linkSend(fetch, '/link-in-bio/integrations', 'PUT', body);
      await page.mutate(next, { revalidate: false });
      setMailchimpKey('');
      setConvertkitKey('');
      setWebhookSecret('');
      toast.show('Integrations saved', 'success');
    } catch (err) {
      const message = err instanceof LinkRequestError ? err.message : err instanceof Error ? err.message : 'Could not save integrations';
      toast.show(message, 'warning');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${stkCard} lib-integrations`}>
      <h2 className="text-[16px] font-[600] tracking-[-0.02em]">Integrations{data.paid ? '' : ' (Pro)'}</h2>
      <p className="mb-[16px] mt-[4px] text-[13px] font-[500] text-textItemBlur">
        {linkLocked(data)
          ? 'Mailchimp, ConvertKit and webhooks are on a paid plan.'
          : data.paid
          ? 'New leads are sent to Mailchimp, ConvertKit and your webhook. Keys stay on the server.'
          : 'Mailchimp, ConvertKit and webhooks are on a paid plan. They stay open while plan gating is off. Keys stay on the server.'}{' '}
        {linkLocked(data) ? (
          <Link href="/account?section=billing">
            Upgrade
          </Link>
        ) : null}
      </p>
      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col gap-[8px]">
          <div className="mb-[4px] flex items-center justify-between gap-[8px]">
            <strong className="text-[14px]">Mailchimp</strong>
            <span className="text-[13px] font-[500] text-textItemBlur">
              {data.integrations.mailchimp.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <LinkField label="Mailchimp API key">
            <input
              type="password"
              autoComplete="off"
              placeholder={data.integrations.mailchimp.hint || 'API key'}
              value={mailchimpKey}
              onChange={(event) => setMailchimpKey(event.target.value)}
            />
          </LinkField>
          <LinkField label="Audience id">
            <input value={audience} onChange={(event) => setAudience(event.target.value)} />
          </LinkField>
          <div className="flex gap-[8px]">
            <button type="button" className={linkSecondary} disabled={busy} onClick={() => save({ mailchimpKey, mailchimpAudience: audience })}>
              Save
            </button>
            {data.integrations.mailchimp.connected ? (
              <button type="button" className={linkSecondary} disabled={busy} onClick={() => save({ clearMailchimp: true })}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-[8px]">
          <div className="mb-[4px] flex items-center justify-between gap-[8px]">
            <strong className="text-[14px]">ConvertKit</strong>
            <span className="text-[13px] font-[500] text-textItemBlur">
              {data.integrations.convertkit.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <LinkField label="ConvertKit API key">
            <input
              type="password"
              autoComplete="off"
              placeholder={data.integrations.convertkit.hint || 'API key'}
              value={convertkitKey}
              onChange={(event) => setConvertkitKey(event.target.value)}
            />
          </LinkField>
          <LinkField label="Form id">
            <input value={formId} onChange={(event) => setFormId(event.target.value)} />
          </LinkField>
          <div className="flex gap-[8px]">
            <button type="button" className={linkSecondary} disabled={busy} onClick={() => save({ convertkitKey, convertkitForm: formId })}>
              Save
            </button>
            {data.integrations.convertkit.connected ? (
              <button type="button" className={linkSecondary} disabled={busy} onClick={() => save({ clearConvertkit: true })}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-[8px]">
          <div className="mb-[4px] flex items-center justify-between gap-[8px]">
            <strong className="text-[14px]">Webhook</strong>
            <span className="text-[13px] font-[500] text-textItemBlur">
              {data.integrations.webhook.url ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <LinkField label="Webhook URL">
            <input placeholder="https://" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} />
          </LinkField>
          <LinkField label="Signing secret">
            <input
              type="password"
              autoComplete="off"
              placeholder={data.integrations.webhook.hasSecret ? 'Saved' : 'Optional'}
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
            />
          </LinkField>
          <div className="flex gap-[8px]">
            <button
              type="button"
              className={linkSecondary}
              disabled={busy}
              onClick={() => save({ webhookUrl, ...(webhookSecret ? { webhookSecret } : {}) })}
            >
              Save
            </button>
            {data.integrations.webhook.url ? (
              <button type="button" className={linkSecondary} disabled={busy} onClick={() => save({ clearWebhook: true })}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
