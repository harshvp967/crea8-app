'use client';

import { FC, useCallback } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const HeadingComponent: FC<{
  editor: any;
  currentValue: string;
}> = ({ editor }) => {
  const setHeading = (level: number) => () => {
    editor?.commands?.unsetUnderline();
    editor?.commands?.unsetBold();
    editor?.commands?.toggleHeading({ level });
  };

  return (
    <div className="select-none cursor-pointer rounded-[6px] w-[30px] h-[30px] bg-newColColor flex justify-center items-center group relative">
      <HugeIcon name="heading" size={18} />
      <div
        data-tooltip-id="tooltip"
        data-tooltip-content="Title"
        className="flex p-[10px] gap-[5px] -left-[50%] rounded-[6px] bottom-[100%] opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 bg-newColColor border border-newColColor z-[100] absolute transition-all"
      >
        <div onClick={setHeading(1)}>
          <HugeIcon name="heading-1" size={16} />
        </div>
        <div onClick={setHeading(2)}>
          <HugeIcon name="heading-2" size={16} />
        </div>
        <div onClick={setHeading(3)}>
          <HugeIcon name="heading-3" size={16} />
        </div>
      </div>
    </div>
  );
};
