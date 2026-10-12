import React, { FC, useCallback, useEffect, useState } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { timer } from '@gitroom/helpers/utils/timer';
import { Button } from '@gitroom/react/form/button';

export const FinishTrial: FC<{ close: () => void }> = (props) => {
  const [finished, setFinished] = useState(false);
  const fetch = useFetch();

  const finishSubscription = useCallback(async () => {
    await fetch('/billing/finish-trial', {
      method: 'POST',
    });
    checkFinished();
  }, []);

  const checkFinished = useCallback(async () => {
    const {finished} = await (await fetch('/billing/is-trial-finished')).json();
    if (!finished) {
      await timer(2000);
      return checkFinished();
    }

    setFinished(true);
  }, []);

  useEffect(() => {
    finishSubscription();
  }, []);

  return (
    <div className="text-textColor fixed start-0 top-0 bg-primary/80 z-[300] w-full h-full p-[60px] animate-fade justify-center flex bg-black/50">
      <div>
        <div className="flex gap-[10px] flex-col w-[500px] h-auto bg-sixth border-tableBorder border-2 rounded-xl pb-[20px] px-[20px] relative">
          <div className="flex">
            <div className="flex-1">
              <TopTitle title={'Finishing Trial'} />
            </div>
            <button
              onClick={props.close}
              className="outline-none absolute end-[10px] top-[10px] mantine-UnstyledButton-root mantine-ActionIcon-root bg-primary hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
              type="button"
            >
              <HugeIcon name="close" size={16} />
            </button>
          </div>
          <div className="relative h-[400px]">
            <div className="absolute left-0 top-0 w-full h-full overflow-hidden overflow-y-auto">
              <div className="mt-[10px] flex w-full justify-center items-center gap-[10px]">
                {!finished && <LoadingComponent height={150} width={150} />}
                {finished && (
                  <div className="flex flex-col">
                    <div>
                      You trial has been successfully finished and you have been charged.
                    </div>
                    <div className="flex gap-[10px] mt-[20px]">
                      <Button className="flex-1" onClick={() => window.close()}>Close window</Button>
                      <Button className="flex-1" onClick={() => props.close()}>Close dialog</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
