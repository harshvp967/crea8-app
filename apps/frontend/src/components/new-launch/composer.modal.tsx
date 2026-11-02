'use client';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import React, { useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { NoChannels } from '@gitroom/frontend/components/launches/add.provider.component';
import type { AddEditModalProps } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { ComposerFrameSkeleton } from '@gitroom/frontend/components/ui/skeleton';

dayjs.extend(utc);

const loadComposer = () =>
  import('@gitroom/frontend/components/new-launch/add.edit.modal');

export const ComposerFrame = () => <ComposerFrameSkeleton />;

type ComposerModalProps = Omit<AddEditModalProps, 'date'> & {
  date?: dayjs.Dayjs;
};

// The editor, channel previews, and assistant stay out of the first load.
// The frame is up immediately; the slot request and the module load together.
export const ComposerModal = (props: ComposerModalProps) => {
  const fetch = useFetch();
  const modal = useModals();
  // No channels: /posts/find-slot never returns, so the pulse frame would stay up.
  const noChannels =
    Array.isArray(props.allIntegrations) && props.allIntegrations.length === 0;
  const [date, setDate] = useState<dayjs.Dayjs | undefined>(props.date);
  const [Modal, setModal] = useState<
    typeof import('@gitroom/frontend/components/new-launch/add.edit.modal').AddEditModal | null
  >(null);

  useEffect(() => {
    if (noChannels) {
      return;
    }
    let cancelled = false;
    loadComposer().then((mod) => {
      if (!cancelled) {
        setModal(() => mod.AddEditModal);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [noChannels]);

  useEffect(() => {
    if (noChannels) {
      return;
    }
    if (props.date) {
      setDate(props.date);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const body = await (await fetch('/posts/find-slot')).json();
        if (cancelled) {
          return;
        }
        setDate(body?.date ? dayjs.utc(body.date).local() : dayjs());
      } catch {
        if (!cancelled) {
          setDate(dayjs());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.date, fetch, noChannels]);

  if (noChannels) {
    return (
      <NoChannels
        fill
        onClose={() => {
          props.customClose?.();
          modal.closeById('add-edit-modal');
        }}
      />
    );
  }

  if (!Modal || !date) {
    return <ComposerFrame />;
  }

  return <Modal {...props} date={date} />;
};
