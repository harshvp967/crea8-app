'use client';

import {
  FC,
  useMemo,
} from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { TikTokDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/tiktok.dto';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { Select } from '@gitroom/react/form/select';
import { Checkbox } from '@gitroom/react/form/checkbox';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { Input } from '@gitroom/react/form/input';
import { TiktokPreview } from '@gitroom/frontend/components/new-launch/providers/tiktok/tiktok.preview';
import { TikTokMusicSelector } from '@gitroom/frontend/components/new-launch/providers/tiktok/tiktok.music';
import { TikTokLocationSelector } from '@gitroom/frontend/components/new-launch/providers/tiktok/tiktok.location';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

const TikTokSettings: FC<{
  values?: any;
}> = (props) => {
  const { watch, register } = useSettings();
  const { value, integration } = useIntegration();
  const t = useT();

  // Music and location come from the Business API (v1.3) - the legacy Content
  // Posting API used by the "tiktok" identifier has no such fields.
  const isBusiness = integration?.identifier === 'tiktok-business';

  const isTitle = useMemo(() => {
    return value?.[0]?.image?.some((p) => (p?.path?.indexOf?.('mp4') ?? -1) === -1);
  }, [value]);

  const hasMedia = (value?.[0]?.image?.length ?? 0) > 0;
  const isVideo = hasMedia && !isTitle;

  const disclose = watch('disclose');
  const autoAddMusic = watch('autoAddMusic');
  const brand_organic_toggle = watch('brand_organic_toggle');
  const brand_content_toggle = watch('brand_content_toggle');
  const content_posting_method = watch('content_posting_method');
  const isUploadMode = content_posting_method === 'UPLOAD';

  // TikTok ignores every setting except the title / content when the posting
  // method is UPLOAD, so we hide them rather than pretend they apply. The fields
  // stay mounted and registered: their values must survive the switch, and
  // TikTokDto still requires most of them at save time.
  const directPostOnly = clsx(isUploadMode && 'invisible h-0 overflow-hidden');

  const tiktokRestrictionNotice = useMemo(() => {
    if (!hasMedia || !isVideo) return null;
    if (!isUploadMode) {
      return t(
        'tiktok_restriction_direct_video',
        'TikTok restriction: For direct post with video, your post content is used as the title. A separate title field is not available.'
      );
    }
    return t(
      'tiktok_restriction_upload_video',
      'TikTok restriction: For upload-only video, TikTok does not accept a title or message. The content will default to "#Crea8one" and you can edit it inside the TikTok app before publishing.'
    );
  }, [hasMedia, isUploadMode, isVideo, t]);

  const privacyLevel = [
    {
      value: 'PUBLIC_TO_EVERYONE',
      label: t('public_to_everyone', 'Public to everyone'),
    },
    {
      value: 'MUTUAL_FOLLOW_FRIENDS',
      label: t('mutual_follow_friends', 'Mutual follow friends'),
    },
    {
      value: 'FOLLOWER_OF_CREATOR',
      label: t('follower_of_creator', 'Follower of creator'),
    },
    {
      value: 'SELF_ONLY',
      label: t('self_only', 'Self only'),
    },
  ];
  const contentPostingMethod = [
    {
      value: 'DIRECT_POST',
      label: t(
        'post_content_directly_to_tiktok',
        'Post content directly to TikTok'
      ),
    },
    {
      value: 'UPLOAD',
      label: t(
        'upload_content_to_tiktok_without_posting',
        'Upload content to TikTok without posting it'
      ),
    },
  ];
  const yesNo = [
    {
      value: 'yes',
      label: t('yes', 'Yes'),
    },
    {
      value: 'no',
      label: t('no', 'No'),
    },
  ];

  return (
    <div className="flex flex-col">
      {/*<CheckTikTokValidity picture={props?.values?.[0]?.image?.[0]?.path} />*/}
      {tiktokRestrictionNotice && (
        <div className="bg-tableBorder p-[10px] mb-[18px] rounded-[10px] flex gap-[10px] items-start text-[13px] text-balance">
          <div className="shrink-0 mt-[2px]">
            <HugeIcon name="alert" size={20} />
          </div>
          <div>{tiktokRestrictionNotice}</div>
        </div>
      )}
      {isTitle && <Input label="Title" {...register('title')} maxLength={89} />}
      <div className={directPostOnly}>
        <Select
          label={t('label_who_can_see_this_video', 'Who can see this video?')}
          disabled={isUploadMode}
          {...register('privacy_level', {
            value: 'PUBLIC_TO_EVERYONE',
          })}
        >
          <option value="">{t('select', 'Select')}</option>
          {privacyLevel.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="text-[14px] mt-[10px] mb-[18px] text-balance">
        {t(
          'choose_upload_without_posting_description',
          `Choose upload without posting if you want to review and edit your content within TikTok's app before publishing.
        This gives you access to TikTok's built-in editing tools and lets you make final adjustments before posting. The additional settings are only available when posting directly to TikTok.`
        )}
      </div>
      <Select
        label={t('label_content_posting_method', 'Content posting method')}
        {...register('content_posting_method', {
          value: 'DIRECT_POST',
        })}
      >
        <option value="">{t('select', 'Select')}</option>
        {contentPostingMethod.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
      {isUploadMode && <div className="-mt-[23px] mb-[23px] text-red-600">After posting you fill find a notification inside your Inbox about your post (not content studio)</div>}
      <div className={clsx('flex flex-col', directPostOnly)}>
        <Select
          label={
            isBusiness
              ? t('label_add_random_music', 'Add random music')
              : t('label_auto_add_music', 'Auto add music')
          }
          disabled={isUploadMode}
          {...register('autoAddMusic', {
            value: 'no',
          })}
        >
          <option value="">{t('select', 'Select')}</option>
          {yesNo.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <div className="text-[14px] mt-[10px] mb-[24px] text-balance">
          {isBusiness
            ? t(
                'tiktok_random_music_only_for_photos',
                'This feature is available only for photos, it adds a random trending track from TikTok\'s commercial music library.'
              )
            : t(
                'this_feature_available_only_for_photos',
                'This feature available only for photos, it will add a default music that\n        you can change later.'
              )}
        </div>
        {isBusiness && (
          <div className="flex flex-col gap-[18px] mb-[24px]">
            {/* Random music replaces a manual choice for photos, so the
                selector is hidden (but stays registered) while it's on. */}
            <div
              className={clsx(
                !isVideo &&
                  autoAddMusic === 'yes' &&
                  'invisible h-0 overflow-hidden'
              )}
            >
              <TikTokMusicSelector
                label={t('tiktok_music_label', 'Music')}
                showVolumes={isVideo}
                {...register('music')}
              />
            </div>
            <TikTokLocationSelector
              label={t('tiktok_location_label', 'Location')}
              {...register('location')}
            />
          </div>
        )}
        <hr className="mb-[15px] border-tableBorder" />
        <div className="text-[14px] mb-[10px]">
          {t('tiktok_video_features', 'Video features')}
        </div>
        <div className="flex gap-[40px]">
          <Checkbox
            variant="hollow"
            label={t('label_duet', 'Allow Duet')}
            disabled={isUploadMode}
            {...register('duet', {
              value: false,
            })}
          />
          <Checkbox
            label={t('label_stitch', 'Allow Stitch')}
            variant="hollow"
            disabled={isUploadMode}
            {...register('stitch', {
              value: false,
            })}
          />
          <Checkbox
            label={t('video_made_with_ai', 'Video made with AI')}
            variant="hollow"
            disabled={isUploadMode}
            {...register('video_made_with_ai', {
              value: false,
            })}
          />
        </div>
        <hr className="my-[15px] mb-[25px] border-tableBorder" />
        <div className="flex flex-col gap-[20px]">
          <Checkbox
            label={t('label_comments', 'Allow Comments')}
            variant="hollow"
            disabled={isUploadMode}
            {...register('comment', {
              value: true,
            })}
          />
          <Checkbox
            variant="hollow"
            label={t('label_disclose_video_content', 'Disclose Video Content')}
            disabled={isUploadMode}
            {...register('disclose', {
              value: false,
            })}
          />
          {disclose && (
            <div className="bg-tableBorder p-[10px] mt-[10px] rounded-[10px] flex gap-[20px] items-center">
              <div>
                <HugeIcon name="alert" size={24} className="text-white" />
              </div>
              <div>
                {t(
                  'your_video_will_be_labeled_promotional',
                  'Your video will be labeled "Promotional Content".'
                )}
                <br />
                {t(
                  'this_cannot_be_changed_once_posted',
                  'This cannot be changed once your video is posted.'
                )}
              </div>
            </div>
          )}
          <div className="text-[14px] my-[10px] text-balance">
            {t(
              'turn_on_to_disclose_video_promotes',
              'Turn on to disclose that this video promotes goods or services in\n          exchange for something of value. You video could promote yourself, a\n          third party, or both.'
            )}
          </div>
        </div>
        <div className={clsx(!disclose && 'invisible h-0 overflow-hidden', 'mt-[20px]')}>
          <Checkbox
            variant="hollow"
            label={t('label_your_brand', 'Your brand')}
            disabled={isUploadMode}
            {...register('brand_organic_toggle', {
              value: false,
            })}
          />
          <div className="text-balance my-[10px] text-[14px]">
            {t(
              'you_are_promoting_yourself',
              'You are promoting yourself or your own brand.'
            )}
            <br />
            {t(
              'this_video_will_be_classified_brand_organic',
              'This video will be classified as Brand Organic.'
            )}
          </div>
          <Checkbox
            variant="hollow"
            label={t('label_branded_content', 'Branded content')}
            disabled={isUploadMode}
            {...register('brand_content_toggle', {
              value: false,
            })}
          />
          <div className="text-balance my-[10px] text-[14px]">
            {t(
              'you_are_promoting_another_brand',
              'You are promoting another brand or a third party.'
            )}
            <br />
            {t(
              'this_video_will_be_classified_branded_content',
              'This video will be classified as Branded Content.'
            )}
          </div>
          {(brand_organic_toggle || brand_content_toggle) && (
            <div className="my-[10px] text-[14px] text-balance">
              {t(
                'by_posting_you_agree_to_tiktoks',
                "By posting, you agree to TikTok's"
              )}
              {[
                brand_organic_toggle || brand_content_toggle ? (
                  <a
                    target="_blank"
                    className="text-[#B69DEC] hover:underline"
                    href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                  >
                    {t('music_usage_confirmation', 'Music Usage Confirmation')}
                  </a>
                ) : undefined,
                brand_content_toggle ? <> {t('and', 'and')} </> : undefined,
                brand_content_toggle ? (
                  <a
                    target="_blank"
                    className="text-[#B69DEC] hover:underline"
                    href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                  >
                    {t('branded_content_policy', 'Branded Content Policy')}
                  </a>
                ) : undefined,
              ].filter((f) => f)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: TikTokSettings,
  comments: false,
  CustomPreviewComponent: TiktokPreview,
  dto: TikTokDto,
  maximumCharacters: 2000,
});
