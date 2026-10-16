'use client';

import { FC, useCallback } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const Bullets: FC<{
  editor: any;
  currentValue: string;
}> = ({ editor }) => {
  const bullet = () => {
    editor?.commands?.toggleBulletList();
  };
  return (
    <button
      type="button"
      data-tooltip-id="tooltip"
      data-tooltip-content="Bullets"
      aria-label="Bullets"
      onClick={bullet}
      className="c8-tool select-none cursor-pointer rounded-[6px] w-[30px] h-[30px] bg-newColColor flex justify-center items-center"
    >
      <HugeIcon name="list-bullet" size={18} />
    </button>
  );
};
