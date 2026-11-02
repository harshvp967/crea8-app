'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import {
  OauthClientLogo,
  OauthClientTile,
  resolveOauthClientBrand,
} from '@gitroom/frontend/components/oauth/client-brand';
import { OAuthConsentSkeleton } from '@gitroom/frontend/components/ui/skeleton';

const SCOPE_LABELS: Record<string, string> = {
  'mcp:read': 'Read your posts',
  'mcp:write': 'Create and schedule posts',
  'channels:read': 'See connected channels',
  'channel:read': 'See connected channels',
  'integrations:read': 'See connected channels',
  openid: 'Confirm who you are',
  email: 'See your email',
  profile: 'See your profile',
  offline_access: 'Stay signed in',
};

const requestedScopes = (scope: string | null) => {
  if (!scope) return [];
  const seen = new Set<string>();
  const scopes: string[] = [];
  for (const part of scope.split(/[\s,]+/)) {
    let token = part.trim();
    try {
      token = decodeURIComponent(token).trim();
    } catch {
      token = part.trim();
    }
    if (!token || seen.has(token)) continue;
    seen.add(token);
    scopes.push(token);
  }
  return scopes;
};

const scopeLabel = (scope: string) => {
  const known = SCOPE_LABELS[scope.toLowerCase()];
  if (known) return known;
  const phrase = scope.replace(/[:._-]+/g, ' ').trim().replace(/\s+/g, ' ');
  if (!phrase) return scope;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

const FIELD_CELLS = 30;

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
    {Array.from({ length: FIELD_CELLS }, (_, index) => {
      const client = FIELD_CLIENTS[index % FIELD_CLIENTS.length];
      return <OauthClientLogo key={`${client}-${index}`} client={client} tile />;
    })}
  </div>
);

const useConnectedWorkspace = () => {
  const fetch = useFetch();
  const loadSelf = useCallback(async () => {
    const response = await fetch('/user/self');
    if (!response.ok) return null;
    return response.json();
  }, [fetch]);
  const loadOrgs = useCallback(async () => {
    const response = await fetch('/user/organizations');
    if (!response.ok) return [];
    return response.json();
  }, [fetch]);
  const { data: self } = useSWR('oauth-consent-self', loadSelf, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });
  const { data: orgs } = useSWR('oauth-consent-orgs', loadOrgs, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });
  if (!self?.orgId || !Array.isArray(orgs)) return '';
  const match = orgs.find(
    (org: { id?: string; name?: string }) => org?.id === self.orgId
  );
  return typeof match?.name === 'string' ? match.name.trim() : '';
};

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
  const scopes = requestedScopes(searchParams.get('scope'));
  const workspace = useConnectedWorkspace();

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
        <OAuthConsentSkeleton />
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
          {typeof appInfo.app.description === 'string' &&
          appInfo.app.description.trim() ? (
            <p className="oauth-consent-description">
              {appInfo.app.description.trim()}
            </p>
          ) : null}
          {workspace ? (
            <p className="oauth-consent-workspace">{workspace}</p>
          ) : null}
          <ul className="oauth-consent-scopes">
            {(scopes.length ? scopes : ['profile']).map((scope) => (
              <li className="oauth-consent-scope" key={scope}>
                {scopeLabel(scope)}
              </li>
            ))}
          </ul>
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
