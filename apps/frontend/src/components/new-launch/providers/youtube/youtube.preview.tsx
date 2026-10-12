import { FC } from 'react';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { textSlicer } from '@gitroom/helpers/utils/count.length';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const YoutubePreview: FC<{
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
    <div className="absolute left-0 top-0 gap-[12px] w-full h-full flex flex-col p-[16px] bg-bgYoutube">
      <div
        style={{ background: 'url(/no-video-youtube.png)' }}
        className="!bg-cover w-full aspect-[calc(16/9)] rounded-[4px] overflow-hidden"
      >
        {!!renderContent?.[0]?.images?.[0]?.path && (
          <VideoOrImage
            imageClassName="w-full aspect-[calc(16/9)]"
            videoClassName="w-full aspect-[calc(16/9)] bg-black"
            autoplay={true}
            src={mediaDir.set(renderContent?.[0]?.images?.[0]?.path || '')}
          />
        )}
      </div>
      <div className="flex items-center">
        <div className="flex flex-1 gap-[17px] items-center">
          <div>
            <img
              src={integration?.picture || '/no-picture.jpg'}
              alt="social"
              className="rounded-full z-[2] w-[40px] h-[40px]"
            />
          </div>
          <div className="flex flex-col">
            <div className="text-[14px] font-[500]">{integration?.name}</div>
            <div className="text-[10px] font-[400]">16.7M subscribers</div>
          </div>
          <div>
            <div className="h-[32px] text-[12px] text-newBgColor font-[500] px-[14px] flex justify-center items-center bg-youtubeButton rounded-[16px]">
              Subscribe
            </div>
          </div>
        </div>
        <div className="gap-[4px] flex items-center text-youtubeSvg">
          <div className="bg-youtubeBgAction text-[13px] px-[9px] h-[32px] rounded-[16px] flex items-center">
            <HugeIcon name="thumbs-up" size={16} className="mr-[9px]" />
            <div className="mr-[14px]">205K</div>
            <div className="h-[20px] w-[1px] bg-[#A0A0A0] mr-[12px]" />
            <HugeIcon name="thumbs-down" size={16} />
          </div>
          <div className="h-[32px] w-[32px] rounded-full bg-youtubeBgAction flex justify-center items-center">
            <HugeIcon name="share" size={18} />
          </div>
          <div className="h-[32px] w-[32px] rounded-full bg-youtubeBgAction flex justify-center items-center">
            <HugeIcon name="more" size={16} />
          </div>
        </div>
      </div>
      <div
        className="bg-youtubeBgAction rounded-[12px] p-[12px] text-[12px] font-[400] whitespace-pre-line"
        dangerouslySetInnerHTML={{ __html: renderContent?.[0]?.text }}
      />
    </div>
  );
};
