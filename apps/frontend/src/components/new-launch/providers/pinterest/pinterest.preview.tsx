import { FC } from 'react';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { textSlicer } from '@gitroom/helpers/utils/count.length';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const PinterestPreview: FC<{
  maximumCharacters?: number;
}> = (props) => {
  const { value: topValue, integration } = useIntegration();
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
    <div className="absolute left-0 top-0 gap-[10px] w-full h-full flex flex-col p-[16px] bg-bgYoutube">
      <div className="h-[40px] items-center flex">
        <div className="flex gap-[16px] flex-1 items-center">
          <div className="flex gap-[8px] items-center">
            <HugeIcon name="heart" size={20} />
            <div>80</div>
          </div>
          <div>
            <HugeIcon name="comment" size={20} />
          </div>
          <div>
            <HugeIcon name="upload" size={20} />
          </div>
          <div>
            <HugeIcon name="more" size={18} />
          </div>
        </div>
        <div className="h-full flex rounded-[12px] text-[16px] font-[600] w-[100px] bg-[#E70024] text-white justify-center items-center">
          Save
        </div>
      </div>
      <div
        style={{ background: 'url(/no-video-youtube.png)' }}
        className="!bg-cover w-full aspect-[calc(16/9)] rounded-[20px] overflow-hidden"
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
      <div
        className="mt-[13px] whitespace-pre-line"
        dangerouslySetInnerHTML={{ __html: renderContent?.[0]?.text || '' }}
      ></div>
    </div>
  );
};
