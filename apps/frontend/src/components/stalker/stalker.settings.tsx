'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

export const StalkerSettings = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { status, project, refreshProjects } = useStalkerProject();
  const [running, setRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState('');
  const [saving, setSaving] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [aliases, setAliases] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [handleX, setHandleX] = useState('');
  const [handleRedditUser, setHandleRedditUser] = useState('');
  const [handleRedditSubreddit, setHandleRedditSubreddit] = useState('');
  const [handleYoutube, setHandleYoutube] = useState('');
  const [handleLinkedin, setHandleLinkedin] = useState('');
  const [handleInstagram, setHandleInstagram] = useState('');
  const [handleFacebook, setHandleFacebook] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (!project) {
      return;
    }
    setBrandName(project.brandName || project.name || '');
    setAliases(project.aliases || '');
    setExclusions(project.exclusions || '');
    setHandleX(project.handleX || '');
    setHandleRedditUser(project.handleRedditUser || '');
    setHandleRedditSubreddit(project.handleRedditSubreddit || '');
    setHandleYoutube(project.handleYoutube || '');
    setHandleLinkedin(project.handleLinkedin || '');
    setHandleInstagram(project.handleInstagram || '');
    setHandleFacebook(project.handleFacebook || '');
    setAlertEmail(project.alertEmail || '');
    setAlertsEnabled(!!project.alertsEnabled);
    setWebhookUrl(project.webhookUrl || '');
  }, [project]);

  const checkNow = async () => {
    setRunning(true);
    setLastCheck('');
    const response = await fetch('/stalker/poll', { method: 'POST' });
    const payload = (await response.json().catch(() => null)) as {
      totals?: { found?: number; stored?: number; duplicates?: number; offTopic?: number };
      sources?: Array<{ ok?: boolean; error?: string }>;
    } | null;
    setRunning(false);
    const totals = payload?.totals;
    if (!response.ok || !totals) {
      toaster.show('The check did not finish', 'warning');
      setLastCheck('The check did not finish.');
      return;
    }
    const summary = `Found ${totals.found ?? 0}, stored ${totals.stored ?? 0} new (${totals.duplicates ?? 0} duplicates)${
      totals.offTopic ? `, ${totals.offTopic} off-topic` : ''
    }`;
    const failed = (payload?.sources || []).filter((source) => source && source.ok === false);
    const errors = [
      ...new Set(
        failed
          .map((source) => source.error)
          .filter((error): error is string => typeof error === 'string' && error.length > 0)
      ),
    ];
    const detail = [summary, ...errors].join(' · ');
    setLastCheck(detail);
    toaster.show(errors[0] || summary, errors.length ? 'warning' : 'success');
  };

  const save = async () => {
    if (!project) {
      return;
    }
    setSaving(true);
    const response = await fetch(`/stalker/projects/${project.id}`, {
      method: 'POST',
      body: JSON.stringify({
        brandName,
        aliases,
        exclusions,
        handleX,
        handleRedditUser,
        handleRedditSubreddit,
        handleYoutube,
        handleLinkedin,
        handleInstagram,
        handleFacebook,
        alertEmail,
        alertsEnabled,
        webhookUrl,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show('Could not save these settings', 'warning');
      return;
    }
    refreshProjects();
    toaster.show('Project settings saved', 'success');
  };

  const sources = [
    ...(status?.sources || []).map((source) => ({
      id: source.id,
      label: source.label,
      available: source.available,
      detail: source.detail,
    })),
    ...(status?.commentSources || []).map((source) => ({
      id: source.id,
      label: source.label,
      available: source.available,
      detail: source.available ? 'Connected account' : 'Connect a channel',
    })),
  ];

  return (
    <div className="flex max-w-[720px] flex-col gap-[16px]">
      <div>
        <h1 className="text-[28px] font-[600]">
          {t('stalker_settings', 'Settings')}
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Brand names and handles are what Stalker searches for. Comments from connected channels stay in the same feed.
        </p>
      </div>
      <div className="flex flex-col gap-[12px] rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px]">
        <Input label="Brand name" translationKey="label_brand_name" name="brandName" disableForm={true} value={brandName} onChange={(event) => setBrandName(event.target.value)} />
        <label className="flex flex-col gap-[6px] text-[14px]">
          Aliases, one per line
          <textarea name="aliases" className="min-h-[72px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[12px] py-[10px] text-[14px]" value={aliases} onChange={(event) => setAliases(event.target.value)} />
        </label>
        <div className="grid gap-[10px] sm:grid-cols-2">
          <Input label="X handle" translationKey="label_handle_x" name="handleX" disableForm={true} value={handleX} onChange={(event) => setHandleX(event.target.value)} />
          <Input label="YouTube handle" translationKey="label_handle_youtube" name="handleYoutube" disableForm={true} value={handleYoutube} onChange={(event) => setHandleYoutube(event.target.value)} />
          <Input label="Reddit username" translationKey="label_handle_reddit_user" name="handleRedditUser" disableForm={true} value={handleRedditUser} onChange={(event) => setHandleRedditUser(event.target.value)} />
          <Input label="Subreddit" translationKey="label_handle_reddit_subreddit" name="handleRedditSubreddit" disableForm={true} value={handleRedditSubreddit} onChange={(event) => setHandleRedditSubreddit(event.target.value)} />
          <Input label="LinkedIn company" translationKey="label_handle_linkedin" name="handleLinkedin" disableForm={true} value={handleLinkedin} onChange={(event) => setHandleLinkedin(event.target.value)} />
          <Input label="Instagram handle" translationKey="label_handle_instagram" name="handleInstagram" disableForm={true} value={handleInstagram} onChange={(event) => setHandleInstagram(event.target.value)} />
          <Input label="Facebook page" translationKey="label_handle_facebook" name="handleFacebook" disableForm={true} value={handleFacebook} onChange={(event) => setHandleFacebook(event.target.value)} />
        </div>
        <label className="flex flex-col gap-[6px] text-[14px]">
          Negative keywords, one per line
          <textarea name="exclusions" className="min-h-[72px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[12px] py-[10px] text-[14px]" value={exclusions} onChange={(event) => setExclusions(event.target.value)} />
        </label>
        <Input label="Alert email" translationKey="label_alert_email" name="alertEmail" disableForm={true} value={alertEmail} onChange={(event) => setAlertEmail(event.target.value)} placeholder="you@example.com" />
        <label className="flex items-center gap-[8px] text-[14px]">
          <input type="checkbox" checked={alertsEnabled} onChange={(event) => setAlertsEnabled(event.target.checked)} />
          Turn alerts on. Scope, digest, spikes, and the inbox are on the Alerts page.
        </label>
        <Input label="Webhook URL" translationKey="label_webhook_url" name="webhookUrl" disableForm={true} value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://example.com/hooks/stalker" />
        <p className="text-[12px] text-textItemBlur">
          A public https address receives mention.created after each new mention is stored. Leave it empty to turn the webhook off.
        </p>
        <div>
          <Button type="button" loading={saving} onClick={save}>
            Save project
          </Button>
        </div>
      </div>
      <dl className="flex flex-col gap-[8px] rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px] text-[14px]">
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Automatic check</dt>
          <dd>Every {status?.pollHours || 6} hours</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Keywords searched each run</dt>
          <dd>{status?.keywordsSearchedPerRun || 5}</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Saved keyword limit</dt>
          <dd>{status?.maxKeywords || 10}</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Classification</dt>
          <dd>
            {status?.openAi
              ? 'OpenAI is configured'
              : 'Waiting for OPENAI_API_KEY'}
          </dd>
        </div>
      </dl>
      <ul className="flex flex-col gap-[8px]">
        {sources.map((source) => (
          <li
            key={source.id}
            className="flex items-center justify-between gap-[12px] rounded-[12px] border border-newBorder bg-newBgColorInner px-[14px] py-[10px] text-[14px]"
          >
            <span>{source.label}</span>
            <span
              className={clsx(
                'text-[13px]',
                source.available ? 'text-[#3DDC97]' : 'text-textItemBlur'
              )}
            >
              {source.available ? 'Available' : source.detail}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-start gap-[8px]">
        <Button type="button" loading={running} onClick={checkNow}>
          Check now
        </Button>
        {running ? (
          <p className="text-[13px] text-textItemBlur">Checking sources…</p>
        ) : null}
        {lastCheck ? (
          <p className="max-w-[640px] text-[13px] text-textItemBlur" role="status">
            {lastCheck}
          </p>
        ) : null}
      </div>
    </div>
  );
};
