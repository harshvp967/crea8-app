'use client';

import React, { useCallback, useRef, useState } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type BrandVoiceResponse = {
  enabled: boolean;
  traits: string[];
  sample: string;
  count: number;
  learnedAt: string;
  limited?: boolean;
  message?: string;
  error?: string;
};

const empty: BrandVoiceResponse = {
  enabled: false,
  traits: [],
  sample: '',
  count: 0,
  learnedAt: '',
};

const useBrandVoice = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const response = await fetch('/brand-voice');
    if (!response.ok) {
      return empty;
    }
    return response.json();
  }, [fetch]);

  return useSWR<BrandVoiceResponse>('brand-voice', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
};

export const BrandVoiceSettings = () => {
  const t = useT();
  const fetch = useFetch();
  const { data, mutate } = useBrandVoice();
  const [posts, setPosts] = useState<string[]>([]);
  const postsRef = useRef<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const voice = data || empty;

  const addPost = useCallback((text: string) => {
    const clean = text.trim().slice(0, 2000);
    if (!clean || postsRef.current.length >= 5 || postsRef.current.includes(clean)) {
      return postsRef.current;
    }
    const next = [...postsRef.current, clean];
    postsRef.current = next;
    setPosts(next);
    setDraft('');
    return next;
  }, []);

  const learn = useCallback(async () => {
    const samples = addPost(draft);
    if (samples.length < 3) {
      setError(t('brand_voice_count', 'Paste 3 to 5 posts.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/brand-voice', {
        method: 'POST',
        body: JSON.stringify({ samples }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.error || body.limited) {
        setError(
          body.message ||
            body.error ||
            t('brand_voice_failed', 'Could not read the voice. Try again.')
        );
        return;
      }
      mutate(body, false);
    } catch {
      setError(t('brand_voice_failed', 'Could not read the voice. Try again.'));
    } finally {
      setSaving(false);
    }
  }, [addPost, draft, fetch, mutate, t]);

  const toggle = useCallback(async () => {
    if (!voice.traits.length) {
      setError(t('brand_voice_first', 'Save a voice before turning it on.'));
      return;
    }
    setError('');
    const response = await fetch('/brand-voice', {
      method: 'PUT',
      body: JSON.stringify({ enabled: !voice.enabled }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) {
      setError(body.message || body.error || t('brand_voice_failed', 'Could not read the voice. Try again.'));
      return;
    }
    mutate(body, false);
  }, [fetch, mutate, t, voice.enabled, voice.traits.length]);

  const added = posts.length + (draft.trim() ? 1 : 0);
  const learnedOn = voice.learnedAt ? dayjs(voice.learnedAt).format('MMM D') : '';

  return (
    <div className="c8-voice">
      <section className="c8-voice-card">
        <div className="c8-voice-card-head">
          <h2>{t('your_posts', 'Your posts')}</h2>
          <span className="c8-voice-pill">
            {t('posts_added', '{{count}} of 5 added', { count: Math.min(added, 5) })}
          </span>
        </div>
        <p className="c8-voice-help">
          {t(
            'brand_voice_help',
            'Paste 3 to 5 posts you wrote yourself. We only read them to learn how you write, and never publish them.'
          )}
        </p>
        <ul className="c8-voice-posts">
          {posts.map((post, index) => (
            <li key={`${index}-${post.slice(0, 12)}`}>
              <span>{index + 1}</span>
              <p>{post}</p>
              <button
                type="button"
                aria-label={t('remove', 'Remove')}
                onClick={() => {
                  const next = postsRef.current.filter((_, row) => row !== index);
                  postsRef.current = next;
                  setPosts(next);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {posts.length < 5 && (
          <label className="c8-voice-add">
            <span>{t('add_another_post', 'Add another post')}</span>
            <textarea
              maxLength={2000}
              value={draft}
              placeholder={t(
                'paste_a_post',
                'Paste a post you wrote, up to 2,000 characters'
              )}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => addPost(draft)}
            />
          </label>
        )}
        {!!error && <p className="c8-voice-error">{error}</p>}
        <div className="c8-voice-actions">
          <p>
            {t(
              'learn_again',
              'Takes about 10 seconds. Learning again replaces your current voice.'
            )}
          </p>
          <button type="button" className="c8-voice-learn" disabled={saving} onClick={learn}>
            {saving ? t('learning', 'Learning…') : t('learn_my_voice', 'Learn my voice')}
          </button>
        </div>
      </section>
      <section className="c8-voice-card">
        <div className="c8-voice-card-head">
          <h2>{t('your_voice', 'Your voice')}</h2>
          {!!voice.traits.length && (
            <span className="c8-voice-pill is-learned">{t('learned', 'Learned')}</span>
          )}
        </div>
        <p className="c8-voice-help">
          {voice.traits.length
            ? t(
                'learned_from',
                'Learned from {{count}} posts on {{date}}. Add more posts and learn again to sharpen it.',
                { count: voice.count || voice.traits.length, date: learnedOn }
              )
            : t(
                'voice_empty',
                'Your voice profile shows up here after you learn from 3 to 5 posts.'
              )}
        </p>
        {!!voice.traits.length && (
          <>
            <div className="c8-voice-label">{t('traits', 'Traits')}</div>
            <div className="c8-voice-chips">
              {voice.traits.map((trait) => (
                <span key={trait}>{trait}</span>
              ))}
            </div>
            {!!voice.sample && (
              <div className="c8-voice-sample">
                <div>{t('sample_in_your_voice', 'Sample in your voice')}</div>
                <p>{voice.sample}</p>
              </div>
            )}
          </>
        )}
        <div className="c8-voice-toggle">
          <div>
            <strong>{t('use_my_voice', 'Use my voice for all AI posts')}</strong>
            <p>{t('voice_applies', 'One idea, every platform')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={voice.enabled}
            className={voice.enabled ? 'is-on' : ''}
            onClick={toggle}
          />
        </div>
      </section>
    </div>
  );
};
