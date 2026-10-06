'use client';

import Link from 'next/link';
import clsx from 'clsx';
import {
  StalkerScanSource,
  useStalkerProject,
} from '@gitroom/frontend/components/stalker/stalker.project';
import { sourceLabel } from '@gitroom/frontend/components/stalker/stalker.labels';

const sourceName = sourceLabel;

export const ReconnectText = ({ text }: { text: string }) => {
  const match = text.match(/Reconnect YouTube/i);
  if (!match || match.index === undefined) {
    return <span>{text}</span>;
  }
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  return (
    <span>
      {before}
      <Link href="/launches" className="underline">
        Reconnect YouTube
      </Link>
      {after}
    </span>
  );
};

const sourceLine = (source: StalkerScanSource, duplicates: number) => {
  const name = sourceName(source.id);
  if (!source.ok) {
    const error = source.error || 'Scan failed';
    if (error.toLowerCase().startsWith(`${name.toLowerCase()}:`)) {
      return error;
    }
    return `${name}: ${error}`;
  }
  return `${name}: ${scanCounts(source, duplicates)}`;
};

/** "12 found · 9 new · 3 off-topic" — new excludes rows hidden as off-topic. */
export const scanCounts = (source: StalkerScanSource, duplicates = 0) => {
  const found = source.found || 0;
  const stored = source.stored || 0;
  const offTopic = Math.min(stored, source.offTopic || 0);
  const shown = stored - offTopic;
  if (!found && !stored) {
    return 'no new mentions';
  }
  const parts = [`${found} found`, `${shown} new`];
  if (offTopic) parts.push(`${offTopic} off-topic`);
  if (duplicates) parts.push(`${duplicates} duplicates`);
  return parts.join(' · ');
};

export const StalkerCheckNow = ({ compact = false }: { compact?: boolean }) => {
  const { projectId, scanning, scanResult, runScan, previewScan } = useStalkerProject();
  const preview = previewScan;
  const previewError =
    preview === 'error'
      ? 'YouTube: channel token expired. Reconnect YouTube in Channels'
      : '';
  const showScanning = scanning || preview === 'running';
  const sources = previewError
    ? [{ id: 'youtube', ok: false, error: previewError }]
    : preview === 'success'
      ? [{ id: 'youtube', ok: true, searched: 3, found: 15, stored: 12 }]
      : scanResult?.sources || [];
  const duplicates = preview === 'success' ? 3 : scanResult?.totals?.duplicates || 0;
  const showResult = !showScanning && (previewError || preview === 'success' || !!scanResult);
  const topError = previewError || (!sources.length ? scanResult?.error : '');

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={clsx(
          'inline-flex items-center gap-[6px] whitespace-nowrap rounded-full border border-[#00D9FF]/45 bg-[#00D9FF]/10 font-[600] text-newTextColor disabled:opacity-60',
          compact ? 'px-[10px] py-[7px] text-[13px]' : 'px-[14px] py-[8px] text-[13px]'
        )}
        disabled={!projectId || showScanning}
        onClick={() => {
          runScan();
        }}
      >
        {showScanning ? (
          <span
            className="h-[12px] w-[12px] animate-spin rounded-full border border-[#00D9FF] border-t-transparent"
            aria-hidden
          />
        ) : null}
        {showScanning ? 'Scanning YouTube…' : 'Check now'}
      </button>
      {showResult ? (
        <div className="absolute end-0 top-[calc(100%+8px)] z-30 w-[280px] rounded-[14px] border border-newBorder bg-newBgColorInner p-[12px] text-[13px] shadow-[var(--menu-shadow)]">
          {topError && !sources.length ? (
            <p className="text-[#c43b3b]">
              <ReconnectText text={topError} />
            </p>
          ) : (
            <ul className="flex flex-col gap-[6px]">
              {sources.map((source) => (
                <li key={source.id} className={source.ok ? '' : 'text-[#c43b3b]'}>
                  {source.ok ? (
                    sourceLine(source, sources.length === 1 ? duplicates : 0)
                  ) : (
                    <ReconnectText text={sourceLine(source, 0)} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
