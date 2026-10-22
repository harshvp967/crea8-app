'use client';

import { ReactNode } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { stkClose } from '@gitroom/frontend/components/stalker/stalker.chrome';
import './link.scss';

export const LinkShell = ({ children }: { children: ReactNode }) => {
  return <div className="lib-shell link-screen flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>;
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
        {previewOpen ? (
          <div className="lib-preview-sheet-head">
            <span className="text-[16px] font-[600] tracking-[-0.02em]">Preview</span>
            <button type="button" className={stkClose} aria-label="Close preview" onClick={onPreviewClose}>
              <HugeIcon name="close" size={16} />
            </button>
          </div>
        ) : null}
        {preview}
      </aside>
    ) : null}
  </div>
);

export const LinkViewTabs = ({
  preview,
  onPreview,
}: {
  preview: boolean;
  onPreview: (open: boolean) => void;
}) => (
  <div className="lib-view-tabs min-[1200px]:hidden" role="tablist" aria-label="Page view">
    <button type="button" role="tab" aria-selected={!preview} onClick={() => onPreview(false)}>
      Edit
    </button>
    <button type="button" role="tab" aria-selected={preview} onClick={() => onPreview(true)}>
      Preview
    </button>
  </div>
);

export const LinkPreview = ({
  children,
  onCopy,
  onClose,
}: {
  children: ReactNode;
  onCopy: () => void;
  onClose?: () => void;
}) => (
  <div className={`lib-preview flex w-full flex-col items-center gap-[10px] ${onClose ? 'max-w-[440px]' : 'max-w-[320px]'}`}>
    <div className="lib-preview-tools flex w-full items-center justify-between text-[14px]">
      <span className="font-[600] tracking-[-0.02em]">Live preview</span>
      <span className="inline-flex items-center gap-[14px]">
        <button type="button" className="inline-flex items-center gap-[6px] text-[14px] font-[500]" onClick={onCopy}>
          <HugeIcon name="copy" size={16} />
          Copy link
        </button>
        {onClose ? (
          <button type="button" className="text-[14px] font-[500]" onClick={onClose}>
            Close preview
          </button>
        ) : null}
      </span>
    </div>
    <div className="lib-phone">{children}</div>
  </div>
);
