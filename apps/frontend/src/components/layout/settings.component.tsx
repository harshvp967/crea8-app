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
import { TeamsComponent } from '@gitroom/frontend/components/settings/teams.component';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';
import { useSearchParams } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { PublicComponent } from '@gitroom/frontend/components/public-api/public.component';
import Link from 'next/link';
import { Webhooks } from '@gitroom/frontend/components/webhooks/webhooks';
import { Sets } from '@gitroom/frontend/components/sets/sets';
import { SignaturesComponent } from '@gitroom/frontend/components/settings/signatures.component';
import { Autopost } from '@gitroom/frontend/components/autopost/autopost';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { GlobalSettings } from '@gitroom/frontend/components/settings/global.settings';
import { BrandVoiceSettings } from '@gitroom/frontend/components/settings/brand.voice';
import { ApprovedAppsComponent } from '@gitroom/frontend/components/approved-apps/approved-apps.component';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';

const SettingsPageHead: FC<{
  t: ReturnType<typeof useT>;
  showLogout: boolean;
}> = ({ t, showLogout }) => (
  <header className="settings-head-v2">
    <div className="settings-kicker">
      <span className="settings-sticker">{t('schedule', 'Schedule')}</span>
      <span className="settings-period">
        {t('settings_kicker', 'Team, webhooks & API keys')}
      </span>
    </div>
    <h1>{t('settings', 'Settings')}</h1>
    {showLogout && (
      <div className="settings-nav-foot">
        <LogoutComponent />
      </div>
    )}
  </header>
);

const SkeletonBar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-[12px] bg-newBoxHover ${className}`} />
);

export const SettingsPageSkeleton = () => {
  return (
    <div className="flex flex-1 min-h-0 w-full">
      <div className="bg-newBgColorInner p-[20px] flex flex-col gap-[15px] w-[260px]">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBar key={index} className="h-[36px] w-full" />
        ))}
        <div className="mt-auto">
          <SkeletonBar className="h-[40px] w-[120px]" />
        </div>
      </div>
      <div className="bg-newBgColorInner flex-1 flex flex-col p-[20px] gap-[16px]">
        <SkeletonBar className="h-[28px] w-[180px]" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[16px] border border-newBorder p-[24px] flex flex-col gap-[16px]"
          >
            <SkeletonBar className="h-[18px] w-[160px]" />
            <SkeletonBar className="h-[44px] w-full" />
            <SkeletonBar className="h-[44px] w-[70%]" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const SettingsPopup: FC<{
  getRef?: Ref<any>;
}> = (props) => {
  const { isGeneral } = useVariables();
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
  const url = useSearchParams();
  const showLogout = !url.get('onboarding') || user?.tier?.current === 'FREE';
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

  const [tab, setTab] = useState('global_settings');

  const t = useT();
  const list = useMemo(() => {
    const arr = [];
    arr.push({ tab: 'global_settings', label: t('global_settings', 'Global Settings') });
    // Populate tabs based on user permissions
    if (user?.tier?.team_members && isGeneral) {
      arr.push({ tab: 'teams', label: t('teams', 'Teams') });
    }
    if (user?.tier?.webhooks) {
      arr.push({ tab: 'webhooks', label: t('webhooks_1', 'Webhooks') });
    }
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
    if (user?.tier?.public_api && isGeneral && showLogout) {
      arr.push({ tab: 'api', label: t('developers', 'Developers') });
    }
    arr.push({ tab: 'approved_apps', label: t('approved_apps', 'Approved Apps') });

    return arr;
  }, [user, isGeneral, showLogout, t]);

  useEffect(() => {
    loadProfile();
  }, []);

  const sectionButton = (tabKey: string, label: string) => (
    <button
      key={tabKey}
      type="button"
      role="tab"
      aria-selected={tabKey === tab}
      className={clsx('settings-tab', tabKey === tab && 'is-on')}
      onClick={() => setTab(tabKey)}
    >
      {label}
    </button>
  );

  return (
    <div className="settings-screen">
      <aside className="settings-nav">
        <h2>{t('settings', 'Settings')}</h2>
        <div className="settings-tabs">
          {list.map(({ tab: tabKey, label }) => sectionButton(tabKey, label))}
        </div>
      </aside>
      <div className="settings-main">
        <SettingsPageHead t={t} showLogout={showLogout} />
        <SegmentedControl
          variant="pill"
          className="settings-settabs"
          aria-label={t('settings', 'Settings')}
          value={tab}
          onValueChange={setTab}
          options={list.map(({ tab: tabKey, label }) => ({
            value: tabKey,
            label,
          }))}
        />
        <FormProvider {...form}>
          <form className="settings-form-page" onSubmit={form.handleSubmit(submit)}>
            {!!getRef && (
              <button type="submit" className="hidden" ref={getRef}></button>
            )}
            <div className="settings-detail">
              {tab === 'global_settings' && (
                <div>
                  <GlobalSettings />
                </div>
              )}
              {tab === 'brand_voice' && !!user?.aiDrafts && (
                <div>
                  <BrandVoiceSettings />
                </div>
              )}
              {tab === 'teams' && !!user?.tier?.team_members && isGeneral && (
                <div>
                  <TeamsComponent />
                </div>
              )}

              {tab === 'webhooks' && !!user?.tier?.webhooks && (
                <div>
                  <Webhooks />
                </div>
              )}

              {tab === 'autopost' && !!user?.tier?.autoPost && (
                <div>
                  <Autopost />
                </div>
              )}

              {tab === 'sets' && user?.tier.current !== 'FREE' && (
                <div>
                  <Sets />
                </div>
              )}

              {tab === 'signatures' && user?.tier.current !== 'FREE' && (
                <div>
                  <SignaturesComponent />
                </div>
              )}

              {tab === 'api' &&
                !!user?.tier?.public_api &&
                isGeneral &&
                showLogout && (
                  <div>
                    <PublicComponent />
                  </div>
                )}

              {tab === 'approved_apps' && (
                <div>
                  <ApprovedAppsComponent />
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
