'use client';
import 'reflect-metadata';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import dayjs from 'dayjs';
import { FC, useEffect, useState } from 'react';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { ManageModal } from '@gitroom/frontend/components/new-launch/manage.modal';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { useShallow } from 'zustand/react/shallow';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import {
  composerDraftKey,
  consumeComposerApplied,
  consumeComposerHandoff,
  clearComposerRestoreFlags,
  consumeComposerRestored,
  draftSnapshot,
  markComposerLayoutRemount,
  stashComposerHandoff,
} from '@gitroom/frontend/components/new-launch/composer.draft';
import {
  editorHtml,
  editorMedia,
  editorSettings,
  editorTags,
  editorValuesFromPosts,
  siblingPublishDate,
} from '@gitroom/frontend/components/new-launch/existing.post';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Post } from '@prisma/client';

export interface AddEditModalProps {
  dummy?: boolean;
  date: dayjs.Dayjs;
  integrations: Integrations[];
  allIntegrations?: Integrations[];
  selectedChannels?: string[];
  customer?: string;
  set?: any;
  focusedChannel?: string;
  addEditSets?: (data: any) => void;
  reopenModal: () => void;
  mutate: () => void;
  padding?: string;
  customClose?: () => void;
  onlyValues?: Array<{
    content: string;
    id?: string;
    image?: Array<{
      id: string;
      path: string;
    }>;
  }>;
}

export const AddEditModal: FC<AddEditModalProps> = (props) => {
  const existingData = useExistingData();
  const draftKey = composerDraftKey(existingData.posts?.[0]?.id);
  const { setAllIntegrations, setDate, setIsCreateSet, setDummy } =
    useLaunchStore(
      useShallow((state) => ({
        setAllIntegrations: state.setAllIntegrations,
        setDate: state.setDate,
        setIsCreateSet: state.setIsCreateSet,
        setDummy: state.setDummy,
      }))
    );

  const integrations = useLaunchStore((state) => state.integrations);
  useEffect(() => {
    const onLayout = () => markComposerLayoutRemount();
    window.addEventListener('resize', onLayout);
    window.addEventListener('orientationchange', onLayout);
    const media = window.matchMedia('(max-width: 767px)');
    media.addEventListener('change', onLayout);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('orientationchange', onLayout);
      media.removeEventListener('change', onLayout);
    };
  }, []);
  useEffect(() => {
    setDummy(!!props.dummy);
    const restored = consumeComposerHandoff<Record<string, unknown>>(draftKey);
    if (restored) {
      useLaunchStore.setState(restored);
    }
    // Clear the flag here so a later open cannot skip the slot date.
    if (!consumeComposerRestored(draftKey)) {
      setDate(props.date || newDayjs());
      setAllIntegrations(props.allIntegrations || []);
      setIsCreateSet(!!props.addEditSets);
    }
    return () => {
      clearComposerRestoreFlags();
    };
  }, []);

  // A rotate remount can reset integrations while this parent stays mounted,
  // so the mount effect above does not run again. Restore only a keyed handoff.
  useEffect(() => {
    if (integrations.length) {
      return;
    }
    const restored = consumeComposerHandoff<Record<string, unknown>>(draftKey);
    if (restored) {
      useLaunchStore.setState(restored);
      return;
    }
    consumeComposerRestored(draftKey);
  }, [integrations.length]);

  useEffect(() => {
    document.querySelector('body')?.classList.add('hideChatbase');
    return () => {
      document.querySelector('body')?.classList.remove('hideChatbase');
    };
  }, []);

  if (!integrations.length) {
    return null;
  }

  return <AddEditModalInner {...props} />;
};

export const AddEditModalInner: FC<AddEditModalProps> = (props) => {
  const existingData = useExistingData();
  const modal = useModals();
  const toaster = useToaster();
  const t = useT();
  const {
    addOrRemoveSelectedIntegration,
    setSelectedIntegrations,
    selectedIntegrations,
    integrations,
  } = useLaunchStore(
    useShallow((state) => ({
      integrations: state.integrations,
      selectedIntegrations: state.selectedIntegrations,
      addOrRemoveSelectedIntegration: state.addOrRemoveSelectedIntegration,
      setSelectedIntegrations: state.setSelectedIntegrations,
    }))
  );
  const [selectionReady, setSelectionReady] = useState(
    () =>
      !existingData.integration &&
      !props?.set?.posts?.length &&
      !props?.selectedChannels?.length
  );

  useEffect(() => {
    if (existingData.integration) {
      const integration = integrations.find(
        (i) => i.id === existingData.integration
      );
      if (!integration) {
        toaster.show(
          t(
            'we_are_experiencing_some_difficulty_try_to_refresh_the_page',
            'We are experiencing some difficulty, try to refresh the page'
          ),
          'warning'
        );
        modal.closeAll();
        return;
      }

      // Replace the selection. addOrRemoveSelectedIntegration toggles, so a
      // second run (or a channel already selected) removed the post's channel
      // before the editor effect could read it.
      const picked = [
        {
          selectedIntegrations: integration,
          settings: editorSettings(existingData.settings),
        },
      ];
      for (const sibling of existingData.siblings || []) {
        const siblingIntegration = integrations.find(
          (i) => i.id === sibling.integration
        );
        if (siblingIntegration) {
          picked.push({
            selectedIntegrations: siblingIntegration,
            settings: editorSettings(sibling.settings),
          });
        }
      }
      setSelectedIntegrations(picked);
      setSelectionReady(true);
      return;
    }

    if (props?.set?.posts?.length) {
      for (const post of props?.set?.posts) {
        if (post.integration) {
          const integration = integrations.find(
            (i) => i.id === post.integration.id
          );
          if (integration) {
            addOrRemoveSelectedIntegration(
              integration,
              editorSettings(post.settings)
            );
          }
        }
      }
    }

    if (props?.selectedChannels?.length) {
      for (const channel of props.selectedChannels) {
        const integration = integrations.find((i) => i.id === channel);
        if (integration) {
          addOrRemoveSelectedIntegration(integration, {});
        }
      }
    }

    setSelectionReady(true);
  }, []);

  const postChannelSelected =
    !existingData.integration ||
    selectedIntegrations.some(
      (item) => item.integration?.id === existingData.integration
    );

  if (!selectionReady || !postChannelSelected) {
    return null;
  }

  return <AddEditModalInnerInner {...props} />;
};

// an existing post, as the values of the editor
const postValues = (posts: Post[]) =>
  editorValuesFromPosts(posts, () => makeId(10));

export const AddEditModalInnerInner: FC<AddEditModalProps> = (props) => {
  const existingData = useExistingData();
  const {
    reset,
    setGlobalValue,
    seedInternalValue,
    global,
    setCurrent,
    internal,
    setTags,
    setEditor,
    setRepeater,
    selectedIntegrations,
    setChannelDate,
  } = useLaunchStore(
    useShallow((state) => ({
      reset: state.reset,
      setGlobalValue: state.setGlobalValue,
      seedInternalValue: state.seedInternalValue,
      setCurrent: state.setCurrent,
      global: state.global,
      internal: state.internal,
      setTags: state.setTags,
      setEditor: state.setEditor,
      setRepeater: state.setRepeater,
      selectedIntegrations: state.selectedIntegrations,
      setChannelDate: state.setChannelDate,
    }))
  );

  const draftKey = composerDraftKey(existingData.posts?.[0]?.id);
  const releaseDraft = () => {
    stashComposerHandoff(draftKey, draftSnapshot(useLaunchStore.getState()));
    clearComposerRestoreFlags();
    reset();
  };

  useEffect(() => {
    const restored = consumeComposerHandoff<Record<string, unknown>>(draftKey);
    if (restored) {
      useLaunchStore.setState(restored);
      consumeComposerRestored(draftKey);
      return releaseDraft;
    }
    // The parent already wrote this post's draft back. Clear the flag either way.
    if (consumeComposerApplied(draftKey) || consumeComposerRestored(draftKey)) {
      return releaseDraft;
    }

    if (existingData.integration) {
      if (existingData?.posts?.[0]?.intervalInDays) {
        setRepeater(existingData.posts[0].intervalInDays);
      }
      setTags(editorTags(existingData.posts));

      seedInternalValue(
        existingData.integration,
        postValues(existingData.posts)
      );

      // the other channels the post was created with, each with its own
      // content and date
      for (const sibling of existingData.siblings || []) {
        if (
          !selectedIntegrations.some(
            (p) => p.integration?.id === sibling.integration
          )
        ) {
          continue;
        }

        seedInternalValue(
          sibling.integration,
          postValues(sibling.posts)
        );
        const publishDate = siblingPublishDate(sibling);
        if (publishDate) {
          setChannelDate(sibling.integration, dayjs.utc(publishDate).local());
        }
      }
      setCurrent(existingData.integration);
    } else {
      setEditor('normal');
    }

    if (props.focusedChannel) {
      setCurrent(props.focusedChannel);
    }

    // Replace, don't insert. addGlobalValue appends after index 0, so a second
    // seed left an empty post under the one the user was writing.
    setGlobalValue(
      props.onlyValues?.length
        ? props.onlyValues.map((p) => ({
            content: editorHtml(p.content),
            id: makeId(10),
            media: editorMedia(p.image),
            delay: 0,
          }))
        : props.set?.posts?.length
        ? props.set.posts[0].value.map((p: any, index: number) => ({
            id: makeId(10),
            content: editorHtml(p.content),
            media: editorMedia(p.media),
            delay: 0,
            ...(index > 0 ? { added: true } : {}),
          }))
        : [
            {
              content: '',
              id: makeId(10),
              media: [],
              delay: 0,
            },
          ]
    );

    return releaseDraft;
  }, []);

  if (!global.length && !internal.length) {
    return null;
  }

  return (
    <>
      <style>
        {`#support-discord {display: none !important;}`}
      </style>
      <ManageModal {...props} />
    </>
  );
};
