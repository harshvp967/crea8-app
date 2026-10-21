'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { UserDetailDto } from '@gitroom/nestjs-libraries/dtos/users/user.details.dto';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
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
  const user = useUser();
  const resolver = useMemo(() => classValidatorResolver(UserDetailDto), []);
  const form = useForm({
    resolver,
    defaultValues: {
      fullname: '',
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
    formRef.current.setValue('fullname', personal.name || '');
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
      picture: { id: string; path: string } | null;
    }) => {
      setSaving(true);
      try {
        await fetch('/user/personal', {
          method: 'POST',
          body: JSON.stringify(val),
        });
        toast.show(t('profile_updated', 'Profile updated'));
      } finally {
        setSaving(false);
      }
    },
    [fetch, t, toast]
  );

  const photo = picture?.path || '';
  const email = user?.email || '';

  return (
    <FormProvider {...form}>
      <form className="settings-section" onSubmit={form.handleSubmit(submit)}>
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
            <button type="button" className="account-chip" onClick={openMedia}>
              {t('change_photo', 'Change photo')}
            </button>
            {!!photo && (
              <div className="account-remove" ref={removeRef}>
                <button
                  type="button"
                  className="account-chip"
                  aria-expanded={confirmRemove}
                  onClick={() => setConfirmRemove((open) => !open)}
                >
                  {t('remove', 'Remove')}
                </button>
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
          removeError={false}
        />
        <label className="account-email">
          <span>{t('email', 'Email')}</span>
          <input value={email} readOnly tabIndex={-1} aria-readonly="true" />
          <span className="account-email-note">{t('email_sign_in', 'Used to sign in')}</span>
        </label>
        <Button type="submit" loading={saving} className="account-save">
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
          <h1>{t('workspace_and_team', 'Workspace & team members')}</h1>
        </div>
        <OrganizationSelector asOpenSelect />
      </div>
      {showTeam ? <TeamsComponent /> : null}
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
        <BillingComponent />
      ) : (
        <p className="account-note">
          {billingEnabled
            ? t('billing_admin_only', 'An admin manages the plan.')
            : t('billing_unavailable', 'Billing is unavailable.')}
        </p>
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
        <div className="settings-row account-theme-row">
          <div className="settings-row-copy">
            <div className="settings-row-title">{t('theme', 'Theme')}</div>
            <div className="settings-row-sub">{t('theme_light_dark', 'Light or dark')}</div>
          </div>
          <ModeComponent />
        </div>
        <div className="settings-row">
          <div className="settings-row-copy">
            <div className="settings-row-title">{t('language', 'Language')}</div>
          </div>
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
          <div className="settings-row-copy">
            <div className="settings-row-title">{t('password', 'Password')}</div>
            <div className="settings-row-sub">
              {sent
                ? t('reset_link_sent', 'Reset link sent')
                : t('password_reset_for_account', 'Reset the password for this account')}
            </div>
          </div>
          <button
            type="button"
            className="account-chip"
            onClick={sendReset}
            disabled={sending || sent || !email}
          >
            {sent
              ? t('reset_link_sent', 'Reset link sent')
              : t('reset_password', 'Reset password')}
          </button>
        </div>
        <div className="settings-row">
          <div className="settings-row-copy">
            <div className="settings-row-title">{t('this_browser', 'This browser')}</div>
            <div className="settings-row-sub account-session-email">{email}</div>
          </div>
          <LogoutComponent />
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
  const [mounted, setMounted] = useState(false);
  const [localSection, setLocalSection] = useState<AccountSectionId>('profile');
  const active = section || localSection;

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const close = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/launches');
  }, [router]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.arc-dialog-wrap')) return;
      if (document.querySelector('.account-remove-pop')) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const labels: Record<AccountSectionId, string> = {
    profile: t('profile', 'Profile'),
    workspace: t('workspace', 'Workspace'),
    billing: t('billing', 'Billing'),
    notifications: t('notifications', 'Notifications'),
    appearance: t('appearance', 'Appearance'),
    security: t('security', 'Security'),
    delete: t('delete_account', 'Delete account'),
  };

  if (!mounted) return null;

  return createPortal(
    <div className="account-layer">
      <div className="account-backdrop" onClick={close} />
      <div
        className="account-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
      >
        <div className="account-scroll">
          <div className="settings-screen account-screen">
            <div className="settings-main">
              <header className="settings-head-v2">
                <div className="settings-kicker">
                  <span className="settings-sticker">crea8.one</span>
                </div>
                <h1 id="account-settings-title">
                  {t('account_settings', 'Account settings')}
                </h1>
                <button
                  type="button"
                  className="account-close"
                  onClick={close}
                  aria-label={t('close', 'Close')}
                  autoFocus
                >
                  <HugeIcon name="close" size={16} />
                </button>
              </header>
              <SegmentedControl
                variant="pill"
                className="settings-settabs"
                aria-label={t('account_settings', 'Account settings')}
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
        </div>
      </div>
    </div>,
    document.body
  );
};
