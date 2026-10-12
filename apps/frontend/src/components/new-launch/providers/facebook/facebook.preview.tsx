import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { textSlicer } from '@gitroom/helpers/utils/count.length';
import { FACEBOOK_PRESET_MAX_CHARS } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/facebook.dto';
import { getPresetBackground } from '@gitroom/frontend/components/new-launch/providers/facebook/facebook.background';
import { FC } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

const Icons = () => {
  return (
    <svg
      width="31"
      height="16"
      viewBox="0 0 31 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 0C5.87827 0 3.84344 0.842855 2.34315 2.34315C0.842855 3.84344 0 5.87827 0 8C0 10.1217 0.842855 12.1566 2.34315 13.6569C3.84344 15.1571 5.87827 16 8 16C10.1217 16 12.1566 15.1571 13.6569 13.6569C15.1571 12.1566 16 10.1217 16 8C16 5.87827 15.1571 3.84344 13.6569 2.34315C12.1566 0.842855 10.1217 0 8 0Z"
        fill="url(#paint0_linear_2511_139661)"
      />
      <path
        d="M12.162 7.338C12.338 7.461 12.5 7.583 12.5 8.012C12.5 8.442 12.271 8.616 12.026 8.737C12.1262 8.90028 12.1581 9.09637 12.115 9.283C12.038 9.627 11.723 9.894 11.443 9.973C11.564 10.167 11.602 10.358 11.458 10.593C11.273 10.888 11.112 11 10.4 11H7.5C6.512 11 6 10.454 6 10V7.665C6 6.435 7.467 5.39 7.467 4.535L7.361 3.47C7.356 3.405 7.369 3.246 7.419 3.2C7.499 3.121 7.72 3 8.054 3C8.272 3 8.417 3.041 8.588 3.123C9.169 3.4 9.32 4.101 9.32 4.665C9.32 4.936 8.906 5.748 8.85 6.029C8.85 6.029 9.717 5.837 10.729 5.83C11.79 5.824 12.478 6.02 12.478 6.672C12.478 6.933 12.259 7.195 12.162 7.338ZM3.6 7H4.4C4.55913 7 4.71174 7.06321 4.82426 7.17574C4.93679 7.28826 5 7.44087 5 7.6V11.4C5 11.5591 4.93679 11.7117 4.82426 11.8243C4.71174 11.9368 4.55913 12 4.4 12H3.6C3.44087 12 3.28826 11.9368 3.17574 11.8243C3.06321 11.7117 3 11.5591 3 11.4V7.6C3 7.44087 3.06321 7.28826 3.17574 7.17574C3.28826 7.06321 3.44087 7 3.6 7Z"
        fill="white"
      />
      <path
        d="M23 0C20.8783 0 18.8434 0.842855 17.3431 2.34315C15.8429 3.84344 15 5.87827 15 8C15 10.1217 15.8429 12.1566 17.3431 13.6569C18.8434 15.1571 20.8783 16 23 16C25.1217 16 27.1566 15.1571 28.6569 13.6569C30.1571 12.1566 31 10.1217 31 8C31 5.87827 30.1571 3.84344 28.6569 2.34315C27.1566 0.842855 25.1217 0 23 0Z"
        fill="url(#paint1_linear_2511_139661)"
      />
      <path
        d="M25.473 4C23.275 4 23 5.824 23 5.824C23 5.824 22.726 4 20.528 4C18.414 4 17.798 6.222 18.056 7.41C18.736 10.55 23 12.75 23 12.75C23 12.75 27.265 10.55 27.945 7.41C28.202 6.222 27.585 4 25.473 4Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="paint0_linear_2511_139661"
          x1="8"
          y1="0"
          x2="8"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#18AFFF" />
          <stop offset="1" stopColor="#0062DF" />
        </linearGradient>
        <linearGradient
          id="paint1_linear_2511_139661"
          x1="23"
          y1="0"
          x2="23"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FF6680" />
          <stop offset="1" stopColor="#E61739" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const FacebookPreview: FC<{
  maximumCharacters?: number;
}> = (props) => {
  const { value: topValue, integration } = useIntegration();
  const current = useLaunchStore((state) => state.current);
  const mediaDir = useMediaDirectory();

  // Facebook only renders the background on text-only posts up to 130 chars, so
  // reflect the real outcome here: the background shows when it will actually be
  // applied, and disappears (plain text) when it would be dropped.
  const control = useFormContext()?.control;
  const preset = useWatch({ control, name: 'text_format_preset_id' }) as
    | string
    | undefined;
  const firstText = stripHtmlValidation(
    'normal',
    topValue?.[0]?.content || '',
    true
  );
  const background =
    !!preset &&
    !topValue?.[0]?.image?.length &&
    firstText.length <= FACEBOOK_PRESET_MAX_CHARS
      ? getPresetBackground(preset)
      : undefined;

  const renderContent = topValue.map((p) => {
    const newContent = stripHtmlValidation(
      'normal',
      p.content.replace(
        /<span.*?data-mention-id="([.\s\S]*?)"[.\s\S]*?>([.\s\S]*?)<\/span>/gi,
        (match, match1, match2) => {
          return `[[[${match2}]]]`;
        }
      ),
      true
    );

    const { start, end } = textSlicer(
      integration?.identifier || '',
      props.maximumCharacters || 10000,
      newContent
    );

    const finalValue =
      newContent
        .slice(start, end)
        .replace(/\[\[\[([.\s\S]*?)]]]/, (match, match1) => {
          return `<span class="font-bold font-[arial]" style="color: #00D9FF">${match1}</span>`;
        }) +
      `<mark class="bg-red-500" data-tooltip-id="tooltip" data-tooltip-content="This text will be cropped">` +
      newContent.slice(end).replace(/\[\[\[([.\s\S]*?)]]]/, (match, match1) => {
        return `<span class="font-bold font-[arial]" style="color: #00D9FF">${match1}</span>`;
      }) +
      `</mark>`;

    return { text: finalValue, images: p.image };
  });
  return (
    <div className="py-[15px] flex flex-col px-[15px] w-full gap-[20px] bg-bgFacebook rounded-[12px]">
      <div className="flex gap-[8px]">
        <div className="w-[36px] h-[36px]">
          <img
            src={integration?.picture || '/no-picture.jpg'}
            alt="social"
            className="rounded-full relative z-[2] w-[36px] h-[36px]"
          />
        </div>
        <div className="flex flex-col leading-[18px]">
          <div className="text-[14px] font-[500]">{integration?.name}</div>
          <div className="text-[12px] font-[400] text-[#A3A3A3] flex gap-[4px] items-center">
            <span>30m •</span>
            <span>
              <HugeIcon name="globe" size={16} />
            </span>
          </div>
        </div>
      </div>
      {background ? (
        <div
          className="-mx-[15px] min-h-[320px] flex items-center justify-center text-center px-[32px] py-[32px] text-[28px] font-[700] leading-[36px] whitespace-pre-line break-words"
          style={{ background: background.background, color: background.text }}
          dangerouslySetInnerHTML={{
            __html: renderContent?.[0]?.text,
          }}
        />
      ) : (
        <div
          className="text-[14px] font-[400] whitespace-pre-line"
          dangerouslySetInnerHTML={{
            __html: renderContent?.[0]?.text,
          }}
        />
      )}
      {!!renderContent?.[0]?.images?.length && (
        <div className="h-[280px] -mx-[15px] overflow-hidden flex">
          {renderContent?.[0]?.images.map((image, index) => (
            <a
              key={`image_${index}`}
              className="flex-1"
              href={mediaDir.set(image.path)}
              target="_blank"
            >
              <VideoOrImage autoplay={true} src={mediaDir.set(image.path)} />
            </a>
          ))}
        </div>
      )}
      <div className="flex text-textLinkedin text-[12px] font-[400] items-center">
        <div className="flex flex-1 gap-[10px] items-center">
          <Icons />
          <div className="">You & 12 other</div>
        </div>
        <div className="gap-[9px] items-center flex">
          <div>20 Comments</div>
        </div>
      </div>
      <div className="pt-[8px] flex text-[14px] font-[700] px-[32px] justify-between border-t border-borderLinkedin text-textLinkedin">
        <div className="flex gap-[4px] items-center">
          <HugeIcon name="thumbs-up" size={20} />
          <div>Like</div>
        </div>
        <div className="flex gap-[4px] items-center">
          <HugeIcon name="comment" size={20} />
          <div>Comments</div>
        </div>
        <div className="flex gap-[4px] items-center">
          <HugeIcon name="share" size={20} />
          <div>Share</div>
        </div>
      </div>
      {renderContent.length > 1 && (
        <>
          <div className="flex items-center">
            <div className="text-[14px] font-[700]">Most relevant</div>
            <div>
              <HugeIcon name="chevron-down" size={16} />
            </div>
          </div>
          {renderContent.slice(1).map((value, index) => (
            <div key={index} className="flex flex-col gap-[12px]">
              <div className="flex gap-[6px] leading-[17px]">
                <div className="h-[34px]">
                  <img
                    src={integration?.picture || '/no-picture.jpg'}
                    alt="social"
                    className="rounded-full relative z-[2] h-[34px] w-[34px]"
                  />
                </div>
                <div className="flex flex-col gap-[6px] min-w-[150px]">
                  <div className="flex flex-col gap-[4px] bg-bgCommentFacebook py-[8px] px-[12px] rounded-[12px]">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-[6px]">
                        <div className="text-[13px] font-[500]">
                          {integration?.name}
                        </div>
                      </div>
                    </div>
                    <div
                      className="whitespace-pre-line text-[14px] font-[400]"
                      dangerouslySetInnerHTML={{
                        __html: value.text,
                      }}
                    />
                    {!!value.images?.length && (
                      <div className="h-[100px] mt-[12px] -mx-[15px] overflow-hidden flex">
                        {value.images.map((image, index) => (
                          <a
                            key={`image_${index}`}
                            className="flex-1"
                            href={mediaDir.set(image.path)}
                            target="_blank"
                          >
                            <VideoOrImage
                              autoplay={true}
                              src={mediaDir.set(image.path)}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex font-[400] text-[12px] text-textLinkedin items-center">
                    <div className="flex gap-[16px] flex-1">
                      <div className="font-[700]">9h</div>
                      <div className="font-[700]">Like</div>
                      <div className="font-[700]">Reply</div>
                    </div>
                    <div className="flex gap-[4px]">
                      <div>2</div>
                      <div>
                        <HugeIcon name="heart" size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
