import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { textSlicer } from '@gitroom/helpers/utils/count.length';
import { FC, ReactNode } from 'react';
import { SliderComponent } from '@gitroom/frontend/components/third-parties/slider.component';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

const TikTokItem: FC<{ icon: ReactNode; num: string }> = ({ icon, num }) => {
  return (
    <div className="flex items-center flex-col">
      <div className="w-[29px] h-[29px] rounded-full bg-bgTiktokItem flex justify-center items-center text-bgTiktokItemIcon">
        {icon}
      </div>
      <div className="text-[8px] font-[700] text-bgTiktokItemIcon">{num}</div>
    </div>
  );
};
export const TiktokPreview: FC<{
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
    <div className="p-[15px] absolute left-0 top-0 w-full h-full flex justify-center bg-newBgColorInner">
      <div className="relative">
        <SliderComponent
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
          className="h-full bg-black aspect-[calc(9/16)] rounded-[3px] overflow-hidden"
        />
        <div className="absolute pointer-events-none w-full h-full start-0 top-0 px-[12px] py-[25px] justify-end items-start text-white flex flex-col">
          <div className="text-[14px] font-[500]">@{integration?.name}</div>
          <div className="text-[13px] font-[400] whitespace-pre-line line-clamp-6 w-full"
            dangerouslySetInnerHTML={{ __html: renderContent?.[0]?.text || '' }}
          />
        </div>
      </div>
      <div className="flex flex-col justify-end gap-[10px] ml-[18px]">
        <div className="relative">
          <img
            src={integration?.picture || '/no-picture.jpg'}
            alt="social"
            className="rounded-full z-[2] w-[29px] h-[29px]"
          />
          <div className="absolute left-[50%] -translate-x-[50%] bottom-0 translate-y-[50%] z-[1]">
            <HugeIcon name="add-circle" size={16} />
          </div>
        </div>
        <TikTokItem
          num="1.3M"
          icon={
            <HugeIcon name="heart" size={16} />
          }
        />
        <TikTokItem
          num="10.7M"
          icon={
            <HugeIcon name="comment" size={16} />
          }
        />
        <TikTokItem
          num="1.2M"
          icon={
            <HugeIcon name="bookmark" size={16} />
          }
        />
        <TikTokItem
          num="1.2M"
          icon={
            <HugeIcon name="share" size={16} />
          }
        />
        <div>
          <img
            src={integration?.picture || '/no-picture.jpg'}
            alt="social"
            className="rounded-full relative z-[2] w-[29px] h-[29px]"
          />
        </div>
      </div>
    </div>
  );
};
