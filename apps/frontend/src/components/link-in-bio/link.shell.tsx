'use client';

import { ReactNode } from 'react';
import './link.scss';

export const LinkShell = ({ children }: { children: ReactNode }) => {
  return <div className="lib-shell flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
};

export const LinkSplit = ({
  children,
  preview,
  previewOpen,
}: {
  children: ReactNode;
  preview?: ReactNode;
  previewOpen?: boolean;
}) => (
  <div className="flex min-h-0 flex-1 gap-[16px] overflow-hidden">
    <div className="min-w-0 flex-1 overflow-y-auto pe-[4px]">{children}</div>
    {preview ? <aside className={previewOpen ? 'lib-preview-col is-open' : 'lib-preview-col'}>{preview}</aside> : null}
  </div>
);

export const LinkPreview = ({
  children,
  onCopy,
}: {
  children: ReactNode;
  onCopy: () => void;
}) => (
  <div className="flex flex-col items-center gap-[10px]">
    <div className="flex w-[320px] items-center justify-between text-[14px]">
      <span>Preview</span>
      <button type="button" className="text-textItemBlur" onClick={onCopy}>
        Copy link
      </button>
    </div>
    <div className="lib-phone">{children}</div>
  </div>
);
