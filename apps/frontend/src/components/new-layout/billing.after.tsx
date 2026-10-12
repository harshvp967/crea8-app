import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { BillingComponent } from '@gitroom/frontend/components/billing/billing.component';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';
import React from 'react';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';

export const BillingAfter = () => {
  const user = useUser();
  const { isGeneral, billingEnabled } = useVariables();
  const t = useT();
  return (
    <div className="flex-1 rounded-3xl px-0 py-[17px] flex flex-col max-w-[1440px] mx-auto">
      <div>
        <OrganizationSelector asOpenSelect={true} />
      </div>
      <div className="flex justify-center mb-[10px]">
        <Logo />
      </div>
      <div className="text-center mb-[20px] text-xl [@media(max-width:1024px)]:text-xl">
        <h1 className="text-3xl [@media(max-width:1024px)]:text-xl">
          {t(
            'join_10000_entrepreneurs_who_use_postiz',
            'Join 10,000+ Entrepreneurs Who Use Crea8one'
          )}
          <br />
          {t(
            'to_manage_all_your_social_media_channels',
            'To Manage All Your Social Media Channels'
          )}
        </h1>
        <br />
        {user?.allowTrial && (
          <div className="table mx-auto">
            <div className="flex gap-[5px] items-center">
              <div>
                <HugeIcon name="check-circle" size={20} className="text-[#06ff00]" />
              </div>
              <div>{t('100_no_risk_trial', '100% no-risk trial')}</div>
            </div>
            <div className="flex gap-[5px] items-center">
              <div>
                <HugeIcon name="check-circle" size={20} className="text-[#06ff00]" />
              </div>
              <div>
                {t(
                  'pay_nothing_for_the_first_7_days',
                  'Pay nothing for the first 7 days'
                )}
              </div>
            </div>
            <div className="flex gap-[5px] items-center">
              <div>
                <HugeIcon name="check-circle" size={20} className="text-[#06ff00]" />
              </div>
              <div>
                {t('cancel_anytime_hassle_free', 'Cancel anytime, from settings')}
              </div>
            </div>
          </div>
        )}
      </div>
      <BillingComponent />
      <div className="flex justify-center items-center mt-[20px]">
        <LogoutComponent />
      </div>
    </div>
  );
};
