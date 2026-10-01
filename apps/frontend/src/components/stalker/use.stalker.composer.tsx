'use client';

import { useCallback } from 'react';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

export const useStalkerComposer = () => {
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();

  return useCallback(
    async (body: {
      mentionId?: string;
      themeId?: string;
      mode: 'post' | 'quote';
    }) => {
      const draftResponse = await fetch('/stalker/draft', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const draft = await draftResponse.json().catch(() => null);
      if (!draftResponse.ok || !draft?.content) {
        toaster.show('Could not draft a post from this signal', 'warning');
        return;
      }

      const list = await (await fetch('/integrations/list')).json();
      const integrations: Integrations[] = list?.integrations || [];
      if (!integrations.length) {
        toaster.show('Connect a channel before creating a post', 'warning');
        return;
      }

      modal.openModal({
        id: 'add-edit-modal',
        closeOnClickOutside: false,
        removeLayout: true,
        closeOnEscape: false,
        withCloseButton: false,
        askClose: true,
        fullScreen: true,
        classNames: {
          modal: 'w-[100%] max-w-[1400px] text-textColor',
        },
        children: (
          <AddEditModal
            allIntegrations={integrations.map((item) => ({ ...item }))}
            integrations={integrations.map((item) => ({ ...item }))}
            mutate={() => ({})}
            date={dayjs()}
            reopenModal={() => ({})}
            onlyValues={[{ content: draft.content }]}
          />
        ),
        size: '80%',
      });
    },
    [fetch, modal, toaster]
  );
};
