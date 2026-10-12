import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import React, { FC } from 'react';
import { Button } from '@gitroom/react/form/button';
import copy from 'copy-to-clipboard';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const DummyCodeComponent: FC<{ code: any }> = ({ code }) => {
  const modal = useModals();
  const toaster = useToaster();

  return (
    <div className="rounded-[4px] border border-customColor6 bg-sixth px-[16px] pb-[16px] relative w-full">
      <TopTitle title={`Output`}>
        <Button
          className="mr-[50px]"
          onClick={() => {
            copy(JSON.stringify(code, null, 2));
            toaster.show('Code copied to clipboard', 'success');
          }}
        >
          Copy Code
        </Button>
      </TopTitle>
      <button
        className="outline-none absolute end-[20px] top-[20px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
        type="button"
        onClick={() => modal.closeAll()}
      >
        <HugeIcon name="close" size={16} />
      </button>
      <pre>{JSON.stringify(code, null, 2)}</pre>
    </div>
  );
};
