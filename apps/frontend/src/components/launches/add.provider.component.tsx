'use client';

import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Input } from '@gitroom/react/form/input';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { Button } from '@gitroom/react/form/button';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ApiKeyDto } from '@gitroom/nestjs-libraries/dtos/integrations/api.key.dto';
import { useRouter } from 'next/navigation';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { object, string } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { web3List } from '@gitroom/frontend/components/launches/web3/web3.list';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import clsx from 'clsx';
import copy from 'copy-to-clipboard';
import { capitalize } from 'lodash';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
const resolver = classValidatorResolver(ApiKeyDto);

async function writeInviteLink(url: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // The async clipboard API needs a secure context and permission.
      // execCommand still works on the click that follows.
    }
  }

  return copy(url);
}

const InviteLinkModal: FC<{
  url: string;
}> = ({ url }) => {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const onCopy = useCallback(async () => {
    setCopied(await writeInviteLink(url));
  }, [url]);

  return (
    <div className="cc-invite flex flex-col gap-[16px]">
      <p className="cc-copy">
        {t(
          'invite_link_manual_copy',
          'Copy this link and send it to your customer. It expires in 1 hour.'
        )}
      </p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="cc-field"
      />
      <div className="cc-actions">
        <Button type="button" className="cc-primary" onClick={onCopy}>
          {copied
            ? t('copied', 'Copied')
            : t('copy_link', 'Copy link')}
        </Button>
      </div>
    </div>
  );
};

export const useAddProvider = (update?: () => void, invite?: boolean) => {
  const modal = useModals();
  const fetch = useFetch();
  const t = useT();
  return useCallback(async () => {
    const data = await (await fetch('/integrations')).json();
    modal.openModal({
      title: invite
        ? t('invite_link_title', 'Invite link')
        : 'Add Channel',
      withCloseButton: true,
      size: '820px',
      classNames: {
        modal: 'cc-picker-modal',
      },
      children: (
        <AddProviderComponent invite={!!invite} update={update} {...data} />
      ),
    });
  }, [fetch, invite, modal, t, update]);
};
export const AddProviderButton: FC<{
  update?: () => void;
}> = (props) => {
  const { update } = props;
  const add = useAddProvider(update);
  const invite = useAddProvider(update, true);
  const t = useT();

  return (
    <div className="flex group-[.sidebar]:block gap-[8px]">
      <button
        type="button"
        data-action="add-channel"
        className="channel-add flex-1 group-[.sidebar]:w-[100%] group-[.sidebar]:flex-none text-newTextColor bg-newBgColorInner border border-newBorder shadow-[var(--arc-shadow-resting)] h-[44px] pt-[12px] pb-[14px] ps-[16px] pe-[20px] justify-center items-center flex rounded-[18px] gap-[8px] hover:bg-newBoxHover transition-colors cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          add();
        }}
      >
        <div>
          <HugeIcon name="plus" size={20} />
        </div>
        <div className="text-start text-[14px] group-[.sidebar]:hidden">
          {t('add_channel', 'Add channel')}
        </div>
      </button>
      <button
        type="button"
        data-action="invite-link"
        onClick={(event) => {
          event.stopPropagation();
          invite();
        }}
        data-tooltip-id="tooltip"
        data-tooltip-content={t(
          'invite_link',
          'Send Invite Link to a customer to add channel'
        )}
        className="channel-invite group-[.sidebar]:hidden min-h-[44px] min-w-[44px] bg-newBgColorInner text-textItemBlur border border-newBorder shadow-[var(--arc-shadow-resting)] justify-center items-center flex rounded-[18px] cursor-pointer hover:text-newTextColor hover:bg-newBoxHover transition-colors"
      >
        <HugeIcon name="link" size={20} />
      </button>
    </div>
  );
};

export const UrlModal: FC<{
  gotoUrl(url: string): void;
}> = (props) => {
  const { gotoUrl } = props;
  const methods = useForm({
    mode: 'onChange',
  });

  const t = useT();

  const submit = useCallback(async (data: FieldValues) => {
    gotoUrl(data.url);
  }, []);
  return (
    <div className="cc-url relative">
      <TopTitle title={`Instance URL`} />
      <button
        onClick={close}
        className="cc-url-legacy-close outline-none absolute end-[20px] top-[20px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
        type="button"
      >
        <HugeIcon name="close" size={16} />
      </button>
      <FormProvider {...methods}>
        <form
          className="gap-[8px] flex flex-col"
          onSubmit={methods.handleSubmit(submit)}
        >
          <div className="pt-[10px]">
            <Input label="URL" name="url" className="cc-input" />
          </div>
          <div className="cc-actions">
            <Button type="submit" className="cc-primary">{t('connect', 'Connect')}</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
export const CustomVariables: FC<{
  variables: Array<{
    key: string;
    label: string;
    defaultValue?: string;
    validation: string;
    type: 'text' | 'password';
    hint?: string;
  }>;
  close?: () => void;
  identifier: string;
  gotoUrl(url: string): void;
  onboarding?: boolean;
}> = (props) => {
  const { close, gotoUrl, identifier, variables, onboarding } = props;
  const fetch = useFetch();
  const modals = useModals();
  const schema = useMemo(() => {
    return object({
      ...variables.reduce((aIcc, item) => {
        const splitter = item.validation.split('/');
        const regex = new RegExp(
          splitter.slice(1, -1).join('/'),
          splitter.pop()
        );
        return {
          ...aIcc,
          [item.key]: string()
            .matches(regex, `${item.label} is invalid`)
            .required(),
        };
      }, {}),
    });
  }, [variables]);
  const methods = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    values: variables.reduce(
      (acc, item) => ({
        ...acc,
        ...(item.defaultValue
          ? {
              [item.key]: item.defaultValue,
            }
          : {}),
      }),
      {}
    ),
  });
  const submit = useCallback(
    async (data: FieldValues) => {
      const { url } = await (
        await fetch(
          `/integrations/social/${identifier}${
            onboarding ? '?onboarding=true' : ''
          }`
        )
      ).json();
      modals.closeAll();
      gotoUrl(
        `/integrations/social/${identifier}?state=${url}&code=${Buffer.from(
          JSON.stringify(data)
        ).toString('base64')}${onboarding ? '&onboarding=true' : ''}`
      );
    },
    [variables, onboarding]
  );

  const t = useT();

  return (
    <div className="cc-fields relative">
      <FormProvider {...methods}>
        <form
          className="gap-[12px] flex flex-col"
          onSubmit={methods.handleSubmit(submit)}
        >
          {variables.map((variable) => (
            <div key={variable.key}>
              {variable.hint ? (
                <div className="flex flex-col gap-[6px]">
                  <div className="text-[14px] flex items-center gap-[6px]">
                    <span>{variable.label}</span>
                    <span
                      data-tooltip-id="tooltip"
                      data-tooltip-content={variable.hint}
                      className="w-[16px] h-[16px] rounded-full border border-textColor/60 text-textColor/60 flex items-center justify-center text-[11px] leading-none cursor-help select-none"
                    >
                      i
                    </span>
                  </div>
                  <Input
                    label=""
                    name={variable.key}
                    type={variable.type == 'text' ? 'text' : 'password'}
                    className="cc-input"
                  />
                </div>
              ) : (
                <Input
                  label={variable.label}
                  name={variable.key}
                  type={variable.type == 'text' ? 'text' : 'password'}
                  className="cc-input"
                />
              )}
            </div>
          ))}
          <div className="cc-actions">
            <Button type="submit" className="cc-primary">{t('connect', 'Connect')}</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
const ExtensionNotFound: FC = () => {
  const modals = useModals();
  const t = useT();
  return (
    <div className="cc-missing flex flex-col gap-[16px]">
      <p className="cc-copy">
        {t(
          'extension_not_available',
          'The browser extension for this channel is not available in Crea8one. Contact support@crea8.one if you need it.'
        )}
      </p>
      <div className="cc-actions">
        <Button
          type="button"
          secondary
          className="cc-secondary"
          onClick={() => modals.closeCurrent()}
        >
          {t('cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
};

const ChromeExtensionWarning: FC<{
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ onConfirm, onCancel }) => {
  const modals = useModals();
  const t = useT();
  return (
    <div className="cc-notice flex flex-col gap-[16px]">
      <p className="cc-copy">
        {t(
          'chrome_extension_warning_intro',
          'This channel connects via the browser extension. Please be aware of the following:'
        )}
      </p>
      <ul className="cc-bullets">
        <li>
          {t(
            'chrome_extension_warning_tos',
            'Using a browser extension to interact with a platform may violate its terms of service and could result in your account being suspended or banned.'
          )}
        </li>
        <li>
          {t(
            'chrome_extension_warning_unstable',
            'This method is not as reliable as native integrations and may experience random disconnections.'
          )}
        </li>
        <li>
          {t(
            'chrome_extension_warning_reconnect',
            'You may need to reconnect periodically if the session expires.'
          )}
        </li>
        <li>
          We will store your cookies securely to facilitate the connection.
        </li>
        <li>
          Crea8one does not take responsibility for any issues arising or account
          termination due to the use of this method.
        </li>
      </ul>
      <div className="cc-actions">
        <Button
          type="button"
          secondary
          className="cc-secondary"
          onClick={() => {
            modals.closeCurrent();
            onCancel();
          }}
        >
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          className="cc-primary"
          onClick={() => {
            modals.closeCurrent();
            onConfirm();
          }}
        >
          {t('i_understand_continue', 'I understand, continue')}
        </Button>
      </div>
    </div>
  );
};

export const AddProviderComponent: FC<{
  social: Array<{
    identifier: string;
    name: string;
    toolTip?: string;
    isExternal: boolean;
    isWeb3: boolean;
    isChromeExtension?: boolean;
    comingSoon?: boolean;
    extensionCookies?: Array<{
      name: string;
      domain: string;
    }>;
    customFields?: Array<{
      key: string;
      label: string;
      validation: string;
      type: 'text' | 'password';
      hint?: string;
    }>;
  }>;
  article: Array<{
    identifier: string;
    name: string;
  }>;
  invite: boolean;
  update?: () => void;
  onboarding?: boolean;
  isMobile?: boolean;
}> = (props) => {
  const { update, social, article, onboarding, isMobile } = props;
  const { isGeneral, extensionId } = useVariables();
  const toaster = useToaster();
  const router = useRouter();
  const fetch = useFetch();
  const modal = useModals();
  const t = useT();
  const getSocialLink = useCallback(
    (
        invite: boolean,
        identifier: string,
        isExternal: boolean,
        isWeb3: boolean,
        isChromeExtension?: boolean,
        customFields?: Array<{
          key: string;
          label: string;
          validation: string;
          defaultValue?: string;
          type: 'text' | 'password';
          hint?: string;
        }>,
        comingSoon?: boolean
      ) =>
      async () => {
        if (comingSoon) {
          toaster.show(t('coming_soon', 'Coming soon'), 'warning');
          return;
        }
        const onboardingParam = onboarding ? 'onboarding=true' : '';
        const openWeb3 = async () => {
          const { component: Web3Providers } = web3List.find(
            (item) => item.identifier === identifier
          )!;
          const { url } = await (
            await fetch(
              `/integrations/social/${identifier}${
                onboarding ? '?onboarding=true' : ''
              }`
            )
          ).json();
          modal.openModal({
            title: `Add ${capitalize(identifier)}`,
            withCloseButton: true,
            ...(isMobile ? { removeLayout: true, fullScreen: true } : {}),
            classNames: {
              modal: 'bg-transparent text-textColor',
            },
            children: (
              <div
                {...(isMobile ? { className: 'h-full bg-black p-[20px]' } : {})}
              >
                <Web3Providers
                  onComplete={(code, newState) => {
                    window.location.href = `/integrations/social/${identifier}?code=${encodeURIComponent(code)}&state=${newState}${
                      onboarding ? '&onboarding=true' : ''
                    }`;
                  }}
                  nonce={url}
                />
              </div>
            ),
          });
          return;
        };
        const gotoIntegration = async (externalUrl?: string) => {
          // Mobile WebView: reuse the existing `externalUrl` param to
          // carry the `postiz://` deep link so the backend redirects
          // back to the iOS/Android app after OAuth completes, instead
          // of the default web redirect.
          // Only send externalUrl when the provider asked for an instance
          // URL. encodeURIComponent(undefined) is the string "undefined".
          const params = [
            externalUrl
              ? `externalUrl=${encodeURIComponent(externalUrl)}`
              : '',
            onboardingParam,
            invite ? 'invite=true' : '',
            isMobile
              ? `redirectUrl=${encodeURIComponent('postiz://integrations')}`
              : '',
          ]
            .filter(Boolean)
            .join('&');
          const { url, err, message } = await (
            await fetch(
              `/integrations/social/${identifier}${params ? `?${params}` : ''}`
            )
          ).json();
          if (err) {
            toaster.show(
              message ||
                t(
                  'could_not_connect_to_platform',
                  'Could not connect to the platform'
                ),
              'warning'
            );
            return;
          }

          if (invite) {
            const copied = await writeInviteLink(url);
            if (copied) {
              toaster.show(
                'Invite link copied to clipboard, link will be available for 1 hour',
                'success'
              );
              modal.closeAll();
              return;
            }

            modal.openModal({
              title: t('invite_link_title', 'Invite link'),
              withCloseButton: true,
              size: '480px',
              classNames: { modal: 'cc-invite-modal' },
              ...(isMobile ? { removeLayout: true, fullScreen: true } : {}),
              children: <InviteLinkModal url={url} />,
            });
            return;
          }

          if (isMobile) {
            // In the mobile WebView the OAuth provider (Google, Facebook,
            // etc.) typically refuses in-WebView sign-in. Post the URL
            // out to React Native so it can open the system browser;
            // `window.open`/`location.href` aren't reliable here because
            // RN WebView doesn't always route them through the native
            // navigation intercept. The backend redirects back to the
            // app via `postiz://` once OAuth completes.
            const rn = (window as any).ReactNativeWebView;
            if (rn && typeof rn.postMessage === 'function') {
              rn.postMessage(JSON.stringify({ type: 'open-external', url }));
              return;
            }
            window.open(url, '_blank');
            return;
          }

          window.location.href = url;
        };
        if (isWeb3) {
          openWeb3();
          return;
        }
        if (isChromeExtension) {
          const confirmed = await new Promise<boolean>((resolve) => {
          modal.openModal({
            title: t('chrome_extension_notice', 'Browser Extension Notice'),
            withCloseButton: true,
            size: '520px',
            classNames: { modal: 'cc-notice-modal' },
            onClose: () => resolve(false),
              children: (
                <ChromeExtensionWarning
                  onConfirm={() => {
                    resolve(true);
                  }}
                  onCancel={() => {
                    resolve(false);
                  }}
                />
              ),
            });
          });
          if (!confirmed) {
            return;
          }
          if (!extensionId || !chrome?.runtime?.sendMessage) {
            modal.openModal({
              title: t('extension_not_available_title', 'Extension Not Found'),
              withCloseButton: true,
              size: '460px',
              classNames: { modal: 'cc-missing-modal' },
              children: <ExtensionNotFound />,
            });
            return;
          }
          try {
            await new Promise<void>((resolve, reject) => {
              chrome.runtime.sendMessage(
                extensionId,
                { type: 'PING' },
                (response: any) => {
                  if (chrome.runtime.lastError || !response?.status) {
                    reject(new Error('Extension not reachable'));
                  } else {
                    resolve();
                  }
                }
              );
            });
          } catch {
            toaster.show(
              t(
                'extension_not_installed',
                'Crea8one browser extension is not installed or not reachable.'
              ),
              'warning'
            );
            return;
          }
          try {
            const cookieResponse = await new Promise<any>((resolve, reject) => {
              chrome.runtime.sendMessage(
                extensionId,
                { type: 'GET_COOKIES', provider: identifier },
                (response: any) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(response);
                  }
                }
              );
            });
            if (!cookieResponse.success) {
              toaster.show(
                cookieResponse.error ||
                  t(
                    'extension_cookies_missing',
                    'Could not get cookies. Please log in to the platform first.'
                  ),
                'warning'
              );
              return;
            }
            const { url } = await (
              await fetch(
                `/integrations/social/${identifier}${
                  onboarding ? '?onboarding=true' : ''
                }`
              )
            ).json();
            modal.closeAll();
            window.location.href = `/integrations/social/${identifier}?state=${url}&code=${Buffer.from(
              JSON.stringify(cookieResponse.cookies)
            ).toString('base64')}${onboarding ? '&onboarding=true' : ''}`;
          } catch {
            toaster.show(
              t(
                'extension_communication_error',
                'Failed to communicate with the browser extension.'
              ),
              'warning'
            );
          }
          return;
        }
        if (isExternal) {
          modal.openModal({
            title: 'URL',
            withCloseButton: true,
            size: '440px',
            ...(isMobile ? { removeLayout: true, fullScreen: true } : {}),
            classNames: {
              modal: 'cc-url-modal text-textColor',
            },
            children: <UrlModal gotoUrl={gotoIntegration} />,
          });
          return;
        }
        if (customFields) {
          modal.openModal({
            title: t('add_provider_title', 'Add Provider'),
            withCloseButton: true,
            size: '460px',
            ...(isMobile ? { removeLayout: true, fullScreen: true } : {}),
            classNames: {
              modal: 'cc-fields-modal text-textColor',
            },
            children: (
              <div
                {...(isMobile ? { className: 'h-full bg-black p-[20px]' } : {})}
              >
                <CustomVariables
                  identifier={identifier}
                  gotoUrl={(url: string) => router.push(url)}
                  variables={customFields}
                  onboarding={onboarding}
                />
              </div>
            ),
          });
          return;
        }
        await gotoIntegration();
      },
    [onboarding]
  );

  return (
    <div
      className="cc-picker w-full flex flex-col gap-[16px] relative"
      data-invite={props.invite ? 'true' : 'false'}
    >
      {props.invite ? (
        <p className="invite-purpose text-[13px] leading-[1.45] text-textItemBlur">
          {t(
            'invite_link',
            'Send Invite Link to a customer to add channel'
          )}
        </p>
      ) : null}
      <div className="flex flex-col">
        <div
          className={clsx(
            isMobile && 'gap-[20px] flex flex-col',
            !isMobile &&
              'cc-grid grid grid-cols-5 gap-[10px] justify-items-center justify-center',
            isMobile ? {} : onboarding ? 'grid-cols-9' : 'grid-cols-5'
          )}
        >
          {social
            .filter((item) => {
              if (!props.invite) {
                return true;
              }

              return (
                !item.isExternal &&
                !item.isWeb3 &&
                !item.isChromeExtension &&
                !item.customFields
              );
            })
            .map((item) => (
              <div
                key={item.identifier}
                onClick={getSocialLink(
                  props.invite,
                  item.identifier,
                  item.isExternal,
                  item.isWeb3,
                  item.isChromeExtension,
                  item.customFields,
                  item.comingSoon
                )}
                {...(!!item.toolTip
                  ? {
                      'data-tooltip-id': 'tooltip',
                      'data-tooltip-content': item.toolTip,
                    }
                  : {})}
                className={clsx(
                  isMobile
                    ? 'flex-row h-[72px] p-[16px]'
                    : 'flex-col p-[10px] h-[100px] justify-center',
                  item.comingSoon && 'is-soon',
                  'cc-tile w-full text-[14px] rounded-[16px] bg-newTableHeader border border-transparent text-textColor relative items-center flex gap-[10px] cursor-pointer transition-colors hover:border-[#00D9FF] hover:bg-[#00D9FF]/10'
                )}
              >
                {item.comingSoon && (
                  <span className="cc-soon pointer-events-none absolute -top-[7px] start-[8px] z-[2] max-w-[calc(100%-16px)] truncate rounded-full bg-[#00D9FF] px-[6px] text-[9px] font-[700] leading-[16px] text-[#0a0a0a]">
                    {t('coming_soon', 'Coming soon')}
                  </span>
                )}
                {!!item.toolTip && !isMobile && (
                  <HugeIcon
                    name="info"
                    size={16}
                    className="cc-info absolute top-[10px] end-[10px]"
                  />
                )}
                <div>
                  {item.identifier === 'youtube' ? (
                    <img src={`/icons/platforms/youtube.svg`} />
                  ) : (
                    <img
                      className={clsx(
                        'w-[32px] h-[32px]',
                        item.identifier !== 'google_my_business' &&
                          'rounded-full'
                      )}
                      src={`/icons/platforms/${item.identifier}.png`}
                    />
                  )}
                </div>
                <div
                  className={clsx(
                    isMobile ? '' : 'whitespace-pre-wrap',
                    'cc-name text-center'
                  )}
                >
                  {item.name}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
