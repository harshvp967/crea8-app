import { classifyFetch, inspectPartnerVideo, signedUrlExpiry, videoCoversSchedule } from '@gitroom/nestjs-libraries/partner/gta6clips.video';

const publish = new Date('2026-11-17T00:00:00.000Z');
const week = 7 * 24 * 60 * 60 * 1000;

describe('gta6clips video url', () => {
  it('requires the signed url to last until the scheduled time plus 7 days', () => {
    const exp = publish.getTime() + week;
    const url = `https://gta6clips.app/clip.mp4?exp=${Math.floor(exp / 1000)}`;
    expect(videoCoversSchedule(url, publish)).toBe(true);
    const short = `https://gta6clips.app/clip.mp4?exp=${Math.floor((publish.getTime() + week - 1000) / 1000)}`;
    expect(videoCoversSchedule(short, publish)).toBe(false);
    expect(signedUrlExpiry('https://gta6clips.app/clip.mp4')).toBeNull();
    expect(videoCoversSchedule('https://evil.example/clip.mp4?exp=9999999999', publish)).toBe(false);
  });

  it('does not keep a copy and fails a bad fetch', async () => {
    expect(classifyFetch(404, 'video/mp4', 10)).toBe('missing');
    expect(classifyFetch(403, 'video/mp4', 10)).toBe('expired');
    expect(classifyFetch(200, 'text/html', 10)).toBe('non-video');
    expect(classifyFetch(200, 'video/mp4', 1024 * 1024 * 1024 + 1)).toBe('too-large');
    expect(classifyFetch(200, 'video/mp4', 1024)).toBeNull();

    const fetch = jest.fn(async () => ({
      status: 200,
      headers: { get: (name: string) => (name === 'content-type' ? 'video/mp4' : name === 'content-length' ? '1024' : null) },
      body: null,
    }));
    const ok = await inspectPartnerVideo('https://gta6clips.app/clip.mp4', {
      resolve: async () => ['1.1.1.1'],
      fetch,
    });
    expect(ok).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://gta6clips.app/clip.mp4',
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' })
    );
  });
});
