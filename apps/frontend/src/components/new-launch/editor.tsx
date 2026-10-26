'use client';

import React, {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  ClipboardEvent,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import EmojiPicker from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import { BoldText } from '@gitroom/frontend/components/new-launch/bold.text';
import { UText } from '@gitroom/frontend/components/new-launch/u.text';
import { SignatureBox } from '@gitroom/frontend/components/signature';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  SelectedIntegrations,
  useLaunchStore,
} from '@gitroom/frontend/components/new-launch/store';
import { useShallow } from 'zustand/react/shallow';
import { AddPostButton } from '@gitroom/frontend/components/new-launch/add.post.button';
import { MultiMediaComponent } from '@gitroom/frontend/components/media/media.component';
import { UpDownArrow } from '@gitroom/frontend/components/launches/up.down.arrow';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useGrabToClose } from '@gitroom/frontend/components/launches/helpers/grab.to.close';
import {
  editorContentForValue,
  isEmptyEditorHtml,
} from '@gitroom/frontend/components/new-launch/editor.persist';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { useDropzone } from 'react-dropzone';
import { useUppyUploader } from '@gitroom/frontend/components/media/new.uploader';
import { Dashboard } from '@uppy/react';
import Link from '@tiptap/extension-link';
import {
  useEditor,
  EditorContent,
  Extension,
  Node,
  mergeAttributes,
} from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Bold from '@tiptap/extension-bold';
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import Underline from '@tiptap/extension-underline';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { History } from '@tiptap/extension-history';
import { BulletList, ListItem } from '@tiptap/extension-list';
import { Bullets } from '@gitroom/frontend/components/new-launch/bullets.component';
import Heading from '@tiptap/extension-heading';
import { Slice } from '@tiptap/pm/model';
import { HeadingComponent } from '@gitroom/frontend/components/new-launch/heading.component';
import Mention from '@tiptap/extension-mention';
import { suggestion } from '@gitroom/frontend/components/new-launch/mention.component';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { AComponent } from '@gitroom/frontend/components/new-launch/a.component';
import { Dropcursor, Placeholder, TrailingNode } from '@tiptap/extensions';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { InformationComponent } from '@gitroom/frontend/components/launches/information.component';
import {
  TrashIcon,
  EmojiIcon,
} from '@gitroom/frontend/components/ui/icons';
import { capitalize } from 'lodash';
import { DelayComponent } from '@gitroom/frontend/components/new-launch/delay.component';

const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024; // 1 GB

const InterceptBoldShortcut = Extension.create({
  name: 'preventBoldWithUnderline',

  addKeyboardShortcuts() {
    return {
      'Mod-b': () => {
        // For example, toggle bold while removing underline
        this?.editor?.commands?.unsetUnderline();
        return this?.editor?.commands?.toggleBold();
      },
    };
  },
});

const InterceptUnderlineShortcut = Extension.create({
  name: 'preventUnderlineWithUnderline',

  addKeyboardShortcuts() {
    return {
      'Mod-u': () => {
        // For example, toggle bold while removing underline
        this?.editor?.commands?.unsetBold();
        return this?.editor?.commands?.toggleUnderline();
      },
    };
  },
});

const EditorImage = Node.create({
  name: 'image',
  group: 'block',
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    };
  },

  // same rule as the server sanitizer, any other source is dropped on save
  parseHTML() {
    return [{ tag: 'img[src^="https://"], img[src^="http://"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', HTMLAttributes];
  },
});

const insertImages = (
  editor: any,
  media: { path: string; alt?: string }[]
) => {
  if (!media.length) {
    return;
  }

  editor
    ?.chain()
    ?.focus()
    ?.insertContent(
      media.map((p) => ({
        type: 'image',
        attrs: { src: p.path, alt: p.alt },
      }))
    )
    ?.run();
};

export const EditorWrapper: FC<{
  totalPosts: number;
  value: string;
}> = () => {
  const t = useT();
  const {
    setGlobalValueText,
    setInternalValueText,
    addRemoveInternal,
    internal,
    global,
    current,
    addInternalValue,
    addGlobalValue,
    setInternalValueMedia,
    appendInternalValueMedia,
    appendGlobalValueMedia,
    setGlobalValueMedia,
    changeOrderGlobal,
    changeOrderInternal,
    isCreateSet,
    deleteGlobalValue,
    deleteInternalValue,
    setGlobalValue,
    setInternalValue,
    setInternalDelay,
    setGlobalDelay,
    internalFromAll,
    totalChars,
    postComment,
    dummy,
    editor,
    inlineImages,
    loadedState,
    setLoadedState,
    selectedIntegration,
    chars,
    comments,
  } = useLaunchStore(
    useShallow((state) => ({
      internal: state.internal.find((p) => p.integration?.id === state.current),
      internalFromAll: state.integrations.find((p) => p.id === state.current),
      global: state.global,
      comments: state.comments,
      current: state.current,
      addRemoveInternal: state.addRemoveInternal,
      dummy: state.dummy,
      setInternalValueText: state.setInternalValueText,
      setGlobalValueText: state.setGlobalValueText,
      addInternalValue: state.addInternalValue,
      addGlobalValue: state.addGlobalValue,
      setGlobalValueMedia: state.setGlobalValueMedia,
      setInternalValueMedia: state.setInternalValueMedia,
      changeOrderGlobal: state.changeOrderGlobal,
      changeOrderInternal: state.changeOrderInternal,
      isCreateSet: state.isCreateSet,
      deleteGlobalValue: state.deleteGlobalValue,
      deleteInternalValue: state.deleteInternalValue,
      setGlobalValue: state.setGlobalValue,
      setInternalValue: state.setInternalValue,
      setGlobalDelay: state.setGlobalDelay,
      setInternalDelay: state.setInternalDelay,
      totalChars: state.totalChars,
      appendInternalValueMedia: state.appendInternalValueMedia,
      appendGlobalValueMedia: state.appendGlobalValueMedia,
      postComment: state.postComment,
      editor: state.editor,
      inlineImages: state.inlineImages,
      loadedState: state.loaded,
      setLoadedState: state.setLoaded,
      selectedIntegration: state.selectedIntegrations,
      chars: state.chars,
    }))
  );

  const existingData = useExistingData();
  const [loaded, setLoaded] = useState(true);

  useEffect(() => {
    if (loaded && loadedState) {
      return;
    }

    setLoadedState(true);
    setLoaded(true);
  }, [loaded, loadedState]);

  const canEdit = useMemo(() => {
    return current === 'global' || !!internal;
  }, [current, internal]);

  const items = useMemo(() => {
    if (internal) {
      return internal.integrationValue;
    }

    return global;
  }, [internal, global]);

  const setValue = useCallback(
    (value: string[]) => {
      const newValue = value.map((p, index) => {
        return {
          id: makeId(10),
          delay: 0,
          ...(items?.[index]?.media
            ? { media: items[index].media }
            : { media: [] }),
          content: p,
        };
      });
      if (internal) {
        return setInternalValue(current, newValue);
      }

      return setGlobalValue(newValue);
    },
    [internal, items]
  );

  useCopilotReadable({
    description: 'Current content of posts',
    value: items.map((p) => p.content),
  });

  useCopilotAction({
    name: 'setPosts',
    description: 'a thread of posts',
    parameters: [
      {
        name: 'content',
        type: 'string[]',
        description: 'a thread of posts',
      },
    ],
    handler: async ({ content }) => {
      setValue(content);
    },
  });

  const changeValue = useCallback(
    (index: number) => (value: string) => {
      if (internal) {
        return setInternalValueText(current, index, value);
      }

      return setGlobalValueText(index, value);
    },
    [current, global, internal]
  );

  const changeImages = useCallback(
    (index: number) => (value: any[]) => {
      if (internal) {
        return setInternalValueMedia(current, index, value);
      }

      return setGlobalValueMedia(index, value);
    },
    [current, global, internal]
  );

  const appendImages = useCallback(
    (index: number) => (value: any[]) => {
      if (internal) {
        return appendInternalValueMedia(current, index, value);
      }

      return appendGlobalValueMedia(index, value);
    },
    [current, global, internal]
  );

  const changeOrder = useCallback(
    (index: number) => (direction: 'up' | 'down') => {
      if (internal) {
        changeOrderInternal(current, index, direction);
        return setLoaded(false);
      }

      changeOrderGlobal(index, direction);
      setLoaded(false);
    },
    [changeOrderInternal, changeOrderGlobal, current, global, internal]
  );

  const platformLabel = useMemo(() => {
    return capitalize((internalFromAll?.identifier || '').split('-')[0]);
  }, [internalFromAll?.identifier]);

  const goBackToGlobal = useCallback(async () => {
    const platform = platformLabel || t('this_channel', 'this channel');
    if (
      await deleteDialog(
        t(
          'use_the_same_post_again_removed',
          'Use the same post again? Your {{platform}}-only text will be removed.',
          { platform }
        ),
        t('use_same_post_again', 'Use same post again')
      )
    ) {
      setLoaded(false);
      addRemoveInternal(current);
    }
  }, [addRemoveInternal, current, platformLabel, t]);

  const addValue = useCallback(
    (index: number) => () => {
      setTimeout(() => {
        // scroll the the bottom
        document.querySelector('#social-content').scrollTo({
          top: document.querySelector('#social-content').scrollHeight,
        });
      }, 20);
      if (internal) {
        return addInternalValue(index, current, [
          {
            delay: 0,
            content: '',
            id: makeId(10),
            media: [],
            added: true,
          },
        ]);
      }

      return addGlobalValue(index, [
        {
          delay: 0,
          content: '',
          id: makeId(10),
          media: [],
          added: true,
        },
      ]);
    },
    [current, global, internal]
  );

  const deletePost = useCallback(
    (index: number) => async () => {
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_delete_this_post',
            'Are you sure you want to delete this post?'
          ),
          t('delete', 'Delete'),
          t('are_you_sure', 'Are you sure?'),
          t('cancel', 'Cancel'),
          'danger'
        ))
      ) {
        return;
      }

      if (internal) {
        deleteInternalValue(current, index);
        return setLoaded(false);
      }

      deleteGlobalValue(index);
      setLoaded(false);
    },
    [current, global, internal, t]
  );

  if (!loaded || !loadedState) {
    return null;
  }

  return (
    <div
      className={clsx(
        'relative flex-col gap-[16px]',
        (items.length === 1 || !canEdit || !comments) && 'flex',
        ((!canEdit && !isCreateSet) || !comments) && 'bg-transparent'
      )}
    >
      {isCreateSet && current !== 'global' && (
        <>
          <div className="po-lock text-center absolute w-full h-full left-0 top-0 items-center justify-center flex z-[101] flex-col gap-[16px]">
            <div className="text-[14px] font-[600] text-white">
              {t(
                'cant_edit_networks_when_creating_set',
                "You can't edit networks when creating a set"
              )}
            </div>
          </div>
          <div className="po-lock-scrim absolute w-full h-full left-0 top-0 bg-newBackdrop opacity-60 z-[100] rounded-[12px]" />
        </>
      )}
      {!canEdit && !isCreateSet && (
        <>
          <div className="po-lock c8-lock-banner">
            <div className="c8-lock-copy">
              <div className="text-[14px] font-[600]">
                {t('same_post_on_every_channel', 'Same post on every channel')}
              </div>
            </div>
            <button
              type="button"
              className="c8-lock-btn"
              onClick={() => {
                setLoaded(false);
                addRemoveInternal(current);
              }}
            >
              {t('edit_for_platform_only', 'Edit for {{platform}} only', {
                platform:
                  platformLabel || t('this_channel', 'this channel'),
              })}
            </button>
          </div>
          <div className="po-lock-scrim absolute w-full h-full left-0 top-0 bg-newBackdrop opacity-60 z-[100] rounded-[12px]" />
        </>
      )}
      {!!internal && !existingData?.integration && (
        <div className="po-lock c8-lock-banner">
          <div className="c8-lock-copy">
            <div className="text-[14px] font-[600]">
              {t('editing_for_platform_only', 'Editing for {{platform}} only', {
                platform:
                  platformLabel || t('this_channel', 'this channel'),
              })}
            </div>
          </div>
          <button
            type="button"
            className="c8-lock-btn"
            onClick={goBackToGlobal}
          >
            {t('use_same_post_again', 'Use same post again')}
          </button>
        </div>
      )}
      {items.map((g, index) => (
        <div
          key={g.id}
          className={clsx(
            'po-editor-card relative flex flex-col min-w-0 w-full',
            !canEdit && !isCreateSet && 'blur-s',
            ((!canEdit && index > 0) || (!comments && index > 0)) && 'hidden'
          )}
        >
          <Editor
            comments={comments}
            editorType={editor}
            inlineImages={editor === 'html' && inlineImages && index === 0}
            allValues={items}
            onChange={changeValue(index)}
            key={index}
            num={index}
            totalPosts={global.length}
            value={g.content}
            pictures={g.media}
            setImages={changeImages(index)}
            autoComplete={canEdit}
            validateChars={true}
            identifier={internalFromAll?.identifier || 'global'}
            totalChars={totalChars}
            appendImages={appendImages(index)}
            dummy={dummy}
            selectedIntegration={selectedIntegration}
            chars={chars}
            footerExtra={
              comments && items.length > 1 ? (
                <div className="flex items-center gap-[10px]">
                  {index > 0 && (
                    <DelayComponent
                      currentIndex={index}
                      currentDelay={g.delay}
                    />
                  )}
                  <UpDownArrow
                    isUp={index !== 0}
                    isDown={index !== items.length - 1}
                    onChange={changeOrder(index)}
                  />
                  <TrashIcon
                    onClick={deletePost(index)}
                    data-tooltip-id="tooltip"
                    data-tooltip-content={t(
                      'delete_post_tooltip',
                      'Delete Post'
                    )}
                    className="cursor-pointer text-[#FF3F3F]"
                  />
                </div>
              ) : null
            }
          />
        </div>
      ))}
      {canEdit && !!comments && items.length > 0 && (
        <AddPostButton
          num={items.length - 1}
          onClick={addValue(items.length - 1)}
          postComment={postComment}
        />
      )}
    </div>
  );
};

export const Editor: FC<{
  editorType?: 'none' | 'normal' | 'markdown' | 'html';
  inlineImages?: boolean;
  totalPosts: number;
  value: string;
  num?: number;
  pictures?: any[];
  allValues?: any[];
  onChange: (value: string) => void;
  setImages?: (value: any[]) => void;
  appendImages?: (value: any[]) => void;
  autoComplete?: boolean;
  validateChars?: boolean;
  comments: boolean | 'no-media';
  identifier?: string;
  totalChars?: number;
  selectedIntegration: SelectedIntegrations[];
  dummy: boolean;
  chars: Record<string, number>;
  childButton?: React.ReactNode;
  footerExtra?: React.ReactNode;
}> = (props) => {
  const {
    editorType = 'normal',
    inlineImages = false,
    allValues,
    pictures,
    setImages,
    num,
    identifier,
    appendImages,
    dummy,
    chars,
    childButton,
    footerExtra,
    comments,
  } = props;
  const [id] = useState(makeId(10));
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [emojiAnchor, setEmojiAnchor] = useState({
    sheet: false,
    top: 0,
    left: 0,
    width: 360,
    height: 420,
  });
  const emojiSheetRef = useRef<HTMLDivElement>(null);
  useGrabToClose(emojiSheetRef, emojiPickerOpen, () => setEmojiPickerOpen(false));
  useEffect(() => {
    if (!emojiPickerOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Node | null;
      if (
        !target ||
        emojiSheetRef.current?.contains(target as globalThis.Node) ||
        emojiButtonRef.current?.contains(target as globalThis.Node)
      ) {
        return;
      }
      setEmojiPickerOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setEmojiPickerOpen(false);
      emojiButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [emojiPickerOpen]);
  useLayoutEffect(() => {
    if (!emojiPickerOpen) {
      return;
    }
    const sheet = window.matchMedia(
      '(max-width: 639px), (max-height: 500px)'
    ).matches;
    const margin = 8;
    if (sheet) {
      const rect = emojiButtonRef.current?.getBoundingClientRect();
      const top = rect ? Math.max(margin, Math.round(rect.bottom + margin)) : margin;
      const viewHeight = window.visualViewport?.height ?? window.innerHeight;
      const height = Math.min(280, Math.max(180, Math.round(viewHeight - top - margin)));
      setEmojiAnchor({
        sheet: true,
        top,
        left: margin,
        width: Math.round(window.innerWidth - margin * 2),
        height,
      });
      return;
    }
    const place = () => {
      const rect = emojiButtonRef.current?.getBoundingClientRect();
      const width = 360;
      const height = Math.min(420, window.innerHeight - margin * 2);
      let left = rect ? rect.right + margin : margin;
      let top = rect ? rect.top : margin;
      if (left + width > window.innerWidth - margin) {
        left = rect ? rect.left - width - margin : margin;
      }
      if (left < margin) {
        left = Math.max(margin, (rect ? rect.left : margin));
        top = rect ? rect.bottom + margin : margin;
        if (left + width > window.innerWidth - margin) {
          left = Math.max(margin, window.innerWidth - width - margin);
        }
      }
      if (top + height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - height - margin);
      }
      setEmojiAnchor({ sheet: false, top, left, width, height });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [emojiPickerOpen]);
  const t = useT();
  const toaster = useToaster();
  const editorRef = useRef<undefined | { editor: any }>(undefined);
  const [loading, setLoading] = useState(false);
  // the uploader is created once, so it reads the latest value from here
  const inlineImagesRef = useRef(inlineImages);
  inlineImagesRef.current = inlineImages;

  const uppy = useUppyUploader({
    onUploadSuccess: (result: any) => {
      const editor = editorRef?.current?.editor;
      if (inlineImagesRef.current && editor) {
        insertImages(editor, result);
        uppy.clear();
        return;
      }

      appendImages?.(result);
      uppy.clear();
    },
    allowedFileTypes: 'image/*,video/mp4',
    onStart: () => {},
    onEnd: () => setLoading(false),
  });

  // inline images go into the content, which only holds pictures
  const filterFiles = useCallback(
    (files: File[]) => {
      if (!inlineImages) {
        return files;
      }

      const images = files.filter((file) => file.type.startsWith('image/'));
      if (images.length < files.length) {
        toaster.show(
          t(
            'only_images_can_be_added_to_the_content',
            'Only images can be added to the content'
          ),
          'warning'
        );
      }

      return images;
    },
    [inlineImages, toaster, t]
  );

  const onDrop = useCallback(
    (droppedFiles: File[]) => {
      const acceptedFiles = filterFiles(droppedFiles);
      if (!acceptedFiles.length) {
        return;
      }

      const totalSize = acceptedFiles.reduce((acc, file) => acc + file.size, 0);

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

      for (const file of acceptedFiles) {
        uppy.addFile(file);
      }
    },
    [uppy, toaster, t, filterFiles]
  );

  const paste = useCallback(
    (event: ClipboardEvent | File[], slice?: Slice) => {
      if (num > 0 && comments === 'no-media') {
        return false;
      }
      // @ts-ignore
      const clipboardItems = event.clipboardData?.items;
      if (!clipboardItems) {
        return false;
      }

      const clipboardFiles: File[] = [];
      // @ts-ignore
      for (const item of clipboardItems) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            clipboardFiles.push(file);
          }
        }
      }

      // a copied picture also comes as html linking to the site it was copied
      // from, so the file wins unless the html has text of its own
      // @ts-ignore
      const html = event.clipboardData.getData('text/html');
      const uploadInline =
        !!clipboardFiles.length &&
        (!html || !slice?.content.textBetween(0, slice.content.size).trim());
      if (inlineImages && !uploadInline) {
        return false;
      }

      const files = filterFiles(clipboardFiles);
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_UPLOAD_SIZE) {
        toaster.show(
          t(
            'upload_size_limit_exceeded',
            'Upload size limit exceeded. Maximum 1 GB per upload session.'
          ),
          'warning'
        );
        return false;
      }

      if (files.length > 0) {
        setLoading(true);
      }

      for (const file of files) {
        uppy.addFile(file);
      }

      // the uploaded pictures replace the pasted html
      return inlineImages;
    },
    [uppy, num, comments, toaster, t, inlineImages, filterFiles]
  );

  // a drag that starts on the page (like moving a picture inside the editor)
  // is not an upload, but Chrome reports a dragged <img> as "Files"
  const [internalDrag, setInternalDrag] = useState(false);
  useEffect(() => {
    if (!inlineImages) {
      return;
    }

    const dragStart = (event: DragEvent) => {
      if (!event.defaultPrevented) {
        setInternalDrag(true);
      }
    };
    const dragEnd = () => setInternalDrag(false);

    window.addEventListener('dragstart', dragStart);
    window.addEventListener('dragend', dragEnd);
    window.addEventListener('drop', dragEnd);
    return () => {
      window.removeEventListener('dragstart', dragStart);
      window.removeEventListener('dragend', dragEnd);
      window.removeEventListener('drop', dragEnd);
      setInternalDrag(false);
    };
  }, [inlineImages]);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: (files, _, event) => {
      if (loading) {
        toaster.show(
          'Upload current in progress, please wait and then try again.',
          'warning'
        );
        return;
      }

      if (inlineImages) {
        const editor = editorRef?.current?.editor;
        const { clientX, clientY } = event as DragEvent;
        const position = editor?.view?.posAtCoords({
          left: clientX,
          top: clientY,
        });
        if (position) {
          editor.commands.focus(position.pos);
        }
      }

      onDrop(files);
    },
    noDrag: internalDrag || (num > 0 && comments === 'no-media'),
  });

  const valueWithoutHtml = useMemo(() => {
    return stripHtmlValidation('normal', props.value || '', true);
  }, [props.value]);

  const addText = useCallback(
    (emoji: string) => {
      editorRef?.current?.editor?.commands?.insertContent(emoji);
      editorRef?.current?.editor?.commands?.focus();
    },
    [props.value, id]
  );

  // the extensions are fixed once the editor is created, rebuild it when they change
  const editorKey = `${editorType}-${inlineImages}`;
  const [loadedEditor, setLoadedEditor] = useState(editorKey);
  const [showEditor, setShowEditor] = useState(true);
  useEffect(() => {
    if (editorKey === loadedEditor) {
      return;
    }
    setLoadedEditor(editorKey);
    setShowEditor(false);
  }, [editorKey]);

  useEffect(() => {
    if (showEditor) {
      return;
    }
    setTimeout(() => {
      setShowEditor(true);
    }, 20);
  }, [showEditor]);

  if (!showEditor) {
    return null;
  }

  const focusEditor = () => {
    if (editorRef?.current?.editor?.isFocused) {
      return;
    }
    editorRef?.current?.editor?.commands?.focus('end');
  };

  return (
    <div className="flex flex-col gap-[12px]">
      <div
        className="po-editor-shell relative flex flex-col"
        id={id}
      >
        <div className="relative cursor-text flex flex-col">
          <div {...getRootProps()} className="flex flex-col">
            <div
              className={clsx(
                'absolute left-0 top-0 w-full h-full bg-black/70 z-[300] transition-all items-center justify-center flex text-white text-sm',
                !isDragActive ? 'pointer-events-none opacity-0' : 'opacity-100'
              )}
            >
              {t('drop_files_here_to_upload', 'Drop your files here to upload')}
            </div>
            <div className="po-editor-tools flex flex-col items-stretch gap-0 px-[10px] bg-newBgColorInner relative">
              <div className="po-editor-toolrow flex items-center gap-[8px] w-full min-w-0">
              <div className="editor-toolbar flex gap-[5px] min-w-0 flex-wrap">
                {editorType !== 'none' && (
                  <>
                    <BoldText
                      editor={editorRef?.current?.editor}
                      currentValue={props.value!}
                    />
                    <UText
                      editor={editorRef?.current?.editor}
                      currentValue={props.value!}
                    />
                  </>
                )}
                {(editorType === 'markdown' || editorType === 'html') &&
                  identifier !== 'telegram' && (
                    <>
                      <HeadingComponent
                        editor={editorRef?.current?.editor}
                        currentValue={props.value!}
                      />
                      <Bullets
                        editor={editorRef?.current?.editor}
                        currentValue={props.value!}
                      />
                      <AComponent
                        editor={editorRef?.current?.editor}
                        currentValue={props.value!}
                      />
                    </>
                  )}
                <button
                  ref={emojiButtonRef}
                  type="button"
                  data-tooltip-id="tooltip"
                  data-tooltip-content={t('insert_emoji', 'Insert emoji')}
                  aria-label={t('insert_emoji', 'Insert emoji')}
                  aria-expanded={emojiPickerOpen}
                  className="c8-tool select-none cursor-pointer rounded-[6px] flex justify-center items-center"
                  onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                >
                  <EmojiIcon />
                </button>
                <SignatureBox editor={editorRef?.current?.editor} />
                {emojiPickerOpen &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      className={clsx(
                        'c8-emoji is-open',
                        emojiAnchor.sheet && 'is-sheet'
                      )}
                      onClick={(event) => {
                        if (event.target === event.currentTarget) {
                          setEmojiPickerOpen(false);
                        }
                      }}
                    >
                      <div
                        ref={emojiSheetRef}
                        className="c8-emoji-pop"
                        style={{ top: emojiAnchor.top, left: emojiAnchor.left }}
                      >
                        <div className="arc-grab" aria-hidden />
                        <EmojiPicker
                          height={emojiAnchor.height}
                          theme={
                            document.body.classList.contains('dark')
                              ? Theme.DARK
                              : Theme.LIGHT
                          }
                          onEmojiClick={(e) => {
                            addText(e.emoji);
                            setEmojiPickerOpen(false);
                          }}
                          open={emojiPickerOpen}
                        />
                      </div>
                    </div>,
                    document.body
                  )}
              </div>
              <div className="ms-auto">
                <InformationComponent
                  part="counter"
                  isPicture={pictures?.length > 0}
                  chars={chars}
                  totalChars={valueWithoutHtml.length}
                  totalAllowedChars={props.totalChars}
                  text={valueWithoutHtml}
                />
              </div>
              </div>
              <InformationComponent
                part="popover"
                isPicture={pictures?.length > 0}
                chars={chars}
                totalChars={valueWithoutHtml.length}
                totalAllowedChars={props.totalChars}
                text={valueWithoutHtml}
              />
            </div>
            <div
              className="px-[12px] pt-[8px] pb-[8px] bg-newBgColorInner relative z-[99] min-h-[64px]"
              onClick={focusEditor}
            >
              <OnlyEditor
                value={props.value}
                editorType={editorType}
                inlineImages={inlineImages}
                onChange={props.onChange}
                paste={paste}
                ref={editorRef}
              />
            </div>
            <div className="w-full pointer-events-none relative">
              <div className="w-full h-[46px] overflow-hidden absolute left-0 bottom-0 bg-newBgColorInner uppyChange">
                <Dashboard
                  height={46}
                  uppy={uppy}
                  id={`prog-${num}`}
                  showProgressDetails={true}
                  hideUploadButton={true}
                  hideRetryButton={true}
                  hidePauseResumeButton={true}
                  hideCancelButton={true}
                  hideProgressAfterFinish={true}
                />
              </div>
            </div>
            <div className="po-editor-foot flex items-end bg-newBgColorInner cursor-default">
              {setImages && (
                <MultiMediaComponent
                  mediaNotAvailable={num > 0 && comments === 'no-media'}
                  allData={allValues}
                  text={valueWithoutHtml}
                  label=""
                  description=""
                  value={props.pictures}
                  dummy={dummy}
                  name="image"
                  insertInContent={
                    inlineImages
                      ? (media) =>
                          insertImages(editorRef?.current?.editor, media)
                      : undefined
                  }
                  onChange={(value) => {
                    setImages(value.target.value);
                  }}
                  onOpen={() => setEmojiPickerOpen(false)}
                  onClose={() => {}}
                />
              )}
              {footerExtra && (
                <div className="po-card-extra flex items-center gap-[10px] px-[12px] min-h-[40px]">
                  {footerExtra}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {childButton}
    </div>
  );
};

export const OnlyEditor = forwardRef<
  any,
  {
    editorType: 'none' | 'normal' | 'markdown' | 'html';
    inlineImages?: boolean;
    value: string;
    onChange: (value: string) => void;
    paste?: (event: ClipboardEvent | File[], slice?: Slice) => boolean | void;
  }
>(({ editorType, inlineImages, value, onChange, paste }, ref) => {
  const t = useT();
  const fetch = useFetch();

  const { internal } = useLaunchStore(
    useShallow((state) => ({
      internal: state.internal.find((p) => p.integration?.id === state.current),
    }))
  );

  const loadList = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        return [];
      }

      if (!internal?.integration.id) {
        return [];
      }

      try {
        const load = await fetch('/integrations/mentions', {
          method: 'POST',
          body: JSON.stringify({
            name: 'mention',
            id: internal.integration.id,
            data: { query },
          }),
        });

        const result = await load.json();
        return result;
      } catch (error) {
        console.error('Error loading mentions:', error);
        return [];
      }
    },
    [internal, fetch]
  );

  const valueRef = useRef(value);
  const emittedRef = useRef<string | null>(null);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Underline,
      Bold,
      InterceptBoldShortcut,
      InterceptUnderlineShortcut,
      BulletList,
      ListItem,
      Placeholder.configure({
        placeholder: t('write_something', 'Write something …'),
        emptyEditorClass: 'is-editor-empty',
      }),
      ...(editorType === 'html' || editorType === 'markdown'
        ? [
            Link.configure({
              openOnClick: false,
              autolink: true,
              defaultProtocol: 'https',
              protocols: ['http', 'https'],
              isAllowedUri: (url, ctx) => {
                try {
                  // prevent transforming plain emails like foo@bar.com into links
                  const trimmed = String(url).trim();
                  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (emailPattern.test(trimmed)) {
                    return false;
                  }

                  // construct URL
                  const parsedUrl = url.includes(':')
                    ? new URL(url)
                    : new URL(`${ctx.defaultProtocol}://${url}`);

                  // use default validation
                  if (!ctx.defaultValidate(parsedUrl.href)) {
                    return false;
                  }

                  // disallowed protocols
                  const disallowedProtocols = ['ftp', 'file', 'mailto'];
                  const protocol = parsedUrl.protocol.replace(':', '');

                  if (disallowedProtocols.includes(protocol)) {
                    return false;
                  }

                  // only allow protocols specified in ctx.protocols
                  const allowedProtocols = ctx.protocols.map((p) =>
                    typeof p === 'string' ? p : p.scheme
                  );

                  if (!allowedProtocols.includes(protocol)) {
                    return false;
                  }

                  // all checks have passed
                  return true;
                } catch {
                  return false;
                }
              },
              shouldAutoLink: (url) => {
                try {
                  // prevent auto-linking of plain emails like foo@bar.com
                  const trimmed = String(url).trim();
                  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (emailPattern.test(trimmed)) {
                    return false;
                  }

                  // construct URL
                  const parsedUrl = url.includes(':')
                    ? new URL(url)
                    : new URL(`https://${url}`);

                  // only auto-link if the domain is not in the disallowed list
                  const disallowedDomains = [
                    'example-no-autolink.com',
                    'another-no-autolink.com',
                  ];
                  const domain = parsedUrl.hostname;

                  return !disallowedDomains.includes(domain);
                } catch {
                  return false;
                }
              },
            }),
          ]
        : []),
      ...(internal?.integration?.id
        ? [
            Mention.configure({
              HTMLAttributes: {
                class: 'mention',
              },
              renderHTML({ options, node }) {
                return [
                  'span',
                  mergeAttributes(options.HTMLAttributes, {
                    'data-mention-id': node.attrs.id || '',
                    'data-mention-label': node.attrs.label || '',
                  }),
                  `@${node.attrs.label}`,
                ];
              },
              suggestion: suggestion(loadList),
            }),
          ]
        : []),
      ...(editorType === 'html' || editorType === 'markdown'
        ? [
            Heading.configure({
              levels: [1, 2, 3],
            }),
          ]
        : []),
      ...(inlineImages
        ? [
            EditorImage,
            Dropcursor.configure({
              color: 'var(--new-btn-primary)',
              width: 2,
            }),
            // a picture can't hold the cursor, keep a paragraph after a
            // trailing one so clicking below the content doesn't select it
            TrailingNode.configure({
              node: 'paragraph',
              notAfter: ['heading', 'bulletList'],
            }),
          ]
        : []),
      History.configure({
        depth: 100, // default is 100
        newGroupDelay: 100, // default is 500ms
      }),
    ],
    content: value || '',
    shouldRerenderOnTransaction: true,
    immediatelyRender: false,
    editorProps: {
      handlePaste: (_view, event, slice) => !!paste?.(event as any, slice),
    },
    onCreate: ({ editor: created }) => {
      const stored = valueRef.current || '';
      if (isEmptyEditorHtml(created.getHTML()) && !isEmptyEditorHtml(stored)) {
        created.commands.setContent(stored, { emitUpdate: false });
      }
      emittedRef.current = created.getHTML();
    },
    onUpdate: (innerProps) => {
      const reported = innerProps.editor.getHTML();
      emittedRef.current = reported;
      if (reported === valueRef.current) {
        return;
      }
      valueRef.current = reported;
      onChange?.(reported);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const next = editorContentForValue(
      editor.getHTML(),
      value || '',
      emittedRef.current
    );
    if (next == null) {
      return;
    }
    emittedRef.current = next;
    valueRef.current = next;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  useImperativeHandle(ref, () => ({
    editor,
  }));

  return <EditorContent editor={editor} />;
});
