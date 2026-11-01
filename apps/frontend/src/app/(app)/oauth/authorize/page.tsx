'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import {
  OauthClientLogo,
  OauthClientTile,
  resolveOauthClientBrand,
} from '@gitroom/frontend/components/oauth/client-brand';

const FIELD_CLIENTS = [
  'Claude',
  'ChatGPT',
  'Gemini',
  'Perplexity',
  'Cursor',
  'Codex',
  'VS Code / Copilot',
  'Windsurf',
  'Warp',
  'Grok Bot',
  'OpenClaw',
  'Amp',
] as const;

const RequestingMark = ({
  name,
  picture,
}: {
  name?: string;
  picture?: string;
}) => {
  if (picture) {
    return (
      <OauthClientTile>
        <img src={picture} alt={name || ''} className="h-full w-full object-cover" />
      </OauthClientTile>
    );
  }
  const brand = resolveOauthClientBrand(name);
  if (brand) {
    return <OauthClientLogo client={brand} tile />;
  }
  return <OauthClientTile>{name?.[0]?.toUpperCase() || '?'}</OauthClientTile>;
};

const ConsentField = () => (
  <div className="oauth-consent-field" aria-hidden>
    {[0, 1].map((row) => (
      <div className="oauth-consent-row" key={row}>
        {[0, 1].map((copy) => (
          <div className="oauth-consent-half" key={copy}>
            {FIELD_CLIENTS.map((client) => (
              <OauthClientLogo key={`${row}-${copy}-${client}`} client={client} tile />
            ))}
          </div>
        ))}
      </div>
    ))}
  </div>
);

const ConsentPair = ({
  name,
  picture,
}: {
  name?: string;
  picture?: string;
}) => (
  <div className="oauth-consent-pair">
    <RequestingMark name={name} picture={picture} />
    <span className="oauth-consent-line" aria-hidden />
    <OauthClientTile>
      <img
        src="/crea8one-icon-cyan.svg"
        alt="crea8.one"
        className="h-[22px] w-[22px]"
      />
    </OauthClientTile>
  </div>
);

const ConsentShell = ({ children }: { children: ReactNode }) => (
  <div className="oauth-consent">
    <ConsentField />
    <div className="oauth-consent-glow" aria-hidden />
    <div className="oauth-consent-main">{children}</div>
  </div>
);

export default function OAuthAuthorizePage() {
  const searchParams = useSearchParams();
  const fetch = useFetch();
  const [appInfo, setAppInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const clientId = searchParams.get('client_id');
  const responseType = searchParams.get('response_type');
  const state = searchParams.get('state');
  const redirectUri = searchParams.get('redirect_uri');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');

  useEffect(() => {
    if (!clientId || !responseType) {
      setError('Missing required parameters (client_id, response_type)');
      setLoading(false);
      return;
    }
    if (responseType !== 'code') {
      setError('Only response_type=code is supported');
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: responseType,
      ...(state ? { state } : {}),
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      ...(codeChallenge ? { code_challenge: codeChallenge } : {}),
      ...(codeChallengeMethod
        ? { code_challenge_method: codeChallengeMethod }
        : {}),
    });

    fetch(`/oauth/authorize?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.statusCode && data.statusCode >= 400) {
          setError(data.message || 'Invalid OAuth request');
        } else {
          setAppInfo(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to validate OAuth request');
        setLoading(false);
      });
  }, [clientId, responseType, state, redirectUri, codeChallenge, codeChallengeMethod]);

  const handleAction = useCallback(
    async (action: 'approve' | 'deny') => {
      setSubmitting(true);
      try {
        const result = await (
          await fetch('/oauth/authorize', {
            method: 'POST',
            body: JSON.stringify({
              client_id: clientId,
              state,
              action,
              ...(redirectUri ? { redirect_uri: redirectUri } : {}),
              ...(codeChallenge ? { code_challenge: codeChallenge } : {}),
              ...(codeChallengeMethod
                ? { code_challenge_method: codeChallengeMethod }
                : {}),
            }),
          })
        ).json();

        if (result.redirect) {
          window.location.href = result.redirect;
        }
      } catch {
        setError('Failed to process authorization');
        setSubmitting(false);
      }
    },
    [clientId, state, redirectUri, codeChallenge, codeChallengeMethod]
  );

  if (loading) {
    return (
      <ConsentShell>
        <div className="flex flex-col items-center gap-[24px]">
          <ConsentPair />
          <div className="w-[48px] h-[48px] border-[3px] border-c8-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      </ConsentShell>
    );
  }

  if (error) {
    return (
      <ConsentShell>
        <div className="oauth-consent-card bg-c8-surface border border-c8-line rounded-[26px] p-[32px] flex flex-col items-center gap-[16px] text-center">
          <HugeIcon name="close" size={24} className="w-[40px] h-[40px] text-c8-danger" />
          <div className="oauth-consent-name">Authorization Error</div>
          <div className="text-[16px] text-c8-muted max-w-[400px]">{error}</div>
        </div>
      </ConsentShell>
    );
  }

  if (!appInfo) {
    return null;
  }

  return (
    <ConsentShell>
      <div className="oauth-consent-card bg-c8-surface border border-c8-line rounded-[26px] p-[32px] flex flex-col gap-[24px]">
        <div className="flex flex-col items-center gap-[16px]">
          <ConsentPair
            name={appInfo.app.name}
            picture={appInfo.app.picture?.path}
          />
          <h2 className="oauth-consent-name">{appInfo.app.name}</h2>
          <p className="oauth-consent-brand">crea8.one</p>
          {appInfo.app.description ? (
            <p className="m-0 max-w-full text-center text-[14px] text-c8-muted">
              {appInfo.app.description}
            </p>
          ) : null}
        </div>
        <div className="oauth-consent-actions flex gap-[12px]">
          <button
            onClick={() => handleAction('approve')}
            disabled={submitting}
            className="flex-1 bg-btnPrimary hover:brightness-95 disabled:opacity-50 text-[#0A0A0A] rounded-[18px] h-[44px] px-[16px] text-[14px] font-[600]"
          >
            Authorize
          </button>
          <button
            onClick={() => handleAction('deny')}
            disabled={submitting}
            className="flex-1 bg-newBgColorInner border border-newBorder hover:brightness-95 disabled:opacity-50 text-newTextColor rounded-[18px] h-[44px] px-[16px] text-[14px] font-[600]"
          >
            Deny
          </button>
        </div>
      </div>
    </ConsentShell>
  );
}
