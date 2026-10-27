'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { UserDetailDto } from '@gitroom/nestjs-libraries/dtos/users/user.details.dto';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useSWRConfig } from 'swr';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import { TeamsComponent } from '@gitroom/frontend/components/settings/teams.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import EmailNotificationsComponent from '@gitroom/frontend/components/settings/email-notifications.component';
import DeleteAccountComponent from '@gitroom/frontend/components/settings/delete-account.component';
import { BillingComponent } from '@gitroom/frontend/components/billing/billing.component';
import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';
import { ChangeLanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import dynamic from 'next/dynamic';

const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  { ssr: false }
);

export const accountSections = [
  { id: 'profile', label: 'Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'billing', label: 'Billing' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'security', label: 'Security' },
  { id: 'delete', label: 'Delete account' },
] as const;

export type AccountSectionId = (typeof accountSections)[number]['id'];

export const accountSectionFrom = (value: string | null | undefined): AccountSectionId =>
  accountSections.some((item) => item.id === value)
    ? (value as AccountSectionId)
    : 'profile';

const initialsOf = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '•';

const AccountProfile = () => {
  const t = useT();
  const fetch = useFetch();
  const toast = useToaster();
  const { mutate } = useSWRConfig();
  const user = useUser();
  const nameRef = useRef(user?.name || '');
  nameRef.current = user?.name || '';
  const resolver = useMemo(() => classValidatorResolver(UserDetailDto), []);
  const form = useForm({
    resolver,
    defaultValues: {
      fullname: user?.name || '',
      bio: '',
      picture: null as { id: string; path: string } | null,
    },
  });
  const picture = form.watch('picture');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const removeRef = useRef<HTMLDivElement>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const loadProfile = useCallback(async () => {
    const personal = await (await fetch('/user/personal')).json();
    formRef.current.setValue(
      'fullname',
      (typeof personal?.name === 'string' && personal.name.trim()) || nameRef.current
    );
    formRef.current.setValue('bio', personal.bio || '');
    formRef.current.setValue('picture', personal.picture);
  }, [fetch]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!confirmRemove) return;
    const onPointer = (event: MouseEvent) => {
      if (!removeRef.current?.contains(event.target as Node)) {
        setConfirmRemove(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setConfirmRemove(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [confirmRemove]);

  const openMedia = useCallback(() => {
    showMediaBox((values) => {
      form.setValue('picture', values);
    });
  }, [form]);

  const removePicture = useCallback(() => {
    form.setValue('picture', null);
    setConfirmRemove(false);
  }, [form]);

  const submit = useCallback(
    async (val: {
      fullname: string;
      bio: string;
      picture: { id: string; path?: string } | null;
    }) => {
      setSaving(true);
      try {
        const response = await fetch('/user/personal', {
          method: 'POST',
          body: JSON.stringify({
            fullname: val.fullname,
            bio: val.bio || '',
            picture: val.picture?.id ? { id: val.picture.id } : null,
          }),
        });
        if (!response.ok) {
          toast.show(t('could_not_update_profile', 'Could not update profile'), 'error');
          return;
        }
        const saved = await response.json();
        formRef.current.setValue('picture', saved?.picture ?? null);
        await mutate(
          '/user/self',
          (current: any) =>
            current
              ? {
                  ...current,
                  name: typeof saved?.name === 'string' ? saved.name : val.fullname,
                  picture: saved?.picture ?? null,
                }
              : current,
          { revalidate: true }
        );
        toast.show(t('profile_updated', 'Profile updated'), 'success');
      } catch {
        toast.show(t('could_not_update_profile', 'Could not update profile'), 'error');
      } finally {
        setSaving(false);
      }
    },
    [fetch, mutate, t, toast]
  );

  const photo = picture?.path || '';
  const email = user?.email || '';

  return (
    <FormProvider {...form}>
      <form
        className="settings-section"
        onSubmit={form.handleSubmit(submit, () => {
          toast.show(t('could_not_update_profile', 'Could not update profile'), 'error');
        })}
      >
        <div className="settings-head">
          <h1>{t('profile', 'Profile')}</h1>
        </div>
        <div className="account-photo">
          <span className="account-photo-face" aria-hidden>
            {photo ? (
              <img src={photo} alt="" />
            ) : (
              <span>{initialsOf(user?.name || email)}</span>
            )}
          </span>
          <div className="account-photo-actions">
            <Button type="button" secondary className="rounded-full" onClick={openMedia}>
              {t('change_photo', 'Change photo')}
            </Button>
            {!!photo && (
              <div className="account-remove" ref={removeRef}>
                <Button
                  type="button"
                  secondary
                  className="rounded-full"
                  aria-expanded={confirmRemove}
                  onClick={() => setConfirmRemove((open) => !open)}
                >
                  {t('remove', 'Remove')}
                </Button>
                {confirmRemove && (
                  <div className="account-remove-pop" role="dialog" aria-label={t('remove', 'Remove')}>
                    <button type="button" onClick={() => setConfirmRemove(false)}>
                      {t('cancel', 'Cancel')}
                    </button>
                    <button type="button" className="is-remove" onClick={removePicture}>
                      {t('remove', 'Remove')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <input type="hidden" {...form.register('bio')} />
        <Input
          label={t('name', 'Name')}
          translationKey="label_name"
          name="fullname"
          removeError
        />
        <label className="account-email">
          <span>{t('email', 'Email')}</span>
          <input value={email} readOnly tabIndex={-1} aria-readonly="true" />
        </label>
        <Button type="submit" loading={saving} className="bg-btnPrimary">
          {t('save_profile', 'Save profile')}
        </Button>
      </form>
    </FormProvider>
  );
};

const AccountWorkspace = () => {
  const t = useT();
  const user = useUser();
  const { isGeneral } = useVariables();
  const showTeam = !!user?.tier?.team_members && isGeneral;

  return (
    <div className="account-stack">
      <div className="settings-section">
        <div className="settings-head">
          <h1>{t('workspace', 'Workspace')}</h1>
        </div>
        <OrganizationSelector asOpenSelect />
      </div>
      {showTeam ? <TeamsComponent /> : null}
    </div>
  );
};

const planTitle = (current: string | undefined) => {
  const name = (current || 'FREE').toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const AccountBillingEmpty = ({ note }: { note?: string }) => {
  const t = useT();
  const user = useUser();
  const posts = user?.tier?.posts_per_month || 0;
  const limit = user?.tier?.channel || 0;
  const used = user?.totalChannels || 0;
  const postLine =
    posts > 10000 ? 'Unlimited posts' : posts ? `${posts} posts / month` : 'No monthly posts';
  const usage = limit ? `${used} of ${limit} channels · ${postLine}` : postLine;

  return (
    <div className="account-billing-empty">
      <p className="account-billing-kicker">{t('current_plan', 'Current plan')}</p>
      <h2>{planTitle(user?.tier?.current)}</h2>
      <p className="account-note">{usage}</p>
      {note ? <p className="account-note">{note}</p> : null}
      <Button type="button" secondary className="rounded-full" disabled>
        {t('manage_plan', 'Manage plan')}
      </Button>
    </div>
  );
};

const AccountBilling = () => {
  const t = useT();
  const user = useUser();
  const { billingEnabled } = useVariables();
  const canBill =
    !!billingEnabled &&
    (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN');

  return (
    <div className="settings-section">
      <div className="settings-head">
        <h1>{t('billing_and_plan', 'Billing & plan')}</h1>
      </div>
      {canBill ? (
        <BillingComponent surface="account" />
      ) : (
        <AccountBillingEmpty
          note={
            billingEnabled
              ? t('billing_admin_only', 'An admin manages the plan.')
              : undefined
          }
        />
      )}
    </div>
  );
};

const AccountNotifications = () => {
  const t = useT();
  return (
    <div className="settings-section">
      <div className="settings-head">
        <h1>{t('notifications', 'Notifications')}</h1>
      </div>
      <div className="settings-group">
        <EmailNotificationsComponent />
      </div>
    </div>
  );
};

const AccountAppearance = () => {
  const t = useT();
  return (
    <div className="settings-section">
      <div className="settings-head">
        <h1>{t('appearance', 'Appearance')}</h1>
      </div>
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row-title">{t('theme', 'Theme')}</div>
          <ModeComponent control="segmented" />
        </div>
        <div className="settings-row">
          <div className="settings-row-title">{t('language', 'Language')}</div>
          <div className="account-languages">
            <ChangeLanguageComponent />
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountSecurity = () => {
  const t = useT();
  const fetch = useFetch();
  const user = useUser();
  const email = user?.email || '';
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const sendReset = useCallback(async () => {
    if (!email || sending) return;
    setSending(true);
    try {
      await fetch('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({
          email,
          provider: 'LOCAL',
        }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }, [email, fetch, sending]);

  return (
    <div className="settings-section">
      <div className="settings-head">
        <h1>{t('security', 'Security')}</h1>
      </div>
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row-title">{t('password', 'Password')}</div>
          <Button
            type="button"
            secondary
            className="rounded-full"
            onClick={sendReset}
            disabled={sending || sent || !email}
          >
            {sent
              ? t('reset_link_sent', 'Reset link sent')
              : t('reset_password', 'Reset password')}
          </Button>
        </div>
        <div className="settings-row">
          <div className="settings-row-title">{t('log_out', 'Log out')}</div>
          <div className="settings-nav-foot">
            <LogoutComponent label={t('log_out', 'Log out')} />
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountDelete = () => (
  <div className="settings-section">
    <DeleteAccountComponent />
  </div>
);

export const AccountSettings = ({
  section,
  onSection,
}: {
  section?: AccountSectionId;
  onSection?: (section: AccountSectionId) => void;
}) => {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const querySection = accountSectionFrom(params.get('section'));
  const [localSection, setLocalSection] = useState<AccountSectionId>('profile');
  const active = section || localSection;

  useEffect(() => {
    if (!section) setLocalSection(querySection);
  }, [querySection, section]);

  const choose = useCallback(
    (next: string) => {
      const id = accountSectionFrom(next);
      if (onSection) onSection(id);
      else setLocalSection(id);
      router.replace(`/account?section=${id}`, { scroll: false });
    },
    [onSection, router]
  );

  const labels: Record<AccountSectionId, string> = {
    profile: t('profile', 'Profile'),
    workspace: t('workspace', 'Workspace'),
    billing: t('billing', 'Billing'),
    notifications: t('notifications', 'Notifications'),
    appearance: t('appearance', 'Appearance'),
    security: t('security', 'Security'),
    delete: t('delete_account', 'Delete account'),
  };

  return (
    <div className="settings-screen account-screen">
      <div className="settings-main">
        <header className="settings-head-v2">
          <h1 id="account-settings-title">{t('account', 'Account')}</h1>
        </header>
        <SegmentedControl
          variant="pill"
          className="settings-settabs"
          aria-label={t('account', 'Account')}
          value={active}
          onValueChange={choose}
          options={accountSections.map((item) => ({
            value: item.id,
            label: labels[item.id],
          }))}
        />
        <div className="settings-detail">
          {active === 'profile' && <AccountProfile />}
          {active === 'workspace' && <AccountWorkspace />}
          {active === 'billing' && <AccountBilling />}
          {active === 'notifications' && <AccountNotifications />}
          {active === 'appearance' && <AccountAppearance />}
          {active === 'security' && <AccountSecurity />}
          {active === 'delete' && <AccountDelete />}
        </div>
      </div>
    </div>
  );
};
