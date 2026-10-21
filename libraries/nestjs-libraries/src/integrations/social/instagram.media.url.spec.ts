import 'reflect-metadata';
import {
  instagramGraphMediaQuery,
  instagramPublicMediaUrl,
} from '@gitroom/nestjs-libraries/integrations/social/instagram.provider';

const signedPng =
  'https://bucket.account.r2.cloudflarestorage.com/6YoWZ02pFw.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=key%2F20261021%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20261021T110000Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=abcdef';

describe('instagram media url for Meta', () => {
  it('keeps a signed https image URL as one Graph parameter', () => {
    const query = instagramGraphMediaQuery(signedPng, {
      story: false,
      alone: true,
      thumbOffset: 0,
    });
    const parsed = new URL(
      `https://graph.facebook.com/v23.0/1784/media?${query}&access_token=token`
    );

    expect(parsed.searchParams.get('image_url')).toBe(signedPng);
    expect(parsed.searchParams.get('access_token')).toBe('token');
    expect(parsed.searchParams.has('X-Amz-Signature')).toBe(false);
    expect(parsed.searchParams.get('image_url')).toMatch(/^https:\/\//);
  });

  it('marks a story image and a reel video without leaking the signature', () => {
    const story = new URL(
      `https://graph.facebook.com/v23.0/1784/media?${instagramGraphMediaQuery(signedPng, {
        story: true,
        alone: true,
        thumbOffset: 0,
      })}`
    );
    expect(story.searchParams.get('image_url')).toBe(signedPng);
    expect(story.searchParams.get('media_type')).toBe('STORIES');

    const video =
      'https://media.example.com/clip.mp4?X-Amz-Signature=abc&X-Amz-Expires=604800';
    const reel = new URL(
      `https://graph.facebook.com/v23.0/1784/media?${instagramGraphMediaQuery(video, {
        story: false,
        alone: true,
        thumbOffset: 1500,
      })}&access_token=token`
    );
    expect(reel.searchParams.get('video_url')).toBe(video);
    expect(reel.searchParams.get('media_type')).toBe('REELS');
    expect(reel.searchParams.get('thumb_offset')).toBe('1500');
    expect(reel.searchParams.has('X-Amz-Signature')).toBe(false);
  });

  it('uses the file name, not the signature query, to choose image or video', () => {
    const pngWithMp4Query =
      'https://media.example.com/6YoWZ02pFw.png?note=clip.mp4&X-Amz-Signature=abc';
    const parsed = new URL(
      `https://graph.facebook.com/v23.0/1784/media?${instagramGraphMediaQuery(pngWithMp4Query, {
        story: false,
        alone: false,
        thumbOffset: 0,
      })}`
    );
    expect(parsed.searchParams.get('image_url')).toBe(pngWithMp4Query);
    expect(parsed.searchParams.get('video_url')).toBeNull();
  });

  it('rejects a url Meta cannot fetch', () => {
    expect(() => instagramPublicMediaUrl('/uploads/6YoWZ02pFw.png')).toThrow(
      /absolute public https/
    );
    expect(() => instagramPublicMediaUrl('http://media.example.com/6YoWZ02pFw.png')).toThrow(
      /absolute public https/
    );
    expect(() => instagramPublicMediaUrl('https://localhost/6YoWZ02pFw.png')).toThrow(
      /absolute public https/
    );
  });
});
