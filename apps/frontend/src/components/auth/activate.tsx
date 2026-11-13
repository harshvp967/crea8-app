'use client';

import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type ResendInputs = {
  email: string;
};

type ResendStatus = 'idle' | 'sent' | 'already_activated';

const COOLDOWN_SECONDS = 60;

export function Activate() {
  const t = useT();
  const fetch = useFetch();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ResendStatus>('idle');
  const [cooldown, setCooldown] = useState(0);
  const form = useForm<ResendInputs>();

  useEffect(() => {
    if (cooldown <= 0) return;
    
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const resetToForm = useCallback(() => {
    setStatus('idle');
    setCooldown(COOLDOWN_SECONDS);
  }, []);

  const onSubmit: SubmitHandler<ResendInputs> = async (data) => {
    setLoading(true);
    try {
      const response = await fetch('/auth/resend-activation', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (result.success) {
        setStatus('sent');
        setCooldown(COOLDOWN_SECONDS);
      } else if (result.message === 'Account is already activated') {
        setStatus('already_activated');
      } else {
        form.setError('email', {
          message: result.message || t('failed_to_resend', 'Failed to resend activation email'),
        });
      }
    } catch (e) {
      form.setError('email', {
        message: t('error_occurred', 'An error occurred. Please try again.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const emailError = form.formState.errors.email?.message as string | undefined;
  const loginLink = (
    <p className="mt-[12px] text-[14px]">
      <Link href="/login" className="cursor-pointer text-[color:var(--arc-accent-text)]">
        {t('log_in', 'Log in')}
      </Link>
    </p>
  );
  return (
    <div className="auth-form flex flex-1 flex-col">
      <h1 className="text-[26px] font-[600] tracking-[-0.02em] text-start">
        {t('activate_your_account', 'Activate your account')}
      </h1>
      {emailError ? (
        <div className="auth-alert" role="alert">
          {emailError}
        </div>
      ) : null}
      {status === 'sent' ? (
        <div className="flex flex-col gap-[12px]">
          <div className="text-[14px] text-textColor">
            {t('activation_email_sent', 'Activation email has been sent! Please check your inbox.')}
          </div>
          {cooldown > 0 ? (
            <p className="m-0 text-[14px] text-textColor">
              {t('resend_available_in', 'You can resend in')} {cooldown}s
            </p>
          ) : (
            <div className="w-full flex">
              <Button
                onClick={resetToForm}
                className="auth-submit flex-1 !rounded-[18px] !h-[50px]"
              >
                {t('send_again', 'Send Again')}
              </Button>
            </div>
          )}
          <div className="text-center">{loginLink}</div>
        </div>
      ) : status === 'already_activated' ? (
        <div className="flex flex-col gap-[12px]">
          <div className="text-[14px] text-textColor">
            {t('account_already_activated', 'Great news! Your account is already activated.')}
          </div>
          <div className="text-center mt-[8px]">
            <div className="w-full flex">
              <Link href="/login" className="flex flex-1">
                <Button className="auth-submit flex-1 !rounded-[18px] !h-[50px]">
                  {t('log_in', 'Log in')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-[12px]">
            <Input
              label={t('label_email', 'Email')}
              translationKey="label_email"
              {...form.register('email', { required: true })}
              type="email"
              placeholder={t('email_address', 'Email Address')}
              className="cc-input"
              removeError={!!emailError}
            />
            <div className="text-center mt-[8px]">
              <div className="w-full flex">
                <Button
                  type="submit"
                  className="auth-submit flex-1 !rounded-[18px] !h-[50px]"
                  loading={loading}
                  disabled={cooldown > 0}
                >
                  {cooldown > 0
                    ? `${t('resend_available_in', 'You can resend in')} ${cooldown}s`
                    : t('resend_activation_email', 'Resend Activation Email')}
                </Button>
              </div>
              {loginLink}
            </div>
          </form>
        </FormProvider>
      )}
    </div>
  );
}
