import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { textSlicer } from '@gitroom/helpers/utils/count.length';
import { FC } from 'react';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { SliderComponent } from '@gitroom/frontend/components/third-parties/slider.component';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const InstagramPreview: FC<{
  maximumCharacters?: number;
}> = (props) => {
  const { value: topValue, integration } = useIntegration();
  const current = useLaunchStore((state) => state.current);
  const mediaDir = useMediaDirectory();

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
      `<strong class="text-[15px] font-[600]">${integration?.name} </strong>` +
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
    <div className="py-[10px] flex flex-col px-[15px] w-full gap-[10px] bg-bgInstagram rounded-[12px]">
      <div className="flex gap-[10px] items-center">
        <div className="w-[36px] h-[36px]">
          <img
            src={integration?.picture || '/no-picture.jpg'}
            alt="social"
            className="rounded-full relative z-[2] w-[36px] h-[36px]"
          />
        </div>
        <div className="flex flex-col leading-[18px]">
          <div className="text-[15px] font-[600]">{integration?.name}</div>
        </div>
      </div>
      {!!renderContent?.[0]?.images?.length ? (
        <SliderComponent
          className="h-[585px] rounded-[8px] overflow-hidden"
          list={renderContent?.[0]?.images.map((image, index) => (
            <a
              key={`image_${index}`}
              className="flex-1"
              href={mediaDir.set(image.path)}
              target="_blank"
            >
              <VideoOrImage autoplay={true} src={mediaDir.set(image.path)} />
            </a>
          ))}
        />
      ) : (
        <div
          style={{ background: 'url(/no-video-youtube.png)' }}
          className="!bg-cover w-full aspect-[calc(16/9)] rounded-[8px] overflow-hidden"
        />
      )}
      <div
        className="text-[14px] font-[400] whitespace-pre-line"
        dangerouslySetInnerHTML={{
          __html: renderContent?.[0]?.text,
        }}
      />
      <div className="py-[8px] text-textColor flex text-[14px] font-[700] gap-[10.5px]">
        <div className="flex gap-[4px] items-center">
          <HugeIcon name="heart" size={20} />
          <div>121</div>
        </div>
        <div className="flex gap-[4px] items-center">
          <HugeIcon name="comment" size={20} />
          <div>32</div>
        </div>
        <div className="flex gap-[4px] items-center flex-1">
          <HugeIcon name="send" size={20} />
        </div>
        <div className="flex gap-[4px] items-center">
          <HugeIcon name="bookmark" size={20} />
        </div>
      </div>
      {renderContent.length > 1 && (
        <>
          {renderContent.slice(1).map((value, index) => (
            <div key={index} className="flex flex-col gap-[12px]">
              <div className="flex gap-[10px] leading-[17px]">
                <div className="h-[34px]">
                  <img
                    src={integration?.picture || '/no-picture.jpg'}
                    alt="social"
                    className="rounded-full relative z-[2] h-[34px] w-[34px]"
                  />
                </div>
                <div className="flex flex-col gap-[6px] flex-1">
                  <div className="flex gap-[4px] py-[8px]">
                    <div
                      className="whitespace-pre-line text-[14px] font-[400] flex-1"
                      dangerouslySetInnerHTML={{
                        __html: value.text,
                      }}
                    />
                    <div>
                      <HugeIcon name="heart" size={18} />
                    </div>
                  </div>
                  <div className="flex font-[400] text-[12px] text-textLinkedin items-center">
                    <div className="flex gap-[16px] flex-1">
                      <div className="font-[700]">30m</div>
                      <div className="font-[700]">8 Likes</div>
                      <div className="font-[700]">Reply</div>
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
