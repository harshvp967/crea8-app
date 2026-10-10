'use client';

import React, {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AssistantMessageProps,
  CopilotChat,
  CopilotKitCSSProperties,
  InputProps,
  Markdown,
  UserMessageProps,
  useChatContext,
} from '@copilotkit/react-ui';
import { copyToClipboard } from '@copilotkit/shared';
import { Input } from '@gitroom/frontend/components/agents/agent.input';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  CopilotKit,
  useCopilotAction,
  useCopilotMessagesContext,
} from '@copilotkit/react-core';
import {
  MediaPortal,
  PropertiesContext,
} from '@gitroom/frontend/components/agents/agent';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  Message as CopilotMessage,
  TextMessage,
} from '@copilotkit/runtime-client-gql';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';

export const AgentChat: FC = () => {
  const { backendUrl } = useVariables();
  const params = useParams<{ id: string }>();
  const { properties } = useContext(PropertiesContext);
  const t = useT();

  return (
    <CopilotKit
      {...(params.id === 'new' ? {} : { threadId: params.id })}
      credentials="include"
      runtimeUrl={backendUrl + '/copilot/agent'}
      useSingleEndpoint={true}
      showDevConsole={false}
      agent="postiz"
      properties={{
        integrations: properties,
      }}
    >
      <Hooks />
      <LoadMessages id={params.id} />
      <div
        style={
          {
            '--copilot-kit-primary-color': 'var(--arc-accent)',
            '--copilot-kit-contrast-color': 'var(--arc-ink)',
            '--copilot-kit-background-color': 'transparent',
            '--copilot-kit-input-background-color': 'transparent',
            '--copilot-kit-secondary-color': 'transparent',
            '--copilot-kit-secondary-contrast-color': 'var(--new-btn-text)',
            '--copilot-kit-separator-color': 'var(--new-border)',
            '--copilot-kit-muted-color': 'var(--new-textItemBlur)',
          } as CopilotKitCSSProperties
        }
        className="trz agent bg-newBgColorInner flex flex-col transition-all flex-1 items-stretch relative min-w-0 h-full w-full"
      >
        <div className="absolute inset-0">
          <CopilotChat
            className="w-full h-full agent-chat-shell"
            AssistantMessage={AgentAssistantMessage}
            labels={{
              title: t('your_assistant', 'Crea8one AI Agent'),
              initial: t('agent_welcome_message', `Hello, I'm your Crea8one AI Agent 👋🏻.
              
I can schedule a post or multiple posts to multiple channels and generate pictures and videos.

You can select the channels you want to use from the left menu.

You can see your previous conversations from the right menu.

You can also use me as an MCP Server, check Settings >> Public API
`),
            }}
            UserMessage={Message}
            Input={NewInput}
          />
        </div>
      </div>
    </CopilotKit>
  );
};

const LoadMessages: FC<{ id: string }> = ({ id }) => {
  const { messages, setMessages } = useCopilotMessagesContext();
  const fetch = useFetch();
  const currentId = useRef<string | null>(null);
  const loaded = useRef<{ id: string; messages: CopilotMessage[] } | null>(
    null
  );

  const loadMessages = useCallback(async (idToSet: string) => {
    const data = await (await fetch(`/copilot/${idToSet}/list`)).json();
    const list = data.messages.map((p: any) => {
      return new TextMessage({
        content:
          p.content.content ||
          (p.content.parts || [])
            .map((part: any) => (part.type === 'text' ? part.text : ''))
            .join(''),
        role: p.role,
      });
    });

    if (currentId.current !== idToSet) {
      return;
    }

    loaded.current = { id: idToSet, messages: list };
    setMessages(list);
  }, []);

  useEffect(() => {
    currentId.current = id;
    if (id === 'new') {
      loaded.current = { id, messages: [] };
      setMessages([]);
      return;
    }
    loaded.current = null;
    loadMessages(id);
  }, [id]);

  // CopilotKit resolves loadAgentState to an empty list for Mastra local agents
  // and can clobber the messages we hold, depending on which request resolves last
  useEffect(() => {
    if (loaded.current?.id !== id) {
      return;
    }

    if (messages.length) {
      loaded.current.messages = messages;
      return;
    }

    if (loaded.current.messages.length) {
      setMessages(loaded.current.messages);
    }
  }, [messages, id]);

  return null;
};

const Message: FC<UserMessageProps> = (props) => {
  const convertContentToImagesAndVideo = useMemo(() => {
    const content = props.message?.content || '';
    const text =
      typeof content === 'string'
        ? content
        : content.map((p) => (p.type === 'text' ? p.text : '')).join('');

    return text
      .replace(/Video: (http.*mp4\n)/g, (match, p1) => {
        return `<video controls class="h-[150px] w-[150px] rounded-[8px] mb-[10px]"><source src="${p1.trim()}" type="video/mp4">Your browser does not support the video tag.</video>`;
      })
      .replace(/Image: (http.*\n)/g, (match, p1) => {
        return `<img src="${p1.trim()}" class="h-[150px] w-[150px] max-w-full border border-newBgColorInner" />`;
      })
      .replace(/\[\-\-Media\-\-\](.*)\[\-\-Media\-\-\]/g, (match, p1) => {
        return `<div class="flex justify-center mt-[20px]">${p1}</div>`;
      })
      .replace(
        /(\[--integrations--\][\s\S]*?\[--integrations--\])/g,
        (match, p1) => {
          return ``;
        }
      );
  }, [props.message?.content]);
  return (
    <div
      className="copilotKitMessage copilotKitUserMessage"
      dangerouslySetInnerHTML={{ __html: convertContentToImagesAndVideo }}
    />
  );
};

type DraftPreview = {
  title: string;
  platform: string;
  picture: string;
};

const splitDrafts = (text: string) => {
  const drafts: DraftPreview[] = [];
  const prose = text
    .replace(/\[--draft--\]([\s\S]*?)\[--draft--\]/g, (_match, json) => {
      const draft = parseDraft(json);
      if (draft) {
        drafts.push(draft);
      }
      return '';
    })
    .trim();
  return { prose, drafts };
};

const parseDraft = (json: string): DraftPreview | null => {
  try {
    const value = JSON.parse(json);
    const title = typeof value?.title === 'string' ? value.title.trim() : '';
    if (!title) {
      return null;
    }
    const platform =
      typeof value?.platform === 'string' && /^[a-z0-9_-]+$/i.test(value.platform)
        ? value.platform
        : '';
    return {
      title,
      platform,
      picture: safePicture(value?.picture),
    };
  } catch {
    return null;
  }
};

const safePicture = (picture: unknown) => {
  if (typeof picture !== 'string') {
    return '';
  }
  if (picture.startsWith('/icons/')) {
    return picture;
  }
  try {
    const url = new URL(picture);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return picture;
    }
  } catch {
    return '';
  }
  return '';
};

const DraftCard: FC<{ draft: DraftPreview }> = ({ draft }) => {
  const t = useT();
  const avatar =
    draft.picture ||
    (draft.platform ? `/icons/platforms/${draft.platform}.png` : '');
  return (
    <div className="agent-draft-card">
      {avatar ? (
        <span className="agent-draft-avatar">
          <img className="avatar" src={avatar} alt="" />
          {draft.platform ? (
            <img
              className="badge"
              src={`/icons/platforms/${draft.platform}.png`}
              alt=""
            />
          ) : null}
        </span>
      ) : null}
      <span className="agent-draft-title">{draft.title}</span>
      <span className="agent-draft-pill">{t('draft', 'Draft')}</span>
    </div>
  );
};

const AgentAssistantMessage: FC<AssistantMessageProps> = (props) => {
  const { icons, labels } = useChatContext();
  const [copied, setCopied] = useState(false);
  const {
    message,
    isLoading,
    onRegenerate,
    onCopy,
    onThumbsUp,
    onThumbsDown,
    isCurrentMessage,
    feedback,
    markdownTagRenderers,
  } = props;
  const raw = message?.content || '';
  const text = typeof raw === 'string' ? raw : '';
  const { prose, drafts } = splitDrafts(text);
  const uiMessage = message as
    | (NonNullable<typeof message> & {
        generativeUI?: () => React.ReactNode;
        generativeUIPosition?: string;
      })
    | undefined;
  const subComponent = uiMessage?.generativeUI?.() ?? props.subComponent;
  const subComponentPosition = uiMessage?.generativeUIPosition ?? 'after';
  const renderBefore = Boolean(subComponent) && subComponentPosition === 'before';
  const renderAfter = Boolean(subComponent) && subComponentPosition !== 'before';

  const handleCopy = async () => {
    if (!text) {
      return;
    }
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      onCopy?.(text);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {renderBefore ? (
        <div style={{ marginBottom: '0.5rem' }}>{subComponent}</div>
      ) : null}
      {(prose || drafts.length > 0) && (
        <div className="agent-assistant-block">
          <div className="copilotKitMessage copilotKitAssistantMessage">
            {prose ? (
              <Markdown content={prose} components={markdownTagRenderers} />
            ) : null}
            {drafts.map((draft, index) => (
              <DraftCard key={`${draft.title}-${index}`} draft={draft} />
            ))}
          </div>
          {prose && !isLoading ? (
            <div
              className={`agent-message-actions${
                isCurrentMessage ? ' currentMessage' : ''
              }`}
            >
              <button
                type="button"
                className="copilotKitMessageControlButton"
                onClick={() => onRegenerate?.()}
                aria-label={labels.regenerateResponse}
                title={labels.regenerateResponse}
              >
                {icons.regenerateIcon}
              </button>
              <button
                type="button"
                className="copilotKitMessageControlButton"
                onClick={handleCopy}
                aria-label={labels.copyToClipboard}
                title={labels.copyToClipboard}
              >
                {copied ? (
                  <span style={{ fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                ) : (
                  icons.copyIcon
                )}
              </button>
              {onThumbsUp && message ? (
                <button
                  type="button"
                  className={`copilotKitMessageControlButton${
                    feedback === 'thumbsUp' ? ' active' : ''
                  }`}
                  onClick={() => onThumbsUp(message, feedback !== 'thumbsUp')}
                  aria-label={labels.thumbsUp}
                  title={labels.thumbsUp}
                >
                  {icons.thumbsUpIcon}
                </button>
              ) : null}
              {onThumbsDown && message ? (
                <button
                  type="button"
                  className={`copilotKitMessageControlButton${
                    feedback === 'thumbsDown' ? ' active' : ''
                  }`}
                  onClick={() =>
                    onThumbsDown(message, feedback !== 'thumbsDown')
                  }
                  aria-label={labels.thumbsDown}
                  title={labels.thumbsDown}
                >
                  {icons.thumbsDownIcon}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {renderAfter ? (
        <div style={{ marginBottom: '0.5rem' }}>{subComponent}</div>
      ) : null}
      {isLoading ? (
        <span data-testid="copilot-loading-cursor">{icons.activityIcon}</span>
      ) : null}
    </>
  );
};

const NewInput: FC<InputProps> = (props) => {
  const [media, setMedia] = useState([] as { path: string; id: string }[]);
  const [value, setValue] = useState('');
  const [tools, setTools] = useState(false);
  const { properties } = useContext(PropertiesContext);
  return (
    <>
      <div className={tools ? 'agent-media is-open' : 'agent-media'}>
        <MediaPortal
          value={value}
          media={media}
          setMedia={(e) => setMedia(e.target.value)}
        />
      </div>
      <Input
        {...props}
        onAttach={() => setTools((open) => !open)}
        onChange={setValue}
        onSend={(text) => {
          const send = props.onSend(
            text +
              (media.length > 0
                ? '\n[--Media--]' +
                  media
                    .map((m) =>
                      hasExtension(m.path, 'mp4')
                        ? `Video: ${m.path}`
                        : `Image: ${m.path}`
                    )
                    .join('\n') +
                  '\n[--Media--]'
                : '') +
              `
${
  properties.length
    ? `[--integrations--]
Use the following social media platforms: ${JSON.stringify(
        properties.map((p) => ({
          id: p.id,
          platform: p.identifier,
          profilePicture: p.picture,
          additionalSettings: p.additionalSettings,
        }))
      )}
[--integrations--]`
    : ``
}`
          );
          setValue('');
          setMedia([]);
          return send;
        }}
      />
    </>
  );
};

export const Hooks: FC = () => {
  const modals = useModals();

  useCopilotAction({
    name: 'manualPosting',
    description:
      'This tool should be triggered when the user wants to manually add the generated post',
    parameters: [
      {
        name: 'list',
        type: 'object[]',
        description:
          'list of posts to schedule to different social media (integration ids)',
        attributes: [
          {
            name: 'integrationId',
            type: 'string',
            description: 'The integration id',
          },
          {
            name: 'date',
            type: 'string',
            description: 'UTC date of the scheduled post',
          },
          {
            name: 'settings',
            type: 'object',
            description: 'Settings for the integration [input:settings]',
          },
          {
            name: 'posts',
            type: 'object[]',
            description: 'list of posts / comments (one under another)',
            attributes: [
              {
                name: 'content',
                type: 'string',
                description: 'the content of the post',
              },
              {
                name: 'attachments',
                type: 'object[]',
                description: 'list of attachments',
                attributes: [
                  {
                    name: 'id',
                    type: 'string',
                    description: 'id of the attachment',
                  },
                  {
                    name: 'path',
                    type: 'string',
                    description: 'url of the attachment',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    renderAndWaitForResponse: ({ args, status, respond }) => {
      if (status === 'executing') {
        return <OpenModal args={args} respond={respond} />;
      }

      return null;
    },
  });
  return null;
};

const OpenModal: FC<{
  respond: (value: any) => void;
  args: {
    list: {
      integrationId: string;
      date: string;
      settings?: Record<string, any>;
      posts: { content: string; attachments: { id: string; path: string }[] }[];
    }[];
  };
}> = ({ args, respond }) => {
  const modals = useModals();
  const { properties } = useContext(PropertiesContext);
  const startModal = useCallback(async () => {
    for (const integration of args.list) {
      await new Promise((res) => {
        const group = makeId(10);
        modals.openModal({
          id: 'add-edit-modal',
          closeOnClickOutside: false,
          removeLayout: true,
          closeOnEscape: false,
          withCloseButton: false,
          askClose: true,
          size: '80%',
          title: ``,
          classNames: {
            modal: 'w-[100%] max-w-[1400px] text-textColor',
          },
          children: (
            <ExistingDataContextProvider
              value={{
                group,
                integration: integration.integrationId,
                integrationPicture:
                  properties.find((p) => p.id === integration.integrationId)
                    ?.picture || '',
                settings: integration.settings || {},
                posts: integration.posts.map((p) => ({
                  approvedSubmitForOrder: 'NO',
                  content: p.content,
                  createdAt: new Date().toISOString(),
                  state: 'DRAFT',
                  id: makeId(10),
                  settings: JSON.stringify(integration.settings || {}),
                  group,
                  integrationId: integration.integrationId,
                  integration: properties.find(
                    (p) => p.id === integration.integrationId
                  ),
                  publishDate: dayjs.utc(integration.date).toISOString(),
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                })),
              }}
            >
              <AddEditModal
                date={dayjs.utc(integration.date)}
                allIntegrations={properties}
                integrations={properties.filter(
                  (p) => p.id === integration.integrationId
                )}
                onlyValues={integration.posts.map((p) => ({
                  content: p.content,
                  id: makeId(10),
                  settings: integration.settings || {},
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                }))}
                reopenModal={() => {}}
                mutate={() => res(true)}
              />
            </ExistingDataContextProvider>
          ),
        });
      });
    }

    respond('User scheduled all the posts');
  }, [args, respond, properties]);

  useEffect(() => {
    startModal();
  }, []);
  return (
    <div onClick={() => respond('continue')}>
      Opening manually ${JSON.stringify(args)}
    </div>
  );
};
