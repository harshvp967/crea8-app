'use client';

import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import React, { useCallback, useMemo } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { capitalize } from 'lodash';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Input } from '@gitroom/react/form/input';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { Select } from '@gitroom/react/form/select';
import { Checkbox } from '@gitroom/react/form/checkbox';
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
export const AddMember = () => {
  const modals = useModals();
  const fetch = useFetch();
  const toast = useToaster();
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
  const sendEmail = useWatch({
    control: form.control,
    name: 'sendEmail',
  });
  const submit = useCallback(
    async (values: { email: string; role: string; sendEmail: boolean }) => {
      const { url } = await (
        await fetch('/settings/team', {
          method: 'POST',
          body: JSON.stringify(values),
        })
      ).json();
      if (values.sendEmail) {
        modals.closeAll();
        toast.show(t('invitation_link_sent', 'Invitation link sent'));
        return;
      }
      copy(url);
      modals.closeAll();
      toast.show(t('link_copied_to_clipboard', 'Link copied to clipboard'));
    },
    []
  );

  const t = useT();

  return (
    <FormProvider {...form}>
      <form className="settings-form" onSubmit={form.handleSubmit(submit)}>
        <div className="relative flex gap-[10px] flex-col flex-1 p-[16px] pt-0">
          {sendEmail && (
            <Input
              label="Email"
              placeholder={t('enter_email', 'Enter email')}
              name="email"
            />
          )}
          <Select label="Role" name="role">
            <option value="">{t('select_role', 'Select Role')}</option>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.name}
              </option>
            ))}
          </Select>
          <div className="flex gap-[5px]">
            <div>
              <Checkbox name="sendEmail" />
            </div>
            <div>
              {t('send_invitation_via_email', 'Send invitation via email?')}
            </div>
          </div>
          <Button type="submit" className="mt-[18px]">
            {sendEmail ? t('send_invitation_link', 'Send Invitation Link') : t('copy_link', 'Copy Link')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};
export const TeamsComponent = () => {
  const fetch = useFetch();
  const user = useUser();
  const modals = useModals();
  const t = useT();
  const myLevel = user?.role === 'USER' ? 0 : user?.role === 'ADMIN' ? 1 : 2;
  const getLevel = useCallback(
    (role: 'USER' | 'ADMIN' | 'SUPERADMIN') =>
      role === 'USER' ? 0 : role === 'ADMIN' ? 1 : 2,
    []
  );
  const loadTeam = useCallback(async () => {
    return (await (await fetch('/settings/team')).json()).users as Array<{
      id: string;
      role: 'SUPERADMIN' | 'ADMIN' | 'USER';
      user: {
        email: string;
        id: string;
      };
    }>;
  }, []);
  const addMember = useCallback(() => {
    modals.openModal({
      classNames: {
        modal: 'bg-transparent text-textColor',
      },
      title: t('top_title_add_member', 'Add Member'),
      withCloseButton: true,
      size: '500px',
      children: <AddMember />,
    });
  }, [t]);
  const { data, mutate } = useSWR('/api/teams', loadTeam, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
  const remove = useCallback(
    (toRemove: {
        user: {
          id: string;
        };
      }) =>
      async () => {
        if (
          !(await deleteDialog(
            t('are_you_sure_remove_team_member', 'Are you sure you want to remove this team member?')
          ))
        ) {
          return;
        }
        await fetch(`/settings/team/${toRemove.user.id}`, {
          method: 'DELETE',
        });
        await mutate();
      },
    [t]
  );

  return (
    <div className="settings-section">
      <div className="settings-head">
        <div>
          <h1>{t('team_members', 'Team Members')}</h1>
          <p>
            {t(
              'invite_your_assistant_or_team_member_to_manage_your_account',
              'Invite your assistant or team member to manage your account'
            )}
          </p>
        </div>
        <Button onClick={addMember}>
          + {t('add_another_member', 'Add another member')}
        </Button>
      </div>
      {!!data?.length && (
        <div className="settings-list">
          <div className="settings-cols cols-team">
            <span>{t('user', 'User')}</span>
            <span>{t('email', 'Email')}</span>
            <span>{t('role', 'Role')}</span>
          </div>
          {data.map((p) => {
            const name = capitalize(p.user.email.split('@')[0]).split('.')[0];
            const role =
              p.role === 'USER'
                ? t('user', 'User')
                : p.role === 'ADMIN'
                ? t('admin', 'Admin')
                : t('super_admin', 'Super Admin');
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
                  <span className="settings-pill">{role}</span>
                  {+myLevel > +getLevel(p.role) && (
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
    </div>
  );
};
