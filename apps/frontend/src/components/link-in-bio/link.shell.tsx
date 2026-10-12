'use client';

import { ReactNode } from 'react';
import './link.scss';

export const LinkShell = ({ children }: { children: ReactNode }) => {
  return <div className="lib-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>;
};

export const LinkSplit = ({
  children,
  preview,
  previewOpen,
  onPreviewClose,
}: {
  children: ReactNode;
  preview?: ReactNode;
  previewOpen?: boolean;
  onPreviewClose?: () => void;
}) => (
  <div className="lib-split flex min-h-0 min-w-0 flex-1 gap-[16px] overflow-hidden">
    <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pe-[4px]">{children}</div>
    {preview ? (
      <aside
        className={previewOpen ? 'lib-preview-col is-open' : 'lib-preview-col'}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onPreviewClose?.();
          }
        }}
      >
        {preview}
      </aside>
    ) : null}
  </div>
);

export const LinkPreview = ({
  children,
  onCopy,
}: {
  children: ReactNode;
  onCopy: () => void;
}) => (
  <div className="lib-preview flex w-full max-w-[320px] flex-col items-center gap-[10px]">
    <div className="flex w-full items-center justify-between text-[14px]">
      <span>Preview</span>
      <button type="button" className="text-textItemBlur" onClick={onCopy}>
        Copy link
      </button>
    </div>
    <div className="lib-phone">{children}</div>
  </div>
);
