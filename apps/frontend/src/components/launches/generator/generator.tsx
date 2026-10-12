'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useRouter } from 'next/navigation';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { GeneratorDto } from '@gitroom/nestjs-libraries/dtos/generator/generator.dto';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Textarea } from '@gitroom/react/form/textarea';
import { Checkbox } from '@gitroom/react/form/checkbox';
import clsx from 'clsx';
import {
  CalendarWeekProvider,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import dayjs from 'dayjs';
import { Select } from '@gitroom/react/form/select';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

const FirstStep: FC = (props) => {
  const { integrations, reloadCalendarView } = useCalendar();
  const modal = useModals();
  const fetch = useFetch();
  const toaster = useToaster();
  const [loading, setLoading] = useState(false);
  const [showStep, setShowStep] = useState('');
  const t = useT();
  const resolver = useMemo(() => {
    return classValidatorResolver(GeneratorDto);
  }, []);
  const form = useForm({
    mode: 'all',
    resolver,
    values: {
      research: '',
      isPicture: false,
      format: 'one_short',
      tone: 'personal',
    },
  });
  const [research] = form.watch(['research']);
  const generateStep = useCallback(
    async (reader: ReadableStreamDefaultReader) => {
      const decoder = new TextDecoder('utf-8');
      let lastResponse = {} as any;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) return lastResponse.data.output;

        // Convert chunked binary data to string
        const chunkStr = decoder.decode(value, {
          stream: true,
        });
        for (const chunk of chunkStr
          .split('\n')
          .filter((f) => f && f.indexOf('{') > -1)) {
          let data: any;
          try {
            data = JSON.parse(chunk);
          } catch (e) {
            /** ignore partial / unparseable chunks **/
            continue;
          }

          // Server emits this when a node in the generation graph throws.
          if (data?.error) {
            throw new Error(
              data.message ||
                t('generation_failed', 'Failed to generate posts, please try again.')
            );
          }

          {
            switch (data.name) {
              case 'agent':
                setShowStep(t('agent_starting', 'Agent starting'));
                break;
              case 'research':
                setShowStep(
                  t('researching_your_content', 'Researching your content...')
                );
                break;
              case 'find-category':
                setShowStep(
                  t(
                    'understanding_the_category',
                    'Understanding the category...'
                  )
                );
                break;
              case 'find-topic':
                setShowStep(t('finding_the_topic', 'Finding the topic...'));
                break;
              case 'find-popular-posts':
                setShowStep(
                  t(
                    'finding_popular_posts_to_match_with',
                    'Finding popular posts to match with...'
                  )
                );
                break;
              case 'generate-hook':
                setShowStep(t('generating_hook', 'Generating hook...'));
                break;
              case 'generate-content':
                setShowStep(t('generating_content', 'Generating content...'));
                break;
              case 'generate-picture':
                setShowStep(t('generating_pictures', 'Generating pictures...'));
                break;
              case 'upload-pictures':
                setShowStep(t('uploading_pictures', 'Uploading pictures...'));
                break;
              case 'post-time':
                setShowStep(
                  t('finding_time_to_post', 'Finding time to post...')
                );
                break;
            }
            lastResponse = data;
          }
        }
      }
    },
    [t]
  );
  const onSubmit: SubmitHandler<{
    research: string;
  }> = useCallback(
    async (value) => {
      setLoading(true);
      try {
        const response = await fetch('/posts/generator', {
          method: 'POST',
          body: JSON.stringify(value),
        });
        if (!response.body) {
          throw new Error(
            t('generation_failed', 'Failed to generate posts, please try again.')
          );
        }
        const reader = response.body.getReader();
        const load = await generateStep(reader);
        if (!load?.content) {
          throw new Error(
            t('generation_failed', 'Failed to generate posts, please try again.')
          );
        }
        const messages = load.content.map((p: any, index: number) => {
          if (index === 0) {
            return {
              content: load.hook + '\n' + p.content,
              ...(p?.image?.path
                ? {
                    image: [p.image],
                  }
                : {}),
            };
          }
          return {
            content: p.content,
            ...(p?.image?.path
              ? {
                  image: [p.image],
                }
              : {}),
          };
        });
        setShowStep('');
        modal.openModal({
          id: 'add-edit-modal',
          closeOnClickOutside: false,
          removeLayout: true,
          closeOnEscape: false,
          withCloseButton: false,
          askClose: true,
          fullScreen: true,
          classNames: {
            modal: 'w-[100%] max-w-[1400px] text-textColor',
          },
          children: (
            <AddEditModal
              allIntegrations={integrations.map((p) => ({
                ...p,
              }))}
              integrations={integrations.slice(0).map((p) => ({
                ...p,
              }))}
              mutate={reloadCalendarView}
              date={dayjs.utc(load.date).local()}
              reopenModal={() => ({})}
              onlyValues={messages}
            />
          ),
          size: '80%',
        });
      } catch (e: any) {
        toaster.show(
          e?.message ||
            t('generation_failed', 'Failed to generate posts, please try again.'),
          'warning'
        );
      } finally {
        setShowStep('');
        setLoading(false);
      }
    },
    [integrations, reloadCalendarView, fetch, generateStep, modal, toaster, t]
  );
  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className={loading ? 'pointer-events-none select-none opacity-75' : ''}
    >
      <FormProvider {...form}>
        <div className="flex flex-col">
          <div className="pb-[10px] rounded-[4px]">
            <div className="flex">
              <div className="flex-1">
                {!showStep ? (
                  <div className="loading-shimmer pb-[10px]">&nbsp;</div>
                ) : (
                  <div
                    className="loading-shimmer pb-[10px]"
                    data-text={showStep}
                  >
                    {showStep}
                  </div>
                )}
                <Textarea
                  label={t('write_anything', 'Write anything')}
                  disabled={loading}
                  placeholder={t(
                    'you_can_write_anything_you_want_and_also_add_links_we_will_do_the_research_for_you',
                    'You can write anything you want, and also add links, we will do the research for you...'
                  )}
                  {...form.register('research')}
                />
                <Select
                  label={t('output_format', 'Output format')}
                  {...form.register('format')}
                >
                  <option value="one_short">
                    {t('short_post', 'Short post')}
                  </option>
                  <option value="one_long">
                    {t('long_post', 'Long post')}
                  </option>
                  <option value="thread_short">
                    {t(
                      'a_thread_with_short_posts',
                      'A thread with short posts'
                    )}
                  </option>
                  <option value="thread_long">
                    {t('a_thread_with_long_posts', 'A thread with long posts')}
                  </option>
                </Select>
                <Select
                  label={t('output_format', 'Output format')}
                  {...form.register('tone')}
                >
                  <option value="personal">
                    {t(
                      'personal_voice_i_am_happy_to_announce',
                      'Personal voice ("I am happy to announce")'
                    )}
                  </option>
                  <option value="company">
                    {t(
                      'company_voice_we_are_happy_to_announce',
                      'Company voice ("We are happy to announce")'
                    )}
                  </option>
                </Select>
                <div
                  className={clsx('flex items-center', loading && 'opacity-50')}
                >
                  <Checkbox
                    disabled={loading}
                    {...form.register('isPicture')}
                    label={t('add_pictures', 'Add pictures?')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-[20px] flex justify-end">
          <Button
            type="submit"
            disabled={research.length < 10}
            loading={loading}
          >
            {t('generate', 'Generate')}
          </Button>
        </div>
      </FormProvider>
    </form>
  );
};
export const GeneratorPopup = () => {
  const t = useT();

  const modals = useModals();
  const closeAll = useCallback(() => {
    modals.closeAll();
  }, []);
  return (
    <div className="w-full flex flex-col rounded-[4px] relative">
      <FirstStep />
    </div>
  );
};
export const GeneratorComponent = () => {
  const t = useT();
  const user = useUser();
  const router = useRouter();
  const modal = useModals();
  const all = useCalendar();
  const generate = useCallback(async () => {
    if (!user?.tier?.ai) {
      if (
        await deleteDialog(
          t('upgrade_required', 'You need to upgrade to use this feature'),
          t('move_to_billing', 'Move to billing'),
          t('payment_required', 'Payment Required')
        )
      ) {
        router.push('/billing');
      }
      return;
    }
    modal.openModal({
      title: t('generate_posts', 'Generate Posts'),
      withCloseButton: false,
      classNames: {
        modal: 'bg-transparent text-textColor',
      },
      size: 'xl',
      children: (
        <CalendarWeekProvider {...all}>
          <GeneratorPopup />
        </CalendarWeekProvider>
      ),
    });
  }, [user, all]);
  return (
    <div
      className="h-[44px] w-[44px] group-[.sidebar]:w-full bg-ai justify-center items-center flex rounded-[8px] cursor-pointer"
      onClick={generate}
    >
      <HugeIcon name="sparkles" size={20} className="text-white" />
    </div>
  );
};
