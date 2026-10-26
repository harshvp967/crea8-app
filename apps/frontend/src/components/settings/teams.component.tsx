'use client';

import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import React, { useCallback, useMemo } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { capitalize } from 'lodash';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Input } from '@gitroom/react/form/input';
import { useForm, FormProvider } from 'react-hook-form';
import { Select } from '@gitroom/react/form/select';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import copy from 'copy-to-clipboard';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const roles = [
  {
    name: 'User',
    value: 'USER',
  },
  {
    name: 'Admin',
    value: 'ADMIN',
  },
];

async function readMessage(response: Response) {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    if (typeof body?.message === 'string') {
      return body.message;
    }
    if (Array.isArray(body?.message)) {
      return body.message.join(', ');
    }
    if (typeof body?.error === 'string' && body.error !== 'Bad Request') {
      return body.error;
    }
  } catch {
    return text;
  }
  return text || 'Something went wrong';
}

export const AddMember = ({ onDone }: { onDone: () => void }) => {
  const modals = useModals();
  const fetch = useFetch();
  const toast = useToaster();
  const t = useT();
  const resolver = useMemo(() => {
    return classValidatorResolver(AddTeamMemberDto);
  }, []);
  const form = useForm({
    values: {
      email: '',
      role: '',
      sendEmail: true,
    },
    resolver,
    mode: 'onChange',
  });
  const submit = useCallback(
    (sendEmail: boolean) =>
      async (values: { email: string; role: string; sendEmail: boolean }) => {
        if (!values.email.trim()) {
          toast.show(t('enter_email', 'Enter an email'), 'error');
          return;
        }
        const response = await fetch('/settings/team', {
          method: 'POST',
          body: JSON.stringify({ ...values, email: values.email.trim(), sendEmail }),
        });
        if (!response.ok) {
          toast.show(await readMessage(response), 'error');
          return;
        }
        const body = await response.json();
        onDone();
        if (sendEmail && body.sent === false) {
          if (body.url) {
            copy(body.url);
          }
          toast.show(
            body.error || 'Email is not configured. The invite link was copied.',
            'error'
          );
          modals.closeAll();
          return;
        }
        if (!sendEmail) {
          if (body.url) {
            copy(body.url);
          }
          modals.closeAll();
          toast.show(t('link_copied_to_clipboard', 'Link copied to clipboard'));
          return;
        }
        modals.closeAll();
        toast.show(t('invitation_link_sent', 'Invitation link sent'));
      },
    [fetch, modals, onDone, t, toast]
  );

  return (
    <FormProvider {...form}>
      <form className="settings-form" onSubmit={form.handleSubmit(submit(true))}>
        <div className="relative flex gap-[10px] flex-col flex-1 p-[16px] pt-0">
          <Input
            label="Email"
            placeholder={t('enter_email', 'Enter email')}
            name="email"
          />
          <Select label="Role" name="role">
            <option value="">{t('select_role', 'Select Role')}</option>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.name}
              </option>
            ))}
          </Select>
          <div className="flex gap-[10px]">
            <Button type="submit">{t('send_invite', 'Send invite')}</Button>
            <Button
              type="button"
              secondary
              onClick={form.handleSubmit(submit(false))}
            >
              {t('copy_link', 'Copy link')}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};

type TeamRow = {
  id: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  user: {
    email: string;
    id: string;
  };
};

type PendingInvite = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  status: string;
};

export const TeamsComponent = () => {
  const fetch = useFetch();
  const user = useUser();
  const modals = useModals();
  const toast = useToaster();
  const t = useT();
  const myLevel = user?.role === 'USER' ? 0 : user?.role === 'ADMIN' ? 1 : 2;
  const getLevel = useCallback(
    (role: 'USER' | 'ADMIN' | 'SUPERADMIN') =>
      role === 'USER' ? 0 : role === 'ADMIN' ? 1 : 2,
    []
  );
  const loadTeam = useCallback(async () => {
    return (await (await fetch('/settings/team')).json()).users as TeamRow[];
  }, []);
  const loadInvites = useCallback(async () => {
    const response = await fetch('/settings/team/invites');
    if (!response.ok) {
      return [] as PendingInvite[];
    }
    const body = await response.json();
    return (Array.isArray(body) ? body : []) as PendingInvite[];
  }, []);
  const { data, mutate } = useSWR('/api/teams', loadTeam, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
  const { data: invites, mutate: mutateInvites } = useSWR(
    '/api/team-invites',
    loadInvites,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );
  const addMember = useCallback(() => {
    modals.openModal({
      classNames: {
        modal: 'bg-transparent text-textColor',
      },
      title: t('top_title_add_member', 'Add Member'),
      withCloseButton: true,
      size: '500px',
      children: <AddMember onDone={() => mutateInvites()} />,
    });
  }, [modals, mutateInvites, t]);
  const remove = useCallback(
    (toRemove: { user: { id: string } }) => async () => {
      if (
        !(await deleteDialog(
          t('cant_be_undone', "This can't be undone."),
          t('remove', 'Remove'),
          t('remove_this_team_member', 'Remove this team member?'),
          t('cancel', 'Cancel')
        ))
      ) {
        return;
      }
      const response = await fetch(`/settings/team/${toRemove.user.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        toast.show(await readMessage(response), 'error');
        return;
      }
      await mutate();
    },
    [fetch, mutate, t, toast]
  );
  const changeRole = useCallback(
    (member: TeamRow) => async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const role = event.target.value;
      if (role === member.role) {
        return;
      }
      const response = await fetch(`/settings/team/${member.user.id}/role`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        toast.show(await readMessage(response), 'error');
        await mutate();
        return;
      }
      await mutate();
    },
    [fetch, mutate, toast]
  );
  const inviteAction = useCallback(
    (id: string, action: 'resend' | 'link' | 'revoke') => async () => {
      const response = await fetch(
        action === 'revoke'
          ? `/settings/team/invites/${id}`
          : `/settings/team/invites/${id}/${action}`,
        { method: action === 'revoke' ? 'DELETE' : 'POST' }
      );
      if (!response.ok) {
        toast.show(await readMessage(response), 'error');
        return;
      }
      const body = action === 'revoke' ? null : await response.json();
      if (action === 'link' || (action === 'resend' && body?.url && body.sent === false)) {
        if (body?.url) {
          copy(body.url);
        }
        toast.show(
          body?.error || t('link_copied_to_clipboard', 'Link copied to clipboard'),
          body?.error ? 'error' : 'success'
        );
      } else if (action === 'resend') {
        toast.show(t('invitation_link_sent', 'Invitation link sent'));
      }
      await mutateInvites();
    },
    [fetch, mutateInvites, t, toast]
  );

  return (
    <div className="settings-section">
      <div className="settings-head">
        <div>
          <h1>{t('team_members', 'Team Members')}</h1>
        </div>
        <Button onClick={addMember}>
          + {t('add_another_member', 'Add another member')}
        </Button>
      </div>
      {!!data?.length && (
        <div className="settings-list">
          <div className="settings-cols cols-team" aria-hidden="true">
            <span>{t('user', 'User')}</span>
            <span>{t('email', 'Email')}</span>
            <span>{t('role', 'Role')}</span>
          </div>
          {data.map((p) => {
            const name = capitalize(p.user.email.split('@')[0]).split('.')[0];
            const canEdit = myLevel > getLevel(p.role);
            return (
              <article key={p.user.id} className="settings-item cols-team">
                <div className="settings-person">
                  <span className="settings-initials">
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>{name}</span>
                </div>
                <span className="settings-muted" data-label={t('email', 'Email')}>
                  {p.user.email}
                </span>
                <div className="settings-item-actions" data-label={t('role', 'Role')}>
                  <select
                    className="settings-role"
                    aria-label={t('role', 'Role')}
                    value={p.role}
                    disabled={!canEdit}
                    onChange={changeRole(p)}
                  >
                    {p.role === 'SUPERADMIN' ? (
                      <option value="SUPERADMIN">{t('super_admin', 'Super Admin')}</option>
                    ) : null}
                    <option value="USER">{t('user', 'User')}</option>
                    <option value="ADMIN">{t('admin', 'Admin')}</option>
                  </select>
                  {canEdit && (
                    <Button secondary className="settings-icon" onClick={remove(p)}>
                      {t('remove', 'Remove')}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!!invites?.length && (
        <div className="settings-pending">
          <h2 className="settings-pending-title">{t('pending', 'Pending')}</h2>
          <div className="settings-list">
            {invites.map((invite) => (
              <article key={invite.id} className="settings-item settings-invite">
                <span className="settings-muted">{invite.email}</span>
                <span className="settings-pill">
                  {invite.role === 'ADMIN'
                    ? t('admin', 'Admin')
                    : invite.role === 'SUPERADMIN'
                    ? t('super_admin', 'Super Admin')
                    : t('user', 'User')}
                </span>
                <div className="settings-invite-actions">
                  <Button secondary className="settings-icon" onClick={inviteAction(invite.id, 'resend')}>
                    {t('resend', 'Resend')}
                  </Button>
                  <Button secondary className="settings-icon" onClick={inviteAction(invite.id, 'link')}>
                    {t('copy_link', 'Copy link')}
                  </Button>
                  <Button secondary className="settings-icon" onClick={inviteAction(invite.id, 'revoke')}>
                    {t('revoke', 'Revoke')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
