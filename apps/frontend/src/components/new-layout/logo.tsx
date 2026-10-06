'use client';

import Link from 'next/link';
import { Crea8oneWordmark } from '@gitroom/frontend/components/ui/logo-text.component';

export const Logo = ({ compact = false }: { compact?: boolean }) => {
  return (
    <Link
      href="/launches"
      prefetch={true}
      className="flex items-center shrink-0 ps-[4px] pe-[8px]"
      title="Crea8one"
    >
      <Crea8oneWordmark
        className={
          compact
            ? 'h-[40px] w-auto max-w-[148px]'
            : 'h-[52px] w-auto max-w-[220px]'
        }
      />
    </Link>
  );
};
