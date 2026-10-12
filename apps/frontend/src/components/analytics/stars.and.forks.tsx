'use client';

import { FC } from 'react';
import { StarsAndForksInterface } from '@gitroom/frontend/components/analytics/stars.and.forks.interface';
import { Chart } from '@gitroom/frontend/components/analytics/chart';
import { UtcToLocalDateRender } from '@gitroom/react/helpers/utc.date.render';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
export const StarsAndForks: FC<StarsAndForksInterface> = (props) => {
  const { list } = props;
  const t = useT();
  return (
    <>
      {list.map((item) => (
        <div className="flex gap-[24px] h-[272px]" key={item.login}>
          <div className="flex-1 bg-secondary py-[10px] px-[16px] flex flex-col">
            <div className="flex items-center gap-[14px]">
              <div className="bg-fifth p-[8px]">
                <HugeIcon name="star" size={20} className="text-white" />
              </div>
              <div className="text-[20px]">
                {item.login
                  .split('/')[1]
                  .split('')
                  .map((char, index) =>
                    index === 0 ? char.toUpperCase() : char
                  )
                  .join('')}
                {t('stars', 'Stars')}
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="absolute w-full h-full start-0 top-0">
                {item.stars.length ? (
                  <Chart list={item.stars} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    {t('processing_stars', 'Processing stars...')}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[50px] leading-[60px]">
              {item?.stars[item.stars.length - 1]?.totalStars}
            </div>
          </div>

          <div className="flex-1 bg-secondary py-[10px] px-[16px] flex flex-col">
            <div className="flex items-center gap-[14px]">
              <div className="bg-fifth p-[8px]">
                <HugeIcon name="git-fork" size={20} className="text-white" />
              </div>
              <div className="text-[20px]">
                {item.login
                  .split('/')[1]
                  .split('')
                  .map((char, index) =>
                    index === 0 ? char.toUpperCase() : char
                  )
                  .join('')}
                {t('forks', 'Forks')}
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="absolute w-full h-full start-0 top-0">
                {item.forks.length ? (
                  <Chart list={item.forks} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    {t('processing_stars', 'Processing stars...')}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[50px] leading-[60px]">
              {item?.forks[item.forks.length - 1]?.totalForks}
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-[24px]">
        {[0, 1].map((p) => (
          <div
            key={p}
            className="flex-1 bg-secondary py-[24px] px-[16px] gap-[16px] flex flex-col"
          >
            <div className="flex items-center gap-[14px]">
              <div className="p-[8px] bg-fifth">
                {p === 0 ? (
                  <HugeIcon name="trade-up" size={20} className="text-white" />
                ) : (
                  <HugeIcon name="arrow-up-right" size={20} className="text-white" />
                )}
              </div>
              <div className="text-[20px]">
                {p === 0
                  ? t('last_github_trending', 'Last Github Trending')
                  : t('next_predicted_github_trending', 'Next Predicted GitHub Trending')}
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-[2px] h-[30px] bg-customColor11 me-[16px]"></div>
              <div className="text-[24px] flex-1">
                <UtcToLocalDateRender
                  date={
                    p === 0 ? props.trending.last : props.trending.predictions
                  }
                  format="dddd"
                />
              </div>
              <div
                className={clsx(
                  'text-[24px]',
                  p === 0 ? 'text-customColor12' : 'text-customColor13'
                )}
              >
                <UtcToLocalDateRender
                  date={
                    p === 0 ? props.trending.last : props.trending.predictions
                  }
                  format="DD MMM YYYY"
                />
              </div>
              <div>
                <div className="rounded-full bg-customColor14 w-[5px] h-[5px] mx-[8px]" />
              </div>
              <div
                className={clsx(
                  'text-[24px]',
                  p === 0 ? 'text-customColor12' : 'text-customColor13'
                )}
              >
                <UtcToLocalDateRender
                  date={
                    p === 0 ? props.trending.last : props.trending.predictions
                  }
                  format="HH:mm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
