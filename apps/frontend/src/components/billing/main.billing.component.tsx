'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Subscription } from '@prisma/client';
import { useDebouncedCallback } from 'use-debounce';
import ReactLoading from '@gitroom/frontend/components/layout/loading';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useToaster } from '@gitroom/react/toaster/toaster';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { FAQComponent } from '@gitroom/frontend/components/billing/faq.component';
import { useSWRConfig } from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Textarea } from '@gitroom/react/form/textarea';
import { useFireEvents } from '@gitroom/helpers/utils/use.fire.events';
import { useUtmUrl } from '@gitroom/helpers/utils/utm.saver';
import { useTrack } from '@gitroom/react/helpers/use.track';
import { TrackEnum } from '@gitroom/nestjs-libraries/user/track.enum';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { FinishTrial } from '@gitroom/frontend/components/billing/finish.trial';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { useDubClickId } from '@gitroom/frontend/components/layout/dubAnalytics';
import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';

type SubscriptionWithPlatform = Subscription & {
  platform?: 'web' | 'mobile';
};

export const Prorate: FC<{
  period: 'MONTHLY' | 'YEARLY';
  pack: 'STANDARD' | 'PRO';
}> = (props) => {
  const { period, pack } = props;
  const t = useT();
  const fetch = useFetch();
  const [price, setPrice] = useState<number | false>(0);
  const [loading, setLoading] = useState(false);
  const calculatePrice = useDebouncedCallback(async () => {
    setLoading(true);
    setPrice(
      (
        await (
          await fetch('/billing/prorate', {
            method: 'POST',
            body: JSON.stringify({
              period,
              billing: pack,
            }),
          })
        ).json()
      ).price
    );
    setLoading(false);
  }, 500);
  useEffect(() => {
    setPrice(false);
    calculatePrice();
  }, [period, pack]);
  if (loading) {
    return (
      <div className="pt-[12px]">
        <ReactLoading type="spin" color="#fff" width={20} height={20} />
      </div>
    );
  }
  if (price === false) {
    return null;
  }
  return (
    <div className="text-[12px] flex pt-[12px]">
      ({t('pay_today', 'Pay Today')} ${(price < 0 ? 0 : price)?.toFixed(1)})
    </div>
  );
};
export const Features: FC<{
  pack: 'FREE' | 'STANDARD' | 'PRO';
}> = (props) => {
  const { pack } = props;
  const features = useMemo(() => {
    const currentPricing = pricing[pack];
    const channelsOr = currentPricing.channel;
    const list = [];
    list.push(`${channelsOr} ${channelsOr === 1 ? 'channel' : 'channels'}`);
    list.push(
      `${
        currentPricing.posts_per_month > 10000
          ? 'Unlimited'
          : currentPricing.posts_per_month
      } posts per month`
    );
    if (currentPricing.team_members) {
      list.push(`Unlimited team members`);
    }
    if (currentPricing?.ai) {
      list.push(`AI auto-complete`);
      list.push(`AI copilots`);
      list.push(`AI Autocomplete`);
    }
    list.push(`Advanced Picture Editor`);
    if (currentPricing?.image_generator) {
      list.push(
        `${currentPricing?.image_generation_count} AI Images per month`
      );
    }
    if (currentPricing?.generate_videos) {
      list.push(`${currentPricing?.generate_videos} AI Videos per month`);
    }
    return list;
  }, [pack]);
  return (
    <div className="billing-features">
      {features.map((feature) => (
        <div key={feature} className="billing-feature">
          <HugeIcon name="check" size={16} />
          <span>{feature}</span>
        </div>
      ))}
    </div>
  );
};

const Accept: FC<{ resolve: (res: boolean) => void }> = ({ resolve }) => {
  const [loading, setLoading] = useState(false);
  const fetch = useFetch();
  const toaster = useToaster();

  const apply = useCallback(async () => {
    setLoading(true);
    await fetch('/billing/apply-discount', {
      method: 'POST',
    });

    resolve(true);
    toaster.show('50% discount applied successfully');
  }, []);

  return (
    <div>
      <div className="mb-[20px]">
        Would you accept 50% discount for 3 months instead? 🙏🏻
      </div>
      <div className="flex gap-[10px]">
        <Button loading={loading} onClick={apply}>
          Apply 50% discount for 3 months
        </Button>
        <Button onClick={() => resolve(false)} className="!bg-red-800 !text-white">
          Cancel my subscription
        </Button>
      </div>
    </div>
  );
};
const Info: FC<{
  proceed: (feedback: string) => void;
}> = (props) => {
  const [feedback, setFeedback] = useState('');
  const modal = useModals();
  const events = useFireEvents();
  const cancel = useCallback(() => {
    props.proceed(feedback);
    events('cancel_subscription');
    modal.closeAll();
  }, [modal, feedback]);

  const t = useT();

  return (
    <div className="relative flex gap-[20px] flex-col flex-1 rounded-[4px]">
      <div>
        {t(
          'would_you_mind_shortly_tell_us_what_we_could_have_done_better',
          'Would you mind shortly tell us what we could have done better?'
        )}
      </div>
      <div>
        <Textarea
          className="bg-newBgColorInner"
          label={'Feedback'}
          name="feedback"
          disableForm={true}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>
      <div>
        <Button disabled={feedback.length < 20} onClick={cancel}>
          {feedback.length < 20
            ? t('please_add_at_least', 'Please add at least 20 chars')
            : t('cancel_subscription', 'Cancel Subscription')}
        </Button>
      </div>
    </div>
  );
};
export const MainBillingComponent: FC<{
  sub?: SubscriptionWithPlatform;
}> = (props) => {
  const { sub } = props;
  const { isGeneral } = useVariables();
  const { mutate } = useSWRConfig();
  const fetch = useFetch();
  const toast = useToaster();
  const user = useUser();
  const dub = useDubClickId();
  const modal = useModals();
  const router = useRouter();
  const utm = useUtmUrl();
  const track = useTrack();
  const t = useT();
  const queryParams = useSearchParams();
  const [finishTrial, setFinishTrial] = useState(
    !!queryParams.get('finishTrial')
  );

  const [subscription, setSubscription] = useState<SubscriptionWithPlatform | undefined>(
    sub
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>(
    subscription?.period || 'MONTHLY'
  );
  const [monthlyOrYearly, setMonthlyOrYearly] = useState<'on' | 'off'>(
    period === 'MONTHLY' ? 'off' : 'on'
  );
  const [initialChannels, setInitialChannels] = useState(
    sub?.totalChannels || 1
  );
  useEffect(() => {
    if (initialChannels !== sub?.totalChannels) {
      setInitialChannels(sub?.totalChannels || 1);
    }
    if (period !== sub?.period) {
      setPeriod(sub?.period || 'MONTHLY');
      setMonthlyOrYearly(
        (sub?.period || 'MONTHLY') === 'MONTHLY' ? 'off' : 'on'
      );
    }
    setSubscription(sub);
  }, [sub]);
  const updatePayment = useCallback(async () => {
    const { portal } = await (await fetch('/billing/portal')).json();
    window.location.href = portal;
  }, []);
  const currentPackage = useMemo(() => {
    if (!subscription) {
      return 'FREE';
    }
    if (period === 'YEARLY' && monthlyOrYearly === 'off') {
      return '';
    }
    if (period === 'MONTHLY' && monthlyOrYearly === 'on') {
      return '';
    }
    return subscription?.subscriptionTier;
  }, [subscription, initialChannels, monthlyOrYearly, period]);
  const visiblePlans = useMemo(
    () =>
      Object.entries(pricing).filter(
        ([key]) => !isGeneral || key !== 'FREE'
      ),
    [isGeneral]
  );
  const accentPlan = useMemo(() => {
    const names = visiblePlans.map(([key]) => key);
    const index = names.findIndex((key) => key === currentPackage);
    if (index < 0) {
      return names.find((key) => key !== 'FREE');
    }
    return names[index + 1];
  }, [visiblePlans, currentPackage]);
  const showCardCancel =
    !!isGeneral &&
    !!subscription?.id &&
    !subscription?.cancelAt &&
    !!currentPackage &&
    currentPackage !== 'FREE';
  const moveToCheckout = useCallback(
    (billing: 'STANDARD' | 'PRO' | 'FREE', reactivate = false) =>
      async () => {
        if (reactivate) {
          setLoading(true);
          const { cancel_at } = await (
            await fetch('/billing/cancel', {
              method: 'POST',
              body: JSON.stringify({
                feedback: '',
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            })
          ).json();
          setSubscription((subs) => ({
            ...subs!,
            cancelAt: cancel_at,
          }));

          toast.show('Subscription reactivated successfully');
          setLoading(false);
          return;
        }

        const messages = [];
        if (
          !pricing[billing].team_members &&
          pricing[subscription?.subscriptionTier!]?.team_members
        ) {
          messages.push(
            `Your team members will be removed from your organization`
          );
        }
        if (billing === 'FREE') {
          if (
            subscription?.cancelAt ||
            (await deleteDialog(
              messages.length
                ? `${messages.join('. ')}. This can't be undone.`
                : "This can't be undone.",
              'Cancel subscription',
              'Cancel this subscription?',
              'Go back'
            ))
          ) {
            const checkDiscount = await (
              await fetch('/billing/check-discount')
            ).json();
            if (checkDiscount.offerCoupon) {
              const info = await new Promise((res) => {
                modal.openModal({
                  title: 'Before you cancel',
                  withCloseButton: true,
                  classNames: {
                    modal: 'bg-transparent text-textColor',
                  },
                  children: <Accept resolve={res} />,
                });
              });

              modal.closeAll();

              if (info) {
                return;
              }
            }

            const info = await new Promise((res) => {
              modal.openModal({
                title: t(
                  'we_are_sorry_to_see_you_go',
                  'We are sorry to see you go :('
                ),
                withCloseButton: true,
                classNames: {
                  modal: 'bg-transparent text-textColor',
                },
                children: <Info proceed={(e) => res(e)} />,
              });
            });

            setLoading(true);
            const { cancel_at } = await (
              await fetch('/billing/cancel', {
                method: 'POST',
                body: JSON.stringify({
                  feedback: info,
                }),
                headers: {
                  'Content-Type': 'application/json',
                },
              })
            ).json();
            setSubscription((subs) => ({
              ...subs!,
              cancelAt: cancel_at,
            }));
            if (cancel_at)
              toast.show('Subscription set to canceled successfully');
            setLoading(false);
          }
          return;
        }
        if (
          messages.length &&
          !(await deleteDialog(
            messages.join('. '),
            'Continue',
            'Continue with this plan?',
            'Cancel'
          ))
        ) {
          return;
        }
        setLoading(true);
        const { url, portal, blocked } = await (
          await fetch('/billing/subscribe', {
            method: 'POST',
            body: JSON.stringify({
              period: monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY',
              utm,
              billing,
              ...(dub ? { dub } : {}),
            }),
          })
        ).json();
        if (blocked) {
          setLoading(false);
          await deleteDialog(
            t(
              'billing_other_account_subscribed',
              'Another account with this email already has an active subscription. Please log off and sign in to that account to manage your subscription.'
            ),
            t('ok', 'OK'),
            t('already_subscribed', 'Already subscribed'),
            t('cancel', 'Cancel'),
            'primary'
          );
          return;
        }
        if (url) {
          await track(TrackEnum.InitiateCheckout, {
            value:
              pricing[billing][
                monthlyOrYearly === 'on' ? 'year_price' : 'month_price'
              ],
          });
          window.location.href = url;
          return;
        }
        if (portal) {
          if (
            await deleteDialog(
              'We could not charge this card.',
              'Update',
              'Update your payment method?',
              'Cancel',
              'primary'
            )
          ) {
            window.open(portal);
          }
        } else {
          setPeriod(monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY');
          setSubscription((subs) => ({
            ...subs!,
            subscriptionTier: billing,
            cancelAt: null,
          }));
          mutate(
            '/user/self',
            {
              ...user,
              tier: billing,
            },
            {
              revalidate: false,
            }
          );
          toast.show('Subscription updated successfully');
        }
        setLoading(false);
      },
    [monthlyOrYearly, subscription, user, utm]
  );
  if (user?.isLifetime) {
    router.replace('/');
    return null;
  }
  if (subscription?.platform && subscription.platform !== 'web') {
    return (
      <div className="flex flex-col gap-[16px]">
        <div className="text-[20px]">{t('plans', 'Plans')}</div>
        <div className="flex flex-col items-center gap-[8px] rounded-[8px] bg-newBgColorInner p-[24px] text-center">
          <div className="text-[18px]">
            {t('subscription_managed_by', 'Your subscription is managed by')}{' '}
            <span className="capitalize">{subscription.provider}</span>
          </div>
          <div className="text-[14px] opacity-70">
            {t(
              'subscription_manage_on_platform',
              'Please go to {{platform}} to manage it',
              { platform: subscription.platform }
            )}
          </div>
        </div>
        <FAQComponent />
        <div className="flex justify-center mt-[20px]">
          <LogoutComponent />
        </div>
      </div>
    );
  }
  return (
    <div className="billing-plans flex flex-col gap-[16px]">
      <div className="billing-plans-head">
        <div>
          <h1>{t('plans', 'Plans')}</h1>
          <p>
            {t('billing_choose_plan', 'Choose a Plan')}
            {' · '}
            {t('billing_no_risk_trial', '100% No-Risk Free Trial')}
          </p>
        </div>
        <div className="billing-period" role="radiogroup" aria-label={t('monthly', 'MONTHLY')}>
          <button
            type="button"
            role="radio"
            aria-checked={monthlyOrYearly === 'off'}
            onClick={() => setMonthlyOrYearly('off')}
          >
            {t('monthly', 'MONTHLY')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={monthlyOrYearly === 'on'}
            onClick={() => setMonthlyOrYearly('on')}
          >
            {t('yearly', 'YEARLY')}
          </button>
        </div>
      </div>

      {finishTrial && <FinishTrial close={() => setFinishTrial(false)} />}
      <div className="billing-grid">
        {visiblePlans.map(([name, values]) => {
          const tier = name.toUpperCase() as 'FREE' | 'STANDARD' | 'PRO';
          const isCurrent = currentPackage === tier;
          const trialLabel =
            // @ts-ignore
            (user?.tier === 'FREE' || user?.tier?.current === 'FREE') &&
            user.allowTrial;
          return (
            <div
              key={name}
              className={clsx('billing-card', isCurrent && 'is-current')}
            >
              <div className="billing-card-top">
                <h2>{name.charAt(0) + name.slice(1).toLowerCase()}</h2>
                {isCurrent && (
                  <span className="billing-pill">
                    {t('current_plan', 'Current plan')}
                  </span>
                )}
              </div>
              <div className="billing-price">
                $
                {monthlyOrYearly === 'on'
                  ? values.year_price
                  : values.month_price}
                <span>{monthlyOrYearly === 'on' ? '/year' : '/month'}</span>
              </div>
              <Features pack={tier} />
              <div className="billing-actions">
                {isCurrent && subscription?.cancelAt ? (
                  <Button
                    secondary
                    onClick={moveToCheckout('FREE', true)}
                    loading={loading}
                  >
                    {t('reactivate_subscription', 'Reactivate subscription')}
                  </Button>
                ) : showCardCancel && isCurrent ? (
                  <Button
                    secondary
                    className="billing-danger"
                    loading={loading}
                    onClick={moveToCheckout('FREE')}
                  >
                    {t('cancel_subscription_1', 'Cancel subscription')}
                  </Button>
                ) : (
                  <Button
                    secondary={name !== accentPlan}
                    loading={loading}
                    disabled={
                      (!!subscription?.cancelAt && tier === 'FREE') || isCurrent
                    }
                    className={clsx(
                      subscription && tier === 'FREE' && 'billing-danger'
                    )}
                    onClick={moveToCheckout(tier as 'STANDARD' | 'PRO')}
                  >
                    {isCurrent
                      ? 'Current Plan'
                      : tier === 'FREE'
                      ? subscription?.cancelAt
                        ? `Downgrade on ${dayjs
                            .utc(subscription?.cancelAt)
                            .local()
                            .format('D MMM, YYYY')}`
                        : 'Cancel subscription'
                      : trialLabel
                      ? t('start_7_days_free_trial', 'Start 7 days free trial')
                      : 'Purchase'}
                  </Button>
                )}
                {subscription && !isCurrent && name !== 'FREE' && !!name && (
                  <Prorate
                    period={monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY'}
                    pack={tier as 'STANDARD' | 'PRO'}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!!subscription?.id && (
        <div className="billing-footer flex flex-wrap gap-[10px]">
          <Button secondary onClick={updatePayment}>
            {t(
              'update_payment_method_invoices_history',
              'Update Payment Method / Invoices History'
            )}
          </Button>
          {isGeneral && !subscription?.cancelAt && !showCardCancel && (
            <Button
              secondary
              className="billing-danger"
              loading={loading}
              onClick={moveToCheckout('FREE')}
            >
              {t('cancel_subscription_1', 'Cancel subscription')}
            </Button>
          )}
        </div>
      )}
      {subscription?.cancelAt && isGeneral && (
        <div className="text-center">
          {t(
            'your_subscription_will_be_canceled_at',
            'Your subscription will be canceled at'
          )}{' '}
          {newDayjs(subscription.cancelAt).local().format('D MMM, YYYY')}
          <br />
          {t(
            'you_will_never_be_charged_again',
            'You will never be charged again'
          )}
        </div>
      )}
      <FAQComponent />
      <div className="flex justify-center mt-[20px]">
        <LogoutComponent />
      </div>
    </div>
  );
};
