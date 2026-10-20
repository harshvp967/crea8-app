'use client';

import React, {
  ChangeEvent,
  ClipboardEvent,
  FC,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@gitroom/react/form/button';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { Media } from '@prisma/client';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import EventEmitter from 'events';
import { useToaster } from '@gitroom/react/toaster/toaster';
import clsx from 'clsx';
import { VideoFrame } from '@gitroom/react/helpers/video.frame';
import { useUppyUploader } from '@gitroom/frontend/components/media/new.uploader';
import dynamic from 'next/dynamic';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { AiImage } from '@gitroom/frontend/components/launches/ai.image';
import { DropFiles } from '@gitroom/frontend/components/layout/drop.files';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ThirdPartyMedia } from '@gitroom/frontend/components/third-parties/third-party.media';
import { ReactSortable } from 'react-sortablejs';
import { MediaComponentInner } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { AiVideo } from '@gitroom/frontend/components/launches/ai.video';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ThirdPartyMediaLibrary } from '@gitroom/frontend/components/third-parties/third-party.media-library';
import { Dashboard } from '@uppy/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  DeleteCircleIcon,
  CloseCircleIcon,
  DragHandleIcon,
  MediaSettingsIcon,
  InsertMediaIcon,
  DesignMediaIcon,
  VerticalDividerIcon,
  NoMediaIcon,
} from '@gitroom/frontend/components/ui/icons';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useShallow } from 'zustand/react/shallow';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useDebounce } from 'use-debounce';
const Polonto = dynamic(
  () => import('@gitroom/frontend/components/launches/polonto')
);
const showModalEmitter = new EventEmitter();
export const Pagination: FC<{
  current: number;
  totalPages: number;
  setPage: (num: number) => void;
}> = (props) => {
  const t = useT();

  const { current, totalPages, setPage } = props;

  const paginationItems = useMemo(() => {
    // Convert to 1-based for algorithm (current is 0-based)
    const c = current + 1;
    const m = totalPages;

    // If total pages <= 10, show all pages
    if (m <= 10) {
      return Array.from({ length: m }, (_, i) => i + 1);
    }

    const delta = 3;
    const left = c - delta;
    const right = c + delta + 1;
    const range: number[] = [];
    const rangeWithDots: (number | '...')[] = [];
    let l: number | undefined;

    // Build the range of pages to show
    for (let i = 1; i <= m; i++) {
      if (i === 1 || i === m || (i >= left && i < right)) {
        range.push(i);
      }
    }

    // Add dots where there are gaps
    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    // Limit to maximum 10 items by trimming pages near edges if needed
    while (rangeWithDots.length > 10) {
      const currentIndex = rangeWithDots.findIndex((item) => item === c);
      if (currentIndex !== -1 && currentIndex > rangeWithDots.length / 2) {
        // Current is in second half, remove one item from start side
        rangeWithDots.splice(2, 1);
      } else {
        // Current is in first half, remove one item from end side
        rangeWithDots.splice(-3, 1);
      }
    }

    return rangeWithDots;
  }, [current, totalPages]);

  return (
    <ul className="flex flex-row items-center gap-1 justify-center mt-[15px]">
      <li className={clsx(current === 0 && 'opacity-20 pointer-events-none')}>
        <div
          className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-[14px] text-[14px] font-[500] h-10 px-4 py-2 gap-1 ps-2.5 text-textItemBlur hover:text-newTextColor border border-newBorder bg-newBgColorInner"
          aria-label="Go to previous page"
          onClick={() => setPage(current - 1)}
        >
          <ChevronLeftIcon className="lucide lucide-chevron-left h-4 w-4" />
          <span>{t('previous', 'Previous')}</span>
        </div>
      </li>
      {paginationItems.map((item, index) => (
        <li key={index}>
          {item === '...' ? (
            <span className="inline-flex items-center justify-center h-10 w-10 text-textColor select-none">
              ...
            </span>
          ) : (
            <div
              aria-current="page"
              onClick={() => setPage(item - 1)}
              className={clsx(
                'cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-[14px] font-[500] border h-10 w-10 border-newBorder',
                current === item - 1
                  ? 'arc-selected text-newTextColor'
                  : 'text-textItemBlur hover:text-newTextColor bg-newBgColorInner'
              )}
            >
              {item}
            </div>
          )}
        </li>
      ))}
      <li
        className={clsx(
          current + 1 === totalPages && 'opacity-20 pointer-events-none'
        )}
      >
        <a
          className="text-textItemBlur hover:text-newTextColor group cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-[14px] text-[14px] font-[500] h-10 px-4 py-2 gap-1 pe-2.5 border border-newBorder bg-newBgColorInner"
          aria-label="Go to next page"
          onClick={() => setPage(current + 1)}
        >
          <span>{t('next', 'Next')}</span>
          <ChevronRightIcon className="lucide lucide-chevron-right h-4 w-4" />
        </a>
      </li>
    </ul>
  );
};
export const ShowMediaBoxModal: FC = () => {
  const modals = useModals();
  const t = useT();
  useEffect(() => {
    showModalEmitter.on('show-modal', (cCallback) => {
      modals.openModal({
        title: t('media_library', 'Media Library'),
        askClose: false,
        closeOnEscape: true,
        fullScreen: true,
        size: 'calc(100% - 80px)',
        height: 'calc(100% - 80px)',
        children: (close) => (
          <MediaBox
            setMedia={(media) => cCallback(media[0])}
            closeModal={close}
          />
        ),
      });
    });
    return () => {
      showModalEmitter.removeAllListeners('show-modal');
    };
  }, []);
  return null;
};
export const showMediaBox = (
  callback: (params: { id: string; path: string }) => void
) => {
  showModalEmitter.emit('show-modal', callback);
};
const CHUNK_SIZE = 1024 * 1024;
const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024; // 1 GB
const libraryImageExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'];

function libraryKind(path: string, name = '') {
  const pathKnown =
    hasExtension(path, 'mp4') ||
    libraryImageExt.some((ext) => hasExtension(path, ext));
  const labeled = pathKnown ? path : name || path;
  if (hasExtension(labeled, 'mp4')) {
    return 'video';
  }
  if (libraryImageExt.some((ext) => hasExtension(labeled, ext))) {
    return 'image';
  }
  return 'file';
}
export const MediaBox: FC<{
  setMedia: (params: { id: string; path: string }[]) => void;
  standalone?: boolean;
  type?: 'image' | 'video';
  closeModal: () => void;
}> = ({ type, standalone, setMedia }) => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  // Standalone page only. The Composer picker keeps its own `type` prop and
  // must not send this filter.
  const [listType, setListType] = useState<'all' | 'image' | 'video'>('all');
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);
  const loadMedia = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page + 1) });
    if (debouncedSearch.trim()) {
      params.set('search', debouncedSearch.trim());
    }
    if (standalone) {
      params.set('type', listType);
    }
    return (await fetch(`/media?${params.toString()}`)).json();
  }, [page, debouncedSearch, standalone, listType]);
  const { data, mutate, isLoading } = useSWR(
    standalone
      ? `get-media-${page}-${debouncedSearch}-${listType}`
      : `get-media-${page}-${debouncedSearch}`,
    loadMedia
  );
  const [selected, setSelected] = useState([]);
  const t = useT();
  const uploaderRef = useRef<any>(null);
  const mediaDirectory = useMediaDirectory();
  const [loading, setLoading] = useState(false);

  const uppy = useUppyUploader({
    allowedFileTypes:
      type == 'image'
        ? 'image/*'
        : type == 'video'
        ? 'video/mp4'
        : 'image/*,video/mp4',
    onUploadSuccess: async (arr) => {
      await mutate();
      if (standalone) {
        return;
      }
      setSelected((prevSelected) => {
        return [...prevSelected, ...arr];
      });
    },
    onStart: () => setLoading(true),
    onEnd: () => setLoading(false),
  });

  const addRemoveSelected = useCallback(
    (media: any) => () => {
      if (standalone) {
        return;
      }
      const exists = selected.find((p: any) => p.id === media.id);
      if (exists) {
        setSelected(selected.filter((f: any) => f.id !== media.id));
        return;
      }
      setSelected([...selected, media]);
    },
    [selected]
  );

  const addMedia = useCallback(async () => {
    if (standalone) {
      return;
    }
    // @ts-ignore
    setMedia(selected);
    modals.closeCurrent();
  }, [selected]);

  const addToUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_UPLOAD_SIZE) {
        toaster.show(
          t(
            'upload_size_limit_exceeded',
            'Upload size limit exceeded. Maximum 1 GB per upload session.'
          ),
          'warning'
        );
        return;
      }

      setLoading(true);

      // @ts-ignore
      uppy.addFiles(files);
    },
    [toaster, t]
  );

  const dragAndDrop = useCallback(
    async (event: ClipboardEvent<HTMLDivElement> | File[]) => {
      // @ts-ignore
      const clipboardItems = event.map((p) => ({
        kind: 'file',
        getAsFile: () => p,
      }));
      if (!clipboardItems) {
        return;
      }

      const files: File[] = [];
      // @ts-ignore
      for (const item of clipboardItems) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      const totalSize = files.reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_UPLOAD_SIZE) {
        toaster.show(
          t(
            'upload_size_limit_exceeded',
            'Upload size limit exceeded. Maximum 1 GB per upload session.'
          ),
          'warning'
        );
        return;
      }

      setLoading(true);

      for (const file of files) {
        uppy.addFile(file);
      }
    },
    [toaster, t]
  );

  const maximize = useCallback(
    (media: Media) => async (e: any) => {
      e.stopPropagation();
      modals.openModal({
        title: '',
        top: 10,
        children: (
          <div className="w-full h-full p-[50px]">
            {hasExtension(media.path, 'mp4') ? (
              <VideoFrame
                autoplay={true}
                url={mediaDirectory.set(media.path)}
              />
            ) : (
              <img
                width="100%"
                height="100%"
                className="w-full h-full max-h-[100%] max-w-[100%] object-cover"
                src={mediaDirectory.set(media.path)}
                alt="media"
              />
            )}
          </div>
        ),
      });
    },
    []
  );

  const deleteImage = useCallback(
    (media: Media) => async (e: any) => {
      e.stopPropagation();
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_you_want_to_delete_the_image',
            'Are you sure you want to delete the image?'
          )
        ))
      ) {
        return;
      }
      await fetch(`/media/${media.id}`, {
        method: 'DELETE',
      });
      mutate();
    },
    [mutate]
  );

  const btn = useMemo(() => {
    return (
      <button
        disabled={loading}
        onClick={() => uploaderRef?.current?.click()}
        className={clsx(
          'relative cursor-pointer flex gap-[8px] h-[44px] px-[16px] justify-center items-center font-[600] text-[14px]',
          standalone
            ? 'media-upload'
            : 'po-upload-btn bg-transparent border border-newBorder text-textColor rounded-[18px] hover:bg-newBgColor transition-colors'
        )}
      >
        {loading ? (
          <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
            <div className="animate-spin h-[20px] w-[20px] border-4 border-[#00D9FF] border-t-transparent rounded-full" />
          </div>
        ) : standalone ? (
          <HugeIcon name="plus" size={18} />
        ) : (
          <PlusIcon size={14} />
        )}
        <div className={loading ? 'invisible' : undefined}>{t('upload', 'Upload')}</div>
      </button>
    );
  }, [t, loading, standalone]);

  const visibleMedia = (data?.results || []).filter((f: any) => {
    if (type === 'video') {
      return hasExtension(f.path, 'mp4');
    }
    if (type === 'image') {
      return !hasExtension(f.path, 'mp4');
    }
    return true;
  });
  const libraryEmpty = !isLoading && !data?.results?.length;

  return (
    <DropFiles
      disabled={loading}
      className={clsx(
        'flex flex-col flex-1 min-h-0',
        standalone ? 'media-library-body' : 'po-library'
      )}
      onDrop={dragAndDrop}
    >
      <div className={clsx('flex flex-col flex-1 min-h-0', standalone && 'media-stack')}>
        <input
          type="file"
          ref={uploaderRef}
          onChange={addToUpload}
          className="hidden"
          multiple={true}
        />
        {standalone ? (
          <>
            <div className="media-head">
              <div className="media-head-text">
                <div className="media-kicker">
                  <span className="media-sticker">{t('schedule', 'Schedule')}</span>
                  <span className="media-period">
                    {t('your_uploads', 'Your uploads')}
                  </span>
                </div>
                <h1>{t('media', 'Media')}</h1>
              </div>
              <div className="media-head-actions">
                {btn}
                <ThirdPartyMediaLibrary onImported={() => mutate()} />
              </div>
            </div>
            <div className="media-toolbar">
              <label className="media-search">
                <HugeIcon name="search" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('search_media_by_name', 'Search by file name')}
                />
              </label>
              <SegmentedControl
                variant="pill"
                className="media-types"
                aria-label={t('media_type', 'Media type')}
                value={listType}
                onValueChange={(value) => {
                  const next = value as 'all' | 'image' | 'video';
                  if (next === listType) {
                    return;
                  }
                  setListType(next);
                  setPage(0);
                }}
                options={[
                  { value: 'all', label: t('all', 'All') },
                  { value: 'image', label: t('images', 'Images') },
                  { value: 'video', label: t('videos', 'Videos') },
                ]}
              />
            </div>
          </>
        ) : (
          <div
            className={clsx(
              'flex items-center gap-[12px]',
              libraryEmpty && !debouncedSearch && 'hidden'
            )}
          >
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search_media_by_name', 'Search by file name')}
                className="w-full h-[44px] px-[16px] rounded-full bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div className="flex gap-[8px]">
              {btn}
              <ThirdPartyMediaLibrary onImported={() => mutate()} />
            </div>
          </div>
        )}
        <div
          className={clsx(
            'w-full pointer-events-none relative mt-[5px] mb-[5px]',
            standalone && 'media-progress',
            !standalone && !loading && 'hidden'
          )}
        >
          <div className="w-full h-[46px] overflow-hidden absolute left-0 bg-newBgColorInner uppyChange">
            <Dashboard
              height={46}
              uppy={uppy}
              id={`uploader`}
              showProgressDetails={true}
              hideUploadButton={true}
              hideRetryButton={true}
              hidePauseResumeButton={true}
              hideCancelButton={true}
              hideProgressAfterFinish={true}
            />
          </div>
          <div className="w-full h-[46px] uppyChange" />
        </div>
        <div
          className={clsx(
            standalone ? 'media-scroller' : 'flex-1 min-h-0 flex flex-col',
            !standalone &&
              libraryEmpty &&
              'bg-newTextColor/[0.02] rounded-[12px]'
          )}
        >
          <div
            className={clsx(
              !standalone &&
                'po-library-scroll flex-1 min-h-0 overflow-x-hidden overflow-y-auto scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner',
              !standalone &&
                libraryEmpty &&
                'flex justify-center items-center gap-[20px] flex-col'
            )}
          >
            {libraryEmpty && (
              standalone ? (
                debouncedSearch || listType !== 'all' ? (
                  <div className="media-state-card is-search">
                    <span className="media-state-tile is-search" aria-hidden="true">
                      <HugeIcon name="search" size={25} />
                    </span>
                    <p className="media-state-body">
                      {t(
                        'no_media_match_search',
                        'No media matches your search'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="media-state-card is-empty">
                    <span className="media-state-tile is-empty" aria-hidden="true">
                      <HugeIcon name="image" size={25} />
                    </span>
                    <div className="media-state-text">
                      <h2 className="media-state-title">
                        {t(
                          'you_dont_have_any_media_yet',
                          "You don't have any media yet"
                        )}
                      </h2>
                      <p className="media-state-body">
                        {t(
                          'select_or_upload_pictures_max_1gb',
                          'Select or upload pictures (maximum 1 GB per upload).'
                        )}{' '}
                        {t(
                          'you_can_drag_drop_pictures',
                          'You can also drag & drop pictures.'
                        )}
                      </p>
                    </div>
                  </div>
                )
              ) : (
              <>
                <NoMediaIcon />
                <div className="text-[20px] font-[600]">
                  {debouncedSearch
                    ? t(
                        'no_media_match_search',
                        'No media matches your search'
                      )
                    : t(
                        'you_dont_have_any_media_yet',
                        "You don't have any media yet"
                      )}
                </div>
                <div className="whitespace-pre-line text-newTextColor/[0.6] text-center">
                  {t(
                    'select_or_upload_pictures_max_1gb',
                    'Select or upload pictures (maximum 1 GB per upload).'
                  )}{' '}
                  {'\n'}
                  {t(
                    'you_can_drag_drop_pictures',
                    'You can also drag & drop pictures.'
                  )}
                </div>
                <div className="forceChange flex gap-[8px]">
                  {btn}
                  <ThirdPartyMediaLibrary onImported={() => mutate()} />
                </div>
              </>
              )
            )}
            {isLoading && standalone && (
              <div className="media-grid" aria-hidden>
                {[...new Array(12)].map((_, i) => (
                  <div className="media-tile" key={i}>
                    <div className="media-thumb media-skel" />
                    <div className="media-caption">
                      <div className="media-skel-line" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isLoading && !standalone && (
              <div className="po-media-grid">
                {[...new Array(6)].map((_, i) => (
                  <div className="po-media-card" key={i}>
                    <div className="po-media-thumb bg-newSep animate-pulse" />
                    <div className="po-file-name">
                      <span className="inline-block h-[10px] w-[70%] rounded bg-newSep" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {standalone && !isLoading && (
              <div className="media-grid">
                {visibleMedia.map((media: any) => {
                  const kind = libraryKind(
                    media.path,
                    media.originalName || media.name || ''
                  );
                  const label = media.originalName || media.name || '';
                  return (
                    <div
                      className={clsx(
                        'media-tile',
                        !!selected.find((p: any) => p.id === media.id) &&
                          'is-selected'
                      )}
                      key={media.id}
                    >
                      <div
                        className="media-thumb"
                        onClick={addRemoveSelected(media)}
                      >
                        {!!selected.find((p: any) => p.id === media.id) && (
                          <div className="media-pick">
                            {selected.findIndex((z: any) => z.id === media.id) +
                              1}
                          </div>
                        )}
                        <div className="media-actions">
                          <button
                            type="button"
                            className="media-zoom"
                            onClick={maximize(media)}
                            aria-label={t('preview', 'Preview')}
                          >
                            <HugeIcon name="expand" size={12} />
                          </button>
                          <button
                            type="button"
                            className="media-remove"
                            onClick={deleteImage(media)}
                            aria-label={t('delete', 'Delete')}
                          >
                            <HugeIcon name="trash" size={12} />
                          </button>
                        </div>
                        {kind === 'image' ? (
                          <img
                            className="media-img"
                            src={mediaDirectory.set(media.path)}
                            alt=""
                          />
                        ) : (
                          <span
                            className={clsx(
                              'media-kind',
                              kind === 'video' && 'is-video'
                            )}
                            aria-hidden
                          >
                            {kind === 'video' ? (
                              <HugeIcon name="play" size={24} />
                            ) : (
                              <HugeIcon name="file" size={24} />
                            )}
                          </span>
                        )}
                      </div>
                      <div className="media-caption">
                        <span className="media-name" title={label}>
                          {label}
                        </span>
                        <button
                          type="button"
                          className="media-foot-delete"
                          onClick={deleteImage(media)}
                          aria-label={t('delete', 'Delete')}
                        >
                          <HugeIcon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!standalone && !isLoading && (
              <div className="po-media-grid">
                {visibleMedia.map((media: any) => {
                  const fileLabel = media.originalName || media.name || '';
                  const picked = !!selected.find((p: any) => p.id === media.id);
                  return (
                    <div
                      className={clsx(
                        'po-media-card group',
                        picked && 'is-selected'
                      )}
                      key={media.id}
                      onClick={addRemoveSelected(media)}
                    >
                      <div className="po-media-thumb">
                        {picked ? (
                          <div className="po-media-check" aria-hidden>
                            <HugeIcon name="check" size={12} />
                          </div>
                        ) : (
                          <DeleteCircleIcon
                            className="cursor-pointer hidden z-[100] group-hover:block absolute top-[8px] end-[8px]"
                            onClick={deleteImage(media)}
                          />
                        )}
                        <div className="po-media-ph" aria-hidden>
                          <HugeIcon name="image" size={24} />
                        </div>
                        <button
                          type="button"
                          className="po-media-zoom"
                          onClick={maximize(media)}
                          aria-label={t('preview', 'Preview')}
                        >
                          <HugeIcon name="expand" size={14} />
                        </button>
                        {hasExtension(media.path, 'mp4') ? (
                          <VideoFrame url={mediaDirectory.set(media.path)} />
                        ) : (
                          <img
                            className="po-media-img"
                            src={mediaDirectory.set(media.path)}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.classList.add('is-broken');
                            }}
                          />
                        )}
                      </div>
                      <div className="po-file-name" title={fileLabel}>
                        {fileLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {(data?.pages || 0) > 1 && (
          <div className={standalone ? 'media-pages' : undefined}>
            <Pagination
              current={page}
              totalPages={data?.pages}
              setPage={setPage}
            />
          </div>
        )}
        {!standalone && (
          <div className="po-library-foot flex justify-end mt-[16px] gap-[8px] items-center">
            {selected.length > 0 && (
              <div className="me-auto text-[13px] font-[500] text-textItemBlur">
                {selected.length} selected
              </div>
            )}
            <button
              onClick={() => modals.closeCurrent()}
              className="cursor-pointer h-[44px] px-[20px] items-center justify-center border border-newBorder bg-newBgColorInner text-newTextColor flex rounded-[18px] font-[600]"
            >
              {t('cancel', 'Cancel')}
            </button>
            {!isLoading && !!data?.results?.length && (
              <button
                onClick={standalone ? () => {} : addMedia}
                disabled={selected.length === 0}
                className="cursor-pointer text-[#0A0A0A] disabled:opacity-80 disabled:cursor-not-allowed h-[44px] px-[20px] items-center justify-center bg-btnPrimary hover:brightness-95 flex rounded-[18px] font-[600]"
              >
                {t('add_selected_media', 'Add selected media')}
              </button>
            )}
          </div>
        )}
      </div>
    </DropFiles>
  );
};
export const MultiMediaComponent: FC<{
  label: string;
  description: string;
  mediaNotAvailable?: boolean;
  dummy: boolean;
  allData: {
    content: string;
    id?: string;
    image?: Array<{
      id: string;
      path: string;
    }>;
  }[];
  value?: Array<{
    path: string;
    id: string;
  }>;
  text: string;
  name: string;
  error?: any;
  onOpen?: () => void;
  onClose?: () => void;
  toolBar?: React.ReactNode;
  information?: React.ReactNode;
  extra?: React.ReactNode;
  insertInContent?: (media: Array<{ id: string; path: string }>) => void;
  onChange: (event: {
    target: {
      name: string;
      value?: Array<{
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }>;
    };
  }) => void;
  /** Idea box only: Insert media and AI image, with the same handlers. */
  bar?: 'full' | 'idea';
}> = (props) => {
  const {
    name,
    error,
    text,
    onChange,
    value,
    allData,
    dummy,
    label,
    toolBar,
    information,
    extra,
    mediaNotAvailable,
    insertInContent,
  } = props;
  const user = useUser();
  const modals = useModals();
  const t = useT();
  const { plontoKey } = useVariables();
  const designReady = !!plontoKey;
  useEffect(() => {
    if (value) {
      setCurrentMedia(value);
    }
  }, [value]);

  const [currentMedia, setCurrentMedia] = useState(value);
  const mediaList = Array.isArray(currentMedia) ? currentMedia : [];
  const mediaDirectory = useMediaDirectory();
  const changeMedia = useCallback(
    (
      m:
        | {
            path: string;
            id: string;
          }
        | {
            path: string;
            id: string;
          }[]
    ) => {
      const mediaArray = Array.isArray(m) ? m : [m];
      if (insertInContent) {
        insertInContent(mediaArray);
        return;
      }

      const newMedia = [...mediaList, ...mediaArray];
      setCurrentMedia(newMedia);
      onChange({
        target: {
          name,
          value: newMedia,
        },
      });
    },
    [insertInContent, mediaList]
  );
  const showModal = useCallback(() => {
    props.onOpen?.();
    modals.openModal({
      title: t('media_library', 'Media Library'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      classNames: { modal: 'po-media-modal' },
      children: (close) => (
        <MediaBox
          setMedia={changeMedia}
          closeModal={close}
          type={insertInContent ? 'image' : undefined}
        />
      ),
    });
  }, [changeMedia, insertInContent, t, props.onOpen]);

  const clearMedia = useCallback(
    (topIndex: number) => () => {
      const newMedia = mediaList.filter((_, index) => index !== topIndex);
      setCurrentMedia(newMedia);
      onChange({
        target: {
          name,
          value: newMedia,
        },
      });
    },
    [mediaList]
  );

  const designMedia = useCallback(() => {
    if (!designReady || !user?.tier?.ai || dummy) {
      return;
    }
    modals.openModal({
      askClose: false,
      title: t('design_media', 'Design Media'),
      size: '80%',
      children: (close) => (
        <Polonto setMedia={changeMedia} closeModal={close} />
      ),
    });
  }, [changeMedia, designReady, dummy, t, user?.tier?.ai]);

  if (props.bar === 'idea') {
    return (
      <div className="c8-idea-attach">
        <button
          type="button"
          onClick={showModal}
          className="c8-attach cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]"
        >
          <div className="flex gap-[8px] items-center">
            <div>
              <InsertMediaIcon />
            </div>
            <div className="text-[10px] font-[600] whitespace-nowrap">
              {t('insert_media', 'Insert media')}
            </div>
          </div>
        </button>
        {!!user?.tier?.ai && (
          <AiImage value={text} onChange={changeMedia} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="b1 flex flex-col gap-[8px] rounded-bl-[8px] select-none w-full">
        <div className="flex gap-[10px] px-[12px]">
          {mediaList.length > 0 && (
            <ReactSortable
              list={mediaList}
              setList={(value) =>
                onChange({ target: { name: 'upload', value } })
              }
              className="flex gap-[10px] sortable-container"
              animation={200}
              swap={true}
              handle=".dragging"
            >
              {mediaList.map((media, index) => (
                  <div key={media.id} className="cursor-pointer rounded-[5px] w-[40px] h-[40px] border-2 border-tableBorder relative flex transition-all">
                    <DragHandleIcon className="z-[20] dragging absolute pe-[1px] pb-[3px] -start-[4px] -top-[4px] cursor-move" />

                    <div className="w-full h-full relative group">
                      <div
                        onClick={async () => {
                          modals.openModal({
                            title: t('media_settings', 'Media Settings'),
                            children: (close) => (
                              <MediaComponentInner
                                media={media as any}
                                onClose={close}
                                onSelect={(value: any) => {
                                  onChange({
                                    target: {
                                      name: 'upload',
                                      value: mediaList.map((p) => {
                                        if (p.id === media.id) {
                                          return {
                                            ...p,
                                            ...value,
                                          };
                                        }
                                        return p;
                                      }),
                                    },
                                  });
                                }}
                              />
                            ),
                          });
                        }}
                        className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] bg-black/80 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-[9]"
                      >
                        <MediaSettingsIcon className="cursor-pointer relative z-[200]" />
                      </div>
                      {hasExtension(media?.path, 'mp4') ? (
                        <VideoFrame url={mediaDirectory.set(media?.path)} />
                      ) : (
                        <img
                          className="w-full h-full object-cover rounded-[4px]"
                          src={mediaDirectory.set(media?.path)}
                        />
                      )}
                    </div>

                    <CloseCircleIcon
                      onClick={clearMedia(index)}
                      className="absolute -end-[4px] -top-[4px] z-[20] rounded-full bg-white"
                    />
                  </div>
              ))}
            </ReactSortable>
          )}
        </div>
        <div className="po-attach flex gap-[8px] px-[12px] border-t border-newColColor w-full b1 text-textColor">
          {!mediaNotAvailable && (
            <div className="flex py-[10px] b2 items-center gap-[4px]">
              {!!label && (
                <div className="po-attach-label items-center text-[13px] font-[500] text-textItemBlur whitespace-nowrap pe-[4px]">
                  {label}
                </div>
              )}
              <button
                type="button"
                onClick={showModal}
                className="c8-attach cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]"
              >
                <div className="flex gap-[8px] items-center">
                  <div>
                    <InsertMediaIcon />
                  </div>
                  <div className="text-[10px] font-[600] maxMedia:hidden block">
                    {t('insert_media', 'Insert media')}
                  </div>
                </div>
              </button>
              {designReady && (
                <button
                  type="button"
                  onClick={designMedia}
                  className="c8-attach cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]"
                >
                  <div className="flex gap-[5px] items-center">
                    <div>
                      <DesignMediaIcon />
                    </div>
                    <div className="text-[10px] font-[600] iconBreak:hidden block">
                      {t('design_media', 'Design media')}
                    </div>
                  </div>
                </button>
              )}

              {!insertInContent && (
                <ThirdPartyMedia allData={allData} onChange={changeMedia} />
              )}

              {!!user?.tier?.ai && (
                <>
                  <AiImage value={text} onChange={changeMedia} />
                  {!insertInContent && (
                    <AiVideo value={text} onChange={changeMedia} />
                  )}
                </>
              )}
            </div>
          )}
          {!mediaNotAvailable && (
            <div className="text-newColColor h-full flex items-center">
              <VerticalDividerIcon />
            </div>
          )}
          {!!toolBar && (
            <div className="flex py-[10px] b2 items-center gap-[4px]">
              {toolBar}
            </div>
          )}
          {information && (
            <div className="flex-1 justify-end flex py-[10px] b2 items-center gap-[4px]">
              {information}
            </div>
          )}
          {extra && (
            <div className="po-card-extra ms-auto flex items-center gap-[10px] py-[8px]">
              {extra}
            </div>
          )}
        </div>
      </div>
      <div className="text-[12px] text-red-400">{error}</div>
    </>
  );
};
export const MediaComponent: FC<{
  label: string;
  description: string;
  value?: {
    path: string;
    id: string;
  };
  name: string;
  onChange: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
      };
    };
  }) => void;
  type?: 'image' | 'video';
  width?: number;
  height?: number;
}> = (props) => {
  const t = useT();

  const { name, type, label, description, onChange, value, width, height } =
    props;
  const { getValues } = useSettings();
  const user = useUser();
  const { plontoKey } = useVariables();
  useEffect(() => {
    const settings = getValues()[props.name];
    if (settings) {
      setCurrentMedia(settings);
    }
  }, []);
  const [currentMedia, setCurrentMedia] = useState(value);
  const modals = useModals();
  const mediaDirectory = useMediaDirectory();

  const showDesignModal = useCallback(() => {
    if (!plontoKey) {
      return;
    }
    modals.openModal({
      title: t('media_editor', 'Media Editor'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      children: (close) => (
        <Polonto
          width={width}
          height={height}
          setMedia={changeMedia}
          closeModal={close}
        />
      ),
    });
  }, [plontoKey, t]);
  const changeMedia = useCallback((m: { path: string; id: string }[]) => {
    setCurrentMedia(m[0]);
    onChange({
      target: {
        name,
        value: m[0],
      },
    });
  }, []);
  const showModal = useCallback(() => {
    modals.openModal({
      title: t('media_library', 'Media Library'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      children: (close) => (
        <MediaBox setMedia={changeMedia} closeModal={close} type={type} />
      ),
    });
  }, [t]);
  const clearMedia = useCallback(() => {
    setCurrentMedia(undefined);
    onChange({
      target: {
        name,
        value: undefined,
      },
    });
  }, [value]);
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="text-[14px]">{label}</div>
      <div className="text-[12px]">{description}</div>
      {!!currentMedia && (
        <div className="my-[20px] cursor-pointer w-[200px] h-[200px] border-2 border-tableBorder">
          <img
            className="w-full h-full object-cover"
            src={currentMedia.path}
            onClick={() => window.open(mediaDirectory.set(currentMedia.path))}
          />
        </div>
      )}
      <div className="flex gap-[5px]">
        <Button onClick={showModal}>{t('select', 'Select')}</Button>
        {!!plontoKey && (
          <Button onClick={showDesignModal} className="!bg-customColor45">
            {t('editor', 'Editor')}
          </Button>
        )}
        <Button secondary={true} onClick={clearMedia}>
          {t('clear', 'Clear')}
        </Button>
      </div>
    </div>
  );
};
