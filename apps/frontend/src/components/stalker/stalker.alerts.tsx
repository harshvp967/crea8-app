'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useStalkerAlerts } from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

const selectClass =
  'bg-[#141414] border border-[#2a2a2a] rounded-[10px] px-[12px] py-[8px] text-[13px]';

type AlertRow = {
  id: string;
  kind: string;
  channel: string;
  status: string;
  title: string;
  body: string;
  error?: string;
  attempts?: number;
  readAt?: string | null;
  createdAt?: string;
};

const statusClass = (status: string) => {
  if (status === 'SENT') return 'text-[#3DDC97]';
  if (status === 'FAILED') return 'text-[#FF6B6B]';
  return 'text-[#FFB020]';
};

export const StalkerAlerts = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { project, refreshProjects } = useStalkerProject();
  const { data, isLoading, mutate } = useStalkerAlerts(project?.id || null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertScope, setAlertScope] = useState('URGENT');
  const [alertDelivery, setAlertDelivery] = useState('INSTANT');
  const [spikeEnabled, setSpikeEnabled] = useState(false);
  const [spikeMultiplier, setSpikeMultiplier] = useState(2);
  const [sentimentDropEnabled, setSentimentDropEnabled] = useState(false);
  const [sentimentDropPoints, setSentimentDropPoints] = useState(20);
  const [alertCooldownHours, setAlertCooldownHours] = useState(12);

  useEffect(() => {
    if (!project) {
      return;
    }
    setAlertsEnabled(!!project.alertsEnabled);
    setAlertEmail(project.alertEmail || '');
    setAlertScope(project.alertScope || 'URGENT');
    setAlertDelivery(project.alertDelivery || 'INSTANT');
    setSpikeEnabled(!!project.spikeEnabled);
    setSpikeMultiplier(project.spikeMultiplier || 2);
    setSentimentDropEnabled(!!project.sentimentDropEnabled);
    setSentimentDropPoints(project.sentimentDropPoints || 20);
    setAlertCooldownHours(project.alertCooldownHours || 12);
  }, [project]);

  const alerts: AlertRow[] = Array.isArray(data) ? data : [];
  const unread = alerts.filter(
    (alert) => alert.channel === 'IN_APP' && !alert.readAt
  ).length;

  const save = async () => {
    if (!project) {
      return;
    }
    setSaving(true);
    const response = await fetch(`/stalker/projects/${project.id}`, {
      method: 'POST',
      body: JSON.stringify({
        alertsEnabled,
        alertEmail,
        alertScope,
        alertDelivery,
        spikeEnabled,
        spikeMultiplier: Math.min(10, Math.max(2, Number(spikeMultiplier) || 2)),
        sentimentDropEnabled,
        sentimentDropPoints: Math.min(
          80,
          Math.max(5, Number(sentimentDropPoints) || 20)
        ),
        alertCooldownHours: Math.min(
          168,
          Math.max(1, Number(alertCooldownHours) || 12)
        ),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show('Could not save these alert rules', 'warning');
      return;
    }
    refreshProjects();
    toaster.show('Alert rules saved', 'success');
  };

  const retry = async () => {
    if (!project) {
      return;
    }
    setRetrying(true);
    const response = await fetch('/stalker/alerts/retry', {
      method: 'POST',
      body: JSON.stringify({ projectId: project.id }),
    });
    setRetrying(false);
    if (!response.ok) {
      toaster.show('Could not retry alerts', 'warning');
      return;
    }
    mutate();
    toaster.show('Pending alerts were checked again', 'success');
  };

  const markRead = async (id: string) => {
    await fetch(`/stalker/alerts/${id}/read`, { method: 'POST' });
    mutate();
  };

  return (
    <div className="flex max-w-[760px] flex-col gap-[16px]">
      <div>
        <h1 className="text-[28px] font-[600]">Alerts</h1>
        <p className="mt-[6px] text-[14px] leading-[1.5] text-textItemBlur">
          In-app alerts land here. Email uses the address below and the app mail
          settings. A sent alert is not sent again. A failed email can be retried
          up to three times.
        </p>
      </div>
      <div className="flex flex-col gap-[12px] rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px]">
        <label className="flex items-center gap-[8px] text-[14px]">
          <input
            type="checkbox"
            checked={alertsEnabled}
            onChange={(event) => setAlertsEnabled(event.target.checked)}
          />
          Turn alerts on
        </label>
        <Input
          label="Alert email"
          translationKey="label_alert_email"
          name="alertEmail"
          disableForm={true}
          value={alertEmail}
          onChange={(event) => setAlertEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <div className="grid gap-[10px] sm:grid-cols-2">
          <label className="flex flex-col gap-[6px] text-[14px]">
            Which mentions
            <select
              aria-label="Alert scope"
              className={selectClass}
              value={alertScope}
              onChange={(event) => setAlertScope(event.target.value)}
            >
              <option value="URGENT">Bug, complaint, or urgency 70+</option>
              <option value="NEGATIVE">Negative mentions</option>
              <option value="ALL">Every relevant mention</option>
            </select>
          </label>
          <label className="flex flex-col gap-[6px] text-[14px]">
            Email delivery
            <select
              aria-label="Alert delivery"
              className={selectClass}
              value={alertDelivery}
              onChange={(event) => setAlertDelivery(event.target.value)}
            >
              <option value="INSTANT">Instant</option>
              <option value="DIGEST">One digest per check</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-[8px] text-[14px]">
          <label className="inline-flex items-center gap-[8px]">
            <input
              type="checkbox"
              checked={spikeEnabled}
              onChange={(event) => setSpikeEnabled(event.target.checked)}
            />
            Volume spike: at least 4 mentions in 6 hours, and at least
          </label>
          <input
            aria-label="Spike multiplier"
            className="w-[64px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[8px] py-[6px] text-[13px]"
            type="number"
            min={2}
            max={10}
            value={spikeMultiplier}
            onChange={(event) => setSpikeMultiplier(Number(event.target.value))}
          />
          <span>times the previous 6 hours</span>
        </div>
        <div className="flex flex-wrap items-center gap-[8px] text-[14px]">
          <label className="inline-flex items-center gap-[8px]">
            <input
              type="checkbox"
              checked={sentimentDropEnabled}
              onChange={(event) => setSentimentDropEnabled(event.target.checked)}
            />
            Sentiment drop: negative share rises by
          </label>
          <input
            aria-label="Sentiment drop points"
            className="w-[64px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[8px] py-[6px] text-[13px]"
            type="number"
            min={5}
            max={80}
            value={sentimentDropPoints}
            onChange={(event) =>
              setSentimentDropPoints(Number(event.target.value))
            }
          />
          <span>points over 24 hours</span>
        </div>
        <div className="flex flex-wrap items-center gap-[8px] text-[14px]">
          <span>Cooldown</span>
          <input
            aria-label="Cooldown hours"
            className="w-[72px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[8px] py-[6px] text-[13px]"
            type="number"
            min={1}
            max={168}
            value={alertCooldownHours}
            onChange={(event) =>
              setAlertCooldownHours(Number(event.target.value))
            }
          />
          <span>hours before the same spike or sentiment alert can fire again</span>
        </div>
        <p className="text-[12px] text-textItemBlur">
          Off-topic keyword hits are not alerted. Spike and sentiment alerts
          email immediately. Mention emails follow Instant or Digest. Nothing
          is sent until alerts are on and, for email, an address is saved.
        </p>
        <div className="flex flex-wrap gap-[8px]">
          <Button type="button" loading={saving} onClick={save}>
            Save rules
          </Button>
          <Button type="button" secondary loading={retrying} onClick={retry}>
            Retry failed email
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-[12px]">
        <h2 className="text-[16px] font-[600]">Inbox</h2>
        <span className="text-[13px] text-textItemBlur">
          {unread ? `${unread} unread` : 'No unread in-app alerts'}
        </span>
      </div>
      {isLoading ? (
        <p className="text-[14px] text-textItemBlur">Loading alerts…</p>
      ) : null}
      {!isLoading && !alerts.length ? (
        <p className="text-[14px] text-textItemBlur">
          No alerts yet. Save the rules, then use Check now in Settings. New
          matches, volume spikes, and sentiment drops show up here with their
          delivery state.
        </p>
      ) : null}
      <ul className="flex flex-col gap-[8px]">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className={clsx(
              'flex flex-col gap-[6px] rounded-[12px] border bg-newBgColorInner px-[14px] py-[10px]',
              alert.channel === 'IN_APP' && !alert.readAt
                ? 'border-[#00D9FF]/40'
                : 'border-newBorder'
            )}
          >
            <div className="flex flex-wrap items-center gap-[8px] text-[13px]">
              <span className="font-[600]">{alert.title}</span>
              <span className="text-textItemBlur">{alert.kind}</span>
              <span className="text-textItemBlur">{alert.channel}</span>
              <span className={statusClass(alert.status)}>{alert.status}</span>
              <span className="text-textItemBlur">
                {alert.createdAt
                  ? new Date(alert.createdAt).toLocaleString()
                  : ''}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[13px] leading-[1.5] text-textItemBlur">
              {alert.body}
            </p>
            {alert.error ? (
              <p className="text-[12px] text-[#FF6B6B]">{alert.error}</p>
            ) : null}
            {alert.channel === 'IN_APP' && !alert.readAt ? (
              <button
                type="button"
                className="self-start text-[12px] text-[#00D9FF] underline"
                onClick={() => markRead(alert.id)}
              >
                Mark read
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};
