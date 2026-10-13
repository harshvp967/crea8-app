'use client';

import { FC, ReactNode, useCallback, useState } from 'react';
import clsx from 'clsx';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import DeleteAccountComponent from '@gitroom/frontend/components/settings/delete-account.component';
const useFaqList = () => {
  const user = useUser();
  const t = useT();
  return [
    ...(user?.allowTrial
      ? [
          {
            title: t(
              'faq_am_i_going_to_be_charged_by_postiz',
              'Am I going to be charged by Crea8one?'
            ),
            description: t(
              'faq_to_confirm_credit_card_information_postiz_will_hold',
              'Checkout is handled by Dodo Payments, the merchant of record. Tax is added there. You can pay by card or UPI where Dodo offers it, and cancel anytime from billing. Email support@crea8.one if you need help.'
            ),
          },
        ]
      : []),
    {
      title: t(
        'faq_can_i_trust_postiz_gitroom',
        'Can I trust Crea8one?'
      ),
      description: t(
        'faq_postiz_gitroom_is_proudly_open_source',
        'Crea8one is proudly open-source! We believe in an ethical and transparent culture, meaning that Crea8one will live forever. You can check out the entire code or use it for personal projects. To view the open-source repository, <a href="https://github.com/harshvp967/crea8-app" target="_blank" style="text-decoration: underline;">click here</a>.'
      ),
    },
    {
      title: t('faq_what_are_channels', 'What are channels?'),
      description: t(
        'faq_postiz_gitroom_allows_you_to_schedule_posts',
        `Crea8one allows you to schedule your posts between different channels.
A channel is a publishing platform where you can schedule your posts.
For example, you can schedule your posts on X, Facebook, Instagram, TikTok, YouTube, Reddit, Linkedin, Dribbble, Threads and Pinterest.`
      ),
    },
    {
      title: t('faq_what_are_team_members', 'What are team members?'),
      description: t(
        'faq_if_you_have_a_team_with_multiple_members',
        'If you have a team with multiple members, you can invite them to your workspace to collaborate on your posts and add their personal channels'
      ),
    },
    ...(user?.tier?.current === 'FREE'
      ? [
          {
            title: t(
              'faq_how_can_i_delete_my_account',
              'How can I delete my account?'
            ),
            description: t(
              'faq_delete_account_description',
              `If you don't want to continue using Crea8one, you can delete your account, including all your organizations, channels and posts. This action cannot be undone.`
            ),
            content: <DeleteAccountComponent isLink={true} />,
          },
        ]
      : []),
  ];
};
export const FAQSection: FC<{
  title: string;
  description: string;
  content?: ReactNode;
}> = (props) => {
  const { title, description, content } = props;
  const [show, setShow] = useState(false);
  const changeShow = useCallback(() => {
    setShow(!show);
  }, [show]);
  return (
    <div
      className="bg-sixth p-[24px] border border-tableBorder rounded-[8px] flex flex-col"
      onClick={changeShow}
    >
      <div className={`text-[20px] cursor-pointer flex justify-center`}>
        <div className="flex-1">{title}</div>
        <div className="flex items-center justify-center w-[32px]">
          {!show ? (
            <HugeIcon name="plus" size={20} className="text-white" />
          ) : (
            <HugeIcon name="minus" size={20} className="text-[#ECECEC]" />
          )}
        </div>
      </div>
      <div
        className={clsx(
          'transition-all duration-500 overflow-hidden',
          !show ? 'max-h-[0]' : 'max-h-[500px]'
        )}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={`mt-[16px] w-full text-wrap font-[400] text-[16px] text-customColor17 select-text max-w-[450px]`}
          dangerouslySetInnerHTML={{
            __html: description,
          }}
        />
        {content && (
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="mt-[16px]"
          >
            {content}
          </div>
        )}
      </div>
    </div>
  );
};
export const FAQComponent: FC = () => {
  const t = useT();
  const list = useFaqList();
  return (
    <div>
      {/*<h3 className="text-[24px] mt-[48px] mb-[40px] tablet:mt-[80px]">*/}
      {/*  {t('frequently_asked_questions', 'Frequently Asked Questions')}*/}
      {/*</h3>*/}
      <div className="gap-[24px] flex-col flex select-none  mt-[48px] mb-[40px] tablet:mt-[80px]">
        {list.map((item, index) => (
          <FAQSection key={index} {...item} />
        ))}
      </div>
    </div>
  );
};
