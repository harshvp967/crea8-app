import { getT } from '@gitroom/react/translation/get.translation.service.backend';

export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getT();

  return (
    <MantineWrapper>
      <Toaster />
      <div className="bg-newBgColor flex flex-1 p-[12px] gap-[12px] min-h-screen w-screen text-textColor">
        <ReturnUrlComponent />
        <div className="flex flex-col py-[40px] px-[20px] flex-1 lg:w-[600px] lg:flex-none rounded-[34px] text-textColor p-[12px] bg-newBgColorInner border border-newBorder">
          <div className="w-full max-w-[440px] mx-auto justify-center gap-[20px] h-full flex flex-col text-textColor">
            <LogoTextComponent />
            <div className="flex">{children}</div>
          </div>
        </div>
        <div className="hidden flex-1 flex-col justify-center px-[40px] py-[48px] lg:flex">
          <div className="mx-auto flex w-full max-w-[520px] flex-col gap-[28px]">
            <img
              src="/crea8one-logo-horizontal-color.svg"
              alt="crea8.one"
              width={877}
              height={263}
              className="h-[48px] w-auto max-w-[220px] object-contain object-left dark:hidden"
            />
            <img
              src="/crea8one-logo-horizontal-color-on-dark.svg"
              alt=""
              aria-hidden
              width={877}
              height={263}
              className="hidden h-[48px] w-auto max-w-[220px] object-contain object-left dark:block"
            />
            <h2 className="text-[32px] font-[600] leading-[1.25] text-textColor">
              {t(
                'auth_panel_headline',
                'Plan, publish and learn from your audience, in one place.'
              )}
            </h2>
            <ul className="flex flex-col gap-[20px]">
              <li className="flex gap-[14px]">
                <span className="mt-[8px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#00D9FF]" />
                <div>
                  <div className="text-[16px] font-[600] text-[color:var(--arc-accent-text)]">
                    {t('auth_panel_schedule_title', 'Schedule')}
                  </div>
                  <p className="mt-[4px] text-[15px] leading-[1.5] text-textItemBlur">
                    {t(
                      'auth_panel_schedule_body',
                      'Plan and publish to all your social channels from one calendar.'
                    )}
                  </p>
                </div>
              </li>
              <li className="flex gap-[14px]">
                <span className="mt-[8px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#00D9FF]" />
                <div>
                  <div className="text-[16px] font-[600] text-[color:var(--arc-accent-text)]">
                    {t('auth_panel_insights_title', 'Stalker insights')}
                  </div>
                  <p className="mt-[4px] text-[15px] leading-[1.5] text-textItemBlur">
                    {t(
                      'auth_panel_insights_body',
                      'AI turns the comments on your posts into themes and ideas.'
                    )}
                  </p>
                </div>
              </li>
              <li className="flex gap-[14px]">
                <span className="mt-[8px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#00D9FF]" />
                <div>
                  <div className="text-[16px] font-[600] text-[color:var(--arc-accent-text)]">
                    {t('auth_panel_draft_title', 'Idea to draft')}
                  </div>
                  <p className="mt-[4px] text-[15px] leading-[1.5] text-textItemBlur">
                    {t(
                      'auth_panel_draft_body',
                      'Turn an insight into a ready-to-edit post in one click.'
                    )}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </MantineWrapper>
  );
}
