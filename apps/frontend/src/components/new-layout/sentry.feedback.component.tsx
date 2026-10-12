'use client';

import { FC, useEffect, useRef, useState } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import * as Sentry from '@sentry/nextjs';
import { useVariables } from '@gitroom/react/helpers/variable.context';

export const AttachToFeedbackIcon: FC = () => {
  const { sentryDsn } = useVariables();
  const [feedback, setFeedback] = useState<any>();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!sentryDsn) return;
    try {
      const fb = (Sentry as any).getFeedback?.();
      setFeedback(fb);
    } catch (e) {
      setFeedback(undefined);
    }
  }, [sentryDsn]);

  useEffect(() => {
    if (feedback && buttonRef.current) {
      const unsubscribe = feedback.attachTo(buttonRef.current);
      return unsubscribe;
    }
    return () => {};
  }, [feedback]);

  if (!sentryDsn) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Feedback"
      className="hover:text-newTextColor"
    >
      <HugeIcon name="message" size={20} />
    </button>
  );
};
