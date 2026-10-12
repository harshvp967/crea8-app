'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { linkSend, useLinkLeads, useLinkPage } from '@gitroom/frontend/components/link-in-bio/link.api';
import { LinkToggle, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';

const filters = [
  { id: '', label: 'All' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PENDING', label: 'Pending' },
];

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

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
    <div className="flex min-w-0 flex-col gap-[16px] overflow-y-auto pb-[24px]">
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <h1 className="text-[22px] font-[600]">Leads</h1>
          <p className="text-[14px] text-textItemBlur">
            {counts ? `${counts.all.toLocaleString('en-US')} subscribers` : 'Subscribers'} · Your leads stay yours:
            unlimited contacts and CSV export, free.
          </p>
        </div>
        <button type="button" className={linkSecondary} disabled={busy} onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <div className="flex flex-wrap gap-[6px]">
          {filters.map((item) => {
            const count = item.id === 'CONFIRMED' ? counts?.confirmed : item.id === 'PENDING' ? counts?.pending : counts?.all;
            return (
              <button
                key={item.id || 'all'}
                type="button"
                className={
                  status === item.id
                    ? 'h-[34px] rounded-[18px] border border-newBorder bg-newBoxHover px-[12px] text-[13px]'
                    : 'h-[34px] rounded-[18px] border border-transparent px-[12px] text-[13px] text-textItemBlur'
                }
                onClick={() => setStatus(item.id)}
              >
                {item.label}
                {count !== undefined ? ` · ${count}` : ''}
              </button>
            );
          })}
        </div>
        <input
          className="h-[40px] w-full min-w-0 rounded-[14px] border border-newBorder bg-transparent px-[12px] text-[14px] sm:max-w-[260px]"
          placeholder="Search emails"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label="Search emails"
        />
      </div>

      {error ? <p className="text-[14px] text-textItemBlur">Could not load leads.</p> : null}
      {isLoading || !data ? (
        <p className="text-[14px] text-textItemBlur">Loading leads…</p>
      ) : data.leads.length ? (
        <div className="min-w-0 overflow-hidden rounded-[20px] border border-newBorder">
          <div className="lib-table-wrap">
          <table className="lib-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Country</th>
                <th>Signed up from</th>
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
                  <td data-label="Signed up from">{lead.source}</td>
                  <td data-label="Status">
                    <span className={lead.status === 'CONFIRMED' ? 'lib-pill lib-pill-green' : 'lib-pill lib-pill-amber'}>
                      {lead.status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                    </span>
                  </td>
                  <td data-label="Date">{dayLabel(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-[8px] py-[64px] text-center">
          <div className="grid h-[44px] w-[44px] place-items-center rounded-[14px] border border-newBorder text-textItemBlur">
            ✉
          </div>
          <h2 className="text-[16px] font-[600]">No leads yet</h2>
          <p className="max-w-[360px] text-[14px] text-textItemBlur">
            Turn on Email capture to collect subscribers from your page.
          </p>
          <Link href="/link" className={linkPrimary}>
            Email capture
          </Link>
        </div>
      )}

      {capture && counts?.all === 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-[12px] rounded-[20px] border border-newBorder px-[16px] py-[14px]">
          <div className="min-w-0">
            <strong className="text-[14px]">Email capture</strong>
            <p className="text-[13px] text-textItemBlur">Collecting · {capture.position === 0 ? 'Above links' : 'Below links'}</p>
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
    </div>
  );
};
