'use client';

import { FC, useMemo } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const StreakComponent: FC = () => {
  const user = useUser();

  const streakDays = useMemo(() => {
    if (!user?.streakSince) return 0;
    const streakStart = new Date(user.streakSince);
    const now = new Date();
    const diffTime = now.getTime() - streakStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays + 1 <= 0) {
      return 1;
    }

    return diffDays + 1;
  }, [user?.streakSince]);

  const tooltipContent = useMemo(() => {
    if (streakDays === 1) {
      return 'You started your streak today! Keep posting daily to maintain it.';
    }
    return `You're on a ${streakDays} day posting streak! Keep it going!`;
  }, [streakDays]);

  if (!user?.streakSince || streakDays <= 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-[6px] text-orange-500 hover:text-orange-400 cursor-default"
      data-tooltip-id="tooltip"
      data-tooltip-content={tooltipContent}
    >
      <HugeIcon name="flame" size={20} />
      <span className="text-[14px] font-semibold">{streakDays}</span>
    </div>
  );
};
