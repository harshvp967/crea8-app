'use client';

import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import React, {
  FC,
  Ref,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { UserDetailDto } from '@gitroom/nestjs-libraries/dtos/users/user.details.dto';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useSWRConfig } from 'swr';
import clsx from 'clsx';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import Link from 'next/link';
import { Sets } from '@gitroom/frontend/components/sets/sets';
import { SignaturesComponent } from '@gitroom/frontend/components/settings/signatures.component';
import { Autopost } from '@gitroom/frontend/components/autopost/autopost';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { BrandVoiceSettings } from '@gitroom/frontend/components/settings/brand.voice';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import { Skeleton } from '@gitroom/frontend/components/ui/skeleton';
import { SchedulePageHead } from '@gitroom/frontend/components/layout/schedule.shell';

export const SettingsPageSkeleton = () => {
  return (
    <div className="settings-screen c8-sched-shell c8-sched-frame">
      <div className="settings-main">
        <header className="c8-sched-head">
          <div className="c8-sched-copy">
            <div className="c8-sched-kicker">
              <Skeleton className="h-[22px] w-[88px] rounded-full" />
            </div>
            <h1 className="c8-sched-title">
              <Skeleton className="h-[28px] w-[148px] max-w-full rounded-full" />
            </h1>
            <div className="c8-sched-sub" />
          </div>
        </header>
        <div className="settings-settabs">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[32px] w-[96px] shrink-0 rounded-full" />
          ))}
        </div>
        <div className="settings-section">
          <div className="settings-head">
            <Skeleton className="h-[22px] w-[140px] rounded-full" />
            <Skeleton className="ms-auto h-[40px] w-[148px] rounded-full" />
          </div>
          <Skeleton className="h-[40px] w-full rounded-[16px]" />
          <Skeleton className="h-[40px] w-full rounded-[16px]" />
        </div>
      </div>
    </div>
  );
};

export const SettingsPopup: FC<{
  getRef?: Ref<any>;
}> = (props) => {
  const { getRef } = props;
  const fetch = useFetch();
  const toast = useToaster();
  const swr = useSWRConfig();
  const user = useUser();
  const resolver = useMemo(() => {
    return classValidatorResolver(UserDetailDto);
  }, []);
  const form = useForm({
    resolver,
  });
  const picture = form.watch('picture');
  const modal = useModals();
  const close = useCallback(() => {
    return modal.closeAll();
  }, []);
  const loadProfile = useCallback(async () => {
    const personal = await (await fetch('/user/personal')).json();
    form.setValue('fullname', personal.name || '');
    form.setValue('bio', personal.bio || '');
    form.setValue('picture', personal.picture);
  }, []);
  const openMedia = useCallback(() => {
    showMediaBox((values) => {
      form.setValue('picture', values);
    });
  }, []);
  const remove = useCallback(() => {
    form.setValue('picture', null);
  }, []);

  const submit = useCallback(async (val: any) => {
    await fetch('/user/personal', {
      method: 'POST',
      body: JSON.stringify(val),
    });
    if (getRef) {
      return;
    }
    toast.show(t('profile_updated', 'Profile updated'));
    close();
  }, []);

  const [tab, setTab] = useState('');

  const t = useT();
  const list = useMemo(() => {
    const arr = [];
    if (user?.tier?.autoPost) {
      arr.push({ tab: 'autopost', label: t('auto_post', 'Auto Post') });
    }
    if (user?.tier.current !== 'FREE') {
      arr.push({ tab: 'sets', label: t('sets', 'Sets') });
    }
    if (user?.tier.current !== 'FREE') {
      arr.push({ tab: 'signatures', label: t('signatures', 'Signatures') });
    }
    if (user?.aiDrafts) {
      arr.push({ tab: 'brand_voice', label: t('brand_voice', 'Brand voice') });
    }

    return arr;
  }, [user, t]);
  const activeTab = list.some((item) => item.tab === tab)
    ? tab
    : list[0]?.tab || '';

  useEffect(() => {
    loadProfile();
  }, []);

  const sectionButton = (tabKey: string, label: string) => (
    <button
      key={tabKey}
      type="button"
      role="tab"
      aria-selected={tabKey === activeTab}
      className={clsx('settings-tab', tabKey === activeTab && 'is-on')}
      onClick={() => setTab(tabKey)}
    >
      {label}
    </button>
  );

  return (
    <div className="settings-screen c8-sched-shell c8-sched-frame">
      <aside className="settings-nav">
        <h2>{t('settings', 'Settings')}</h2>
        <div className="settings-tabs">
          {list.map(({ tab: tabKey, label }) => sectionButton(tabKey, label))}
        </div>
      </aside>
      <div className="settings-main">
        <SchedulePageHead
          title={t('settings', 'Settings')}
          subtitle={list.find((item) => item.tab === activeTab)?.label}
        />
        {list.length > 0 && (
          <SegmentedControl
            variant="pill"
            className="settings-settabs"
            aria-label={t('settings', 'Settings')}
            value={activeTab}
            onValueChange={setTab}
            options={list.map(({ tab: tabKey, label }) => ({
              value: tabKey,
              label,
            }))}
          />
        )}
        <FormProvider {...form}>
          <form className="settings-form-page" onSubmit={form.handleSubmit(submit)}>
            {!!getRef && (
              <button type="submit" className="hidden" ref={getRef}></button>
            )}
            <div className="settings-detail">
              {activeTab === 'brand_voice' && !!user?.aiDrafts && (
                <div>
                  <BrandVoiceSettings />
                </div>
              )}

              {activeTab === 'autopost' && !!user?.tier?.autoPost && (
                <div>
                  <Autopost />
                </div>
              )}

              {activeTab === 'sets' && user?.tier.current !== 'FREE' && (
                <div>
                  <Sets />
                </div>
              )}

              {activeTab === 'signatures' && user?.tier.current !== 'FREE' && (
                <div>
                  <SignaturesComponent />
                </div>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
};
export const SettingsComponent = () => {
  const settings = useModals();
  const user = useUser();
  const openModal = useCallback(() => {
    if (user?.tier.current !== 'FREE') {
      return;
    }
    settings.openModal({
      children: (
        <div className="relative flex gap-[20px] flex-col flex-1 rounded-[4px] border border-customColor6 bg-sixth p-[16px] w-[500px] mx-auto">
          <SettingsPopup />
        </div>
      ),
      classNames: {
        modal: 'bg-transparent text-textColor',
      },
      withCloseButton: false,
      size: '100%',
    });
  }, [user]);
  return (
    <Link href="/settings" onClick={openModal}>
      <HugeIcon
        name="settings"
        size={40}
        className="cursor-pointer relative z-[200]"
      />
    </Link>
  );
};
