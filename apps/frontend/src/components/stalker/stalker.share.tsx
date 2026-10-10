'use client';

import { useEffect, useState } from 'react';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { decodeHtmlEntities, normalizeHandle } from '@gitroom/helpers/utils/stalker.text';

type Board = {
  project: { name: string; description: string; color: string };
  mentions: Array<{
    id: string;
    authorName: string;
    authorHandle: string;
    text: string;
    source: string;
    sentiment: string;
    createdAt: string;
    url: string;
    category: string;
  }>;
  analytics: {
    totals: { mentions: number; positive: number; negative: number; neutral: number };
    bySource: Array<{ source: string; count: number }>;
    byCategory: Array<{ name: string; count: number }>;
  };
};

export const StalkerShare = ({ token }: { token: string }) => {
  const { backendUrl } = useVariables();
  const [board, setBoard] = useState<Board | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const response = await fetch(`${backendUrl}/public/stalker/${encodeURIComponent(token)}`);
      if (!response.ok) {
        if (!cancel) setMissing(true);
        return;
      }
      const payload = (await response.json()) as Board;
      if (!cancel) setBoard(payload);
    };
    load().catch(() => {
      if (!cancel) setMissing(true);
    });
    return () => {
      cancel = true;
    };
  }, [backendUrl, token]);

  if (missing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-newBgColorInner text-newTextColor">
        <p className="text-[15px] text-textItemBlur">This dashboard is not public.</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-newBgColorInner text-[14px] text-textItemBlur">
        Loading dashboard…
      </div>
    );
  }

  const total = board.analytics?.totals?.mentions || 0;

  return (
    <div className="min-h-screen bg-newBgLineColor px-[20px] py-[28px] text-newTextColor">
      <div className="mx-auto flex max-w-[860px] flex-col gap-[16px]">
        <header className="flex items-center gap-[10px]">
          <span
            className="h-[12px] w-[12px] rounded-full"
            style={{ backgroundColor: board.project.color || '#71717a' }}
          />
          <div>
            <h1 className="text-[22px] font-[600]">{board.project.name}</h1>
            {board.project.description ? (
              <p className="text-[13px] text-textItemBlur">{board.project.description}</p>
            ) : null}
          </div>
        </header>
        <p className="text-[13px] text-textItemBlur">Read-only · last 30 days · {total} mentions</p>
        <section className="grid gap-[12px] sm:grid-cols-3">
          {(board.analytics?.bySource || []).map((row) => (
            <div key={row.source} className="rounded-[26px] border border-newBorder bg-newBgColorInner p-[16px] shadow-[var(--arc-shadow-resting)]">
              <p className="text-[12px] text-textItemBlur">{row.source}</p>
              <p className="text-[18px] font-[600]">{row.count}</p>
            </div>
          ))}
        </section>
        <ul className="flex flex-col gap-[8px]">
          {(board.mentions || []).map((mention) => (
            <li key={mention.id} className="rounded-[20px] border border-newBorder bg-newBgColorInner p-[16px] shadow-[var(--arc-shadow-resting)]">
              <p className="text-[13px] font-[600]">
                {decodeHtmlEntities(mention.authorName)}{' '}
                <span className="font-[500] text-textItemBlur">@{normalizeHandle(mention.authorHandle)}</span>
              </p>
              <p className="mt-[6px] text-[14px] leading-[1.5]">{decodeHtmlEntities(mention.text)}</p>
              <p className="mt-[6px] text-[12px] text-textItemBlur">
                {mention.sentiment}
                {mention.category ? ` · ${mention.category}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
