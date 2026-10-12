'use client';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useMemo, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ForgotReturnPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot-return.password.dto';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
type Inputs = {
  password: string;
  repeatPassword: string;
  token: string;
};
export function ForgotReturn({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const t = useT();
  const [state, setState] = useState(false);
  const resolver = useMemo(() => {
    return classValidatorResolver(ForgotReturnPasswordDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    mode: 'onChange',
    defaultValues: {
      token,
    },
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    const { reset } = await (
      await fetchData('/auth/forgot-return', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
        }),
      })
    ).json();
    setState(true);
    if (!reset) {
      form.setError('password', {
        type: 'manual',
        message: t('password_reset_link_expired', 'Your password reset link has expired. Please try again.'),
      });
      return false;
    }
    setLoading(false);
  };
  const expired = form.formState.errors.password?.message as string | undefined;
  return (
    <FormProvider {...form}>
      <form
        className="auth-form"
        method="post"
        action="/auth/native-submit"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {!state ? (
          <>
            <div>
              <h1 className="text-[26px] font-[600] tracking-[-0.02em] text-start mb-4">
                {t('forgot_password_1', 'Forgot Password')}
              </h1>
            </div>
            <div className="space-y-4 text-textColor">
              <Input
                label="New Password"
                translationKey="label_new_password"
                {...form.register('password')}
                type="password"
                placeholder={t('label_password', 'Password')}
                className="cc-input"
              />
              <Input
                label="Repeat Password"
                translationKey="label_repeat_password"
                {...form.register('repeatPassword')}
                type="password"
                placeholder={t('label_repeat_password', 'Repeat Password')}
                className="cc-input"
              />
            </div>
            <div className="text-center mt-6">
              <div className="w-full flex">
                <Button type="submit" className="auth-submit flex-1 !h-[50px] !rounded-[18px]" loading={loading}>
                  {t('change_password', 'Change Password')}
                </Button>
              </div>
              <p className="mt-4 text-sm">
                <Link href="/auth/login" className="cursor-pointer">
                  {t('go_back_to_login', 'Go back to login')}
                </Link>
              </p>
            </div>
          </>
        ) : expired ? (
          <div className="auth-status is-bad">
            <h1 className="text-[26px] font-[600] tracking-[-0.02em]">
              {t('forgot_password_1', 'Forgot Password')}
            </h1>
            <p>{expired}</p>
            <p className="mt-4 text-sm">
              <Link href="/auth/login" className="cursor-pointer">
                {t('go_back_to_login', 'Go back to login')}
              </Link>
            </p>
          </div>
        ) : (
          <div className="auth-status is-ok">
            <h1 className="text-[26px] font-[600] tracking-[-0.02em]">
              {t('forgot_password_1', 'Forgot Password')}
            </h1>
            <p>
              {t(
                'we_successfully_reset_your_password_you_can_now_login_with_your',
                'We successfully reset your password. You can now login with your'
              )}
            </p>
            <p className="mt-4 text-sm">
              <Link href="/auth/login" className="cursor-pointer">
                {t('go_back_to_login', 'Go back to login')}
              </Link>
            </p>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
