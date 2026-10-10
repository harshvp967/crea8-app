'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { HttpStatusCode } from 'axios';
import { useRouter } from 'next/navigation';
import { Redirect } from '@gitroom/frontend/components/layout/redirect';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import dayjs from 'dayjs';
import { continueProviderList } from '@gitroom/frontend/components/new-launch/providers/continue-provider/list';
import { IntegrationContext } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { useVariables } from '@gitroom/react/helpers/variable.context';

interface TwoStepState {
  integrationId: string;
  onboarding: boolean;
  pages: any[];
  returnURL?: string;
}

interface SuccessState {
  message: string;
}

const META_DEVELOPER_ROLE =
  'Meta blocked this account (Insufficient developer role). The Crea8.one app is still unpublished, so this Facebook user must be added as an Admin, Developer, or Tester. After App Review, switch the app to Live to allow other accounts.';

// Google approved YouTube verification for project crea8one (210129842261)
// on 2026-10-03. Do not tell customers the consent screen is in Testing.
const YOUTUBE_CONNECT_DENIED =
  'Google did not complete this YouTube connection. Open the invite link again and allow access. When it succeeds, the channel is saved on the workspace that sent the link.';

function explainConnectFailure(provider: string, message?: string) {
  const text = (message || '').replace(/\s+/g, ' ').trim();
  if (/insufficient developer role/i.test(text)) {
    return META_DEVELOPER_ROLE;
  }

  if (
    provider === 'youtube' &&
    /access_denied|access blocked|verification process|not completed/i.test(
      text
    )
  ) {
    return YOUTUBE_CONNECT_DENIED;
  }

  return text || 'Could not add provider';
}

function oauthRedirectError(provider: string, searchParams: any) {
  const raw = [
    searchParams?.error_description,
    searchParams?.error_message,
    searchParams?.error_reason,
  ].find((value) => typeof value === 'string' && value.trim());
  let description = '';
  if (typeof raw === 'string') {
    const spaced = raw.replace(/\+/g, ' ').trim();
    try {
      description = decodeURIComponent(spaced);
    } catch {
      description = spaced;
    }
  }

  const bareCode = /^(access_denied|user_denied|consent_required)$/i.test(
    description
  );
  if (description && !bareCode) {
    return explainConnectFailure(provider, description);
  }

  const code =
    (typeof searchParams?.error === 'string' && searchParams.error) ||
    description;
  if (code === 'access_denied' && provider === 'youtube') {
    return YOUTUBE_CONNECT_DENIED;
  }

  if (
    code === 'access_denied' &&
    ['instagram', 'instagram-standalone', 'facebook', 'threads'].includes(
      provider
    )
  ) {
    return 'Meta denied this login. While the Crea8.one app is unpublished, this Facebook account must be an Admin, Developer, or Tester on the app.';
  }

  if (code) {
    return explainConnectFailure(provider, code);
  }

  return 'Could not add provider';
}

export const ContinueIntegration: FC<{
  provider: string;
  searchParams: any;
  logged: boolean;
}> = (props) => {
  const { provider, searchParams, logged } = props;
  const { push } = useRouter();
  const t = useT();
  const fetch = useFetch();
  const { extensionId, backendUrl } = useVariables();
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [twoStepState, setTwoStepState] = useState<TwoStepState | null>(null);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [finishInline, setFinishInline] = useState(false);
  const [inviteFinish, setInviteFinish] = useState(false);

  // Helper to handle navigation - redirects if logged or returnURL exists, otherwise shows inline
  const navigateOrShow = useCallback(
    (
      path: string,
      returnURL: string | undefined,
      successMessage: string,
      forceInline?: boolean
    ) => {
      if (returnURL) {
        // If returnURL exists, always redirect to it with the path params
        const params = path.includes('?') ? path.split('?')[1] : '';
        push(params ? `${returnURL}?${params}` : returnURL);
      } else if (logged && !forceInline) {
        // Same workspace that started the connect. An invite opened in
        // another customer's session stays on this page instead.
        push(path);
      } else {
        // If not logged in without returnURL, show success inline
        setSuccessState({ message: successMessage });
      }
    },
    [logged, push]
  );
  const modifiedParams = useMemo(() => {
    if (provider === 'mewe') {
      return {
        state: searchParams.state || '',
        code: searchParams.loginRequestToken || '',
        refresh: searchParams.refresh || '',
      };
    }
    if (provider === 'x') {
      return {
        state: searchParams.oauth_token || '',
        code: searchParams.oauth_verifier || '',
        refresh: searchParams.refresh || '',
      };
    }

    if (provider === 'tiktok-business') {
      // The TikTok Business API redirects back with `auth_code` instead of `code`
      return {
        state: searchParams.state || '',
        code: searchParams.auth_code || searchParams.code || '',
        refresh: searchParams.refresh || '',
      };
    }

    if (provider === 'vk') {
      return {
        ...searchParams,
        state: searchParams.state || '',
        code: searchParams.code + '&&&&' + searchParams.device_id,
      };
    }

    if (provider === 'mewe') {
      const hash =
        typeof window !== 'undefined' ? window.location.hash.substring(1) : '';
      const hashParams = new URLSearchParams(hash);
      return {
        state: hashParams.get('state') || searchParams.state || '',
        code: hashParams.get('loginRequestToken') || '',
        refresh: searchParams.refresh || '',
      };
    }

    return searchParams;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (searchParams?.error && !searchParams?.code) {
          setErrorMessage(
            provider === 'linkedin-page'
              ? "LinkedIn Pages isn't available yet"
              : oauthRedirectError(provider, searchParams)
          );
          setError(true);
          return;
        }

        const timezone = String(dayjs.tz().utcOffset());

        const data = await fetch(`/integrations/social-connect/${provider}`, {
          method: 'POST',
          body: JSON.stringify({ ...modifiedParams, timezone }),
        });

        if (data.status === HttpStatusCode.PreconditionFailed) {
          const { returnURL } = await data.json().catch(() => ({}));
          navigateOrShow(
            `/launches?precondition=true`,
            returnURL,
            'Precondition failed'
          );
          return;
        }

        if (data.status === HttpStatusCode.NotAcceptable) {
          const { msg, returnURL } = await data.json();
          navigateOrShow(`/launches?msg=${msg}`, returnURL, msg);
          return;
        }

        if (
          data.status !== HttpStatusCode.Ok &&
          data.status !== HttpStatusCode.Created
        ) {
          const errorData = await data.json().catch(() => ({}));
          setErrorMessage(
            explainConnectFailure(
              provider,
              errorData.message || errorData.msg
            )
          );
          setError(true);
          return;
        }

        const {
          inBetweenSteps,
          id,
          onboarding: resOnboarding,
          pages,
          pagesError,
          returnURL,
          extensionToken,
          invite,
          outsideWorkspace,
        } = await data.json();
        const onboarding = resOnboarding || searchParams.onboarding === 'true';
        const addedOnInvite = !!(invite || outsideWorkspace);
        setInviteFinish(addedOnInvite);
        setFinishInline(!!outsideWorkspace);
        const successMessage = addedOnInvite
          ? 'This channel was added to the workspace that sent you the link. You can close this window.'
          : 'Channel Updated';

        // Store refresh token in extension for background cookie refresh
        if (
          extensionToken &&
          extensionId &&
          typeof chrome !== 'undefined' &&
          chrome?.runtime?.sendMessage
        ) {
          try {
            chrome.runtime.sendMessage(
              extensionId,
              {
                type: 'STORE_REFRESH_TOKEN',
                provider,
                integrationId: id,
                jwt: extensionToken,
                backendUrl,
              },
              () => {}
            );
          } catch {
            // Silently ignore — extension may not be available
          }
        }

        // If it's a two-step provider, show the selection UI inline
        if (inBetweenSteps && !searchParams.refresh) {
          if (pagesError && !(pages || []).length) {
            setErrorMessage(explainConnectFailure(provider, pagesError));
            setError(true);
            return;
          }

          setTwoStepState({
            integrationId: id,
            onboarding,
            pages: pages || [],
            returnURL,
          });
          return;
        }

        navigateOrShow(
          `/launches?added=${provider}&msg=Channel Updated${
            onboarding ? '&onboarding=true' : ''
          }`,
          returnURL,
          successMessage,
          !!outsideWorkspace
        );
      } catch {
        setErrorMessage('Could not add provider');
        setError(true);
      }
    })();
  }, []);

  const onSave = useCallback(
    async (data: any) => {
      if (!twoStepState) return;

      setIsSaving(true);

      try {
        // OAuth state belongs to the workspace that minted the link. The
        // public save reads that org from Redis, including when this browser
        // is signed into a different workspace. Calendar continue has no state
        // and still uses the signed-in endpoint.
        const endpoint = modifiedParams?.state
          ? `/integrations/public/provider/${twoStepState.integrationId}/connect`
          : `/integrations/provider/${twoStepState.integrationId}/connect`;

        const response = await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ ...modifiedParams, ...data }),
        });

        if (
          response.status !== HttpStatusCode.Ok &&
          response.status !== HttpStatusCode.Created
        ) {
          const errorData = await response.json().catch(() => ({}));
          setErrorMessage(
            errorData.message || 'Failed to save channel configuration'
          );
          setError(true);
          return;
        }

        navigateOrShow(
          `/launches?added=${provider}&msg=Channel Added${
            twoStepState.onboarding ? '&onboarding=true' : ''
          }`,
          twoStepState.returnURL,
          inviteFinish
            ? 'This channel was added to the workspace that sent you the link. You can close this window.'
            : 'Channel Added',
          finishInline
        );
      } finally {
        setIsSaving(false);
      }
    },
    [twoStepState, fetch, modifiedParams, provider, navigateOrShow, inviteFinish, finishInline]
  );

  const Provider = useMemo(() => {
    return (
      continueProviderList[provider as keyof typeof continueProviderList] ||
      null
    );
  }, [provider]);

  const providerDisplayName = useMemo(() => {
    const names: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      'linkedin-page': 'LinkedIn',
      youtube: 'YouTube',
      gmb: 'Google Business',
      tumblr: 'Tumblr',
      'tiktok-business': 'TikTok Business',
    };
    return names[provider] || provider;
  }, [provider]);

  // Success state for non-logged users without returnURL
  if (successState) {
    return (
      <div className="flex flex-1 items-center justify-center text-white relative overflow-hidden">
        {/* Background gradient decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-[#00D9FF] rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[#00D9FF] rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 text-center">
          <div className="w-[80px] h-[80px] mx-auto mb-[24px] rounded-full bg-green-500/20 flex items-center justify-center">
            <svg
              className="w-[40px] h-[40px] text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="text-[28px] font-semibold mb-[12px]">
            {t('channel_connected', 'Channel Connected!')}
          </div>
          <div className="text-[16px] text-gray-400 max-w-[400px]">
            {successState.message ||
              t(
                'channel_connected_description',
                `Your ${providerDisplayName} channel has been successfully connected. You can close this window now.`
              )}
          </div>
        </div>
      </div>
    );
  }

  // Show the two-step selection UI
  if (twoStepState && Provider) {
    return (
      <div className="flex flex-1 items-center justify-center text-white relative overflow-hidden">
        {/* Background gradient decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-[#00D9FF] rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[#00D9FF] rounded-full blur-[120px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-[550px] mx-auto px-[20px]">
          <div className="bg-newBgColorInner border border-newBorder rounded-[26px] p-[32px] flex flex-col gap-[24px]">
            <div className="flex flex-col gap-[8px] text-center">
              <h1 className="text-[24px] font-semibold">
                {t('configure_your_channel', 'Configure Your Channel')}
              </h1>
              <p className="text-[14px] text-gray-400">
                {t(
                  'select_the_page_or_account',
                  `Select the ${providerDisplayName} page or account you want to connect.`
                )}
              </p>
            </div>

            <IntegrationContext.Provider
              value={{
                date: newDayjs(),
                value: [],
                allIntegrations: [],
                integration: {
                  editor: 'normal',
                  additionalSettings: '',
                  display: '',
                  time: [{ time: 0 }],
                  id: twoStepState.integrationId,
                  type: '',
                  name: '',
                  picture: '',
                  inBetweenSteps: true,
                  changeNickName: false,
                  changeProfilePicture: false,
                  identifier: provider,
                },
              }}
            >
              <Provider
                onSave={onSave}
                existingId={[]}
                initialData={twoStepState.pages}
                isSaving={isSaving}
              />
            </IntegrationContext.Provider>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-white relative overflow-hidden">
        {/* Background gradient decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-[#00D9FF] rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[#00D9FF] rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 text-center">
          <div className="w-[80px] h-[80px] mx-auto mb-[24px] rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="w-[40px] h-[40px] text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="text-[28px] font-semibold mb-[12px]">
            {t('could_not_add_provider', 'Could not add provider')}
          </div>
          <div className="text-[16px] text-gray-400 max-w-[520px]">
            {errorMessage ||
              t(
                'you_are_being_redirected_back',
                'An error occurred. Please try again.'
              )}
          </div>
          {logged &&
            (!errorMessage || errorMessage === 'Could not add provider') && (
              <Redirect url="/launches" delay={3000} />
            )}
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex flex-1 items-center justify-center text-white relative overflow-hidden">
      {/* Background gradient decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-[#00D9FF] rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[#00D9FF] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 text-center">
        <div className="text-[28px] font-semibold mb-[12px]">
          {t('adding_channel', 'Adding Channel')}
        </div>
        <div className="text-[16px] text-gray-400">
          {t('please_wait', 'Please wait while we connect your account...')}
        </div>
        {/* Loading spinner */}
        <div className="mt-[32px] flex justify-center">
          <div className="w-[48px] h-[48px] border-[3px] border-[#00D9FF] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
};
