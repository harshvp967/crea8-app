'use client';

import { FC, useCallback } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const AComponent: FC<{
  editor: any;
  currentValue: string;
}> = ({ editor }) => {
  const mark = () => {
    const previousUrl = editor?.getAttributes('link')?.href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor?.chain()?.focus()?.extendMarkRange('link')?.unsetLink()?.run();

      return;
    }

    // update link
    try {
      editor
        ?.chain()
        ?.focus()
        ?.extendMarkRange('link')
        ?.setLink({ href: url })
        ?.run();
    } catch (e) {}
    editor?.commands?.focus();
  };
  return (
    <button
      type="button"
      data-tooltip-id="tooltip"
      data-tooltip-content="Link"
      aria-label="Link"
      onClick={mark}
      className="c8-tool select-none cursor-pointer rounded-[6px] flex justify-center items-center"
    >
      <HugeIcon name="link" size={18} />
    </button>
  );
};
