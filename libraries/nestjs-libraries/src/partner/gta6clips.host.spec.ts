import {
  classifyPartnerUrl,
  fetchAllowlisted,
  isPartnerVideoUrl,
} from '@gitroom/nestjs-libraries/partner/gta6clips.host';

const resolvePublic = async () => ['1.1.1.1'];

describe('gta6clips host allowlist', () => {
  it('accepts https on gta6clips.app', async () => {
    await expect(
      classifyPartnerUrl('https://gta6clips.app/clip.mp4?exp=1', { resolve: resolvePublic })
    ).resolves.toEqual({ ok: true, hostname: 'gta6clips.app' });
    expect(isPartnerVideoUrl('https://gta6clips.app/clip.mp4')).toBe(true);
  });

  it('rejects other hosts, http, and private addresses', async () => {
    await expect(
      classifyPartnerUrl('https://evil.example/clip.mp4', { resolve: resolvePublic })
    ).resolves.toMatchObject({ ok: false, reason: 'host' });
    await expect(
      classifyPartnerUrl('http://gta6clips.app/clip.mp4', { resolve: resolvePublic })
    ).resolves.toMatchObject({ ok: false, reason: 'https' });
    await expect(
      classifyPartnerUrl('https://gta6clips.app/clip.mp4', { resolve: async () => ['10.1.1.1'] })
    ).resolves.toMatchObject({ ok: false, reason: 'address' });
    await expect(
      classifyPartnerUrl('https://gta6clips.app/clip.mp4', { resolve: async () => ['169.254.1.1'] })
    ).resolves.toMatchObject({ ok: false, reason: 'address' });
    await expect(
      classifyPartnerUrl('https://gta6clips.app/clip.mp4', { resolve: async () => ['127.0.0.1'] })
    ).resolves.toMatchObject({ ok: false, reason: 'address' });
  });

  it('rejects a redirect that leaves the allowlist', async () => {
    const fetch = jest.fn(async (url: string) => {
      if (url.startsWith('https://gta6clips.app/start')) {
        return {
          status: 302,
          headers: { get: (name: string) => (name === 'location' ? 'https://evil.example/clip.mp4' : null) },
        };
      }
      return { status: 200, headers: { get: (_name: string): string | null => null } };
    });
    await expect(
      fetchAllowlisted('https://gta6clips.app/start', { method: 'GET' }, { resolve: resolvePublic, fetch })
    ).rejects.toThrow('host');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
