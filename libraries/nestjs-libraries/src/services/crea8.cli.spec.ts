import { spawnSync } from 'child_process';
import path from 'path';

const cli = path.resolve(__dirname, '../../../../skills/crea8one-agent/bin/crea8.mjs');

function run(env: Record<string, string | undefined>, args: string[] = ['--help']) {
  return spawnSync(process.execPath, [cli, ...args], {
    env: { PATH: process.env.PATH, ...env } as unknown as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });
}

describe('crea8 CLI API key', () => {
  it('requires CREA8_API_KEY and names the deprecated fallback', () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CREA8_API_KEY is not set');
    expect(result.stderr).toContain('CRE8_API_KEY is a deprecated fallback');
    expect(result.stdout).toBe('');
  });

  it('reads CREA8_API_KEY without a deprecation warning', () => {
    const result = run({ CREA8_API_KEY: 'test-key' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Set CREA8_API_KEY');
    expect(result.stdout).toContain('CRE8_API_KEY still works but is deprecated');
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('test-key');
  });

  it('accepts CRE8_API_KEY as a deprecated fallback', () => {
    const result = run({ CRE8_API_KEY: 'legacy-key' });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('CRE8_API_KEY is deprecated. Set CREA8_API_KEY.');
    expect(result.stdout).toContain('crea8 — crea8.one agent CLI');
    expect(result.stderr).not.toContain('legacy-key');
    expect(result.stdout).not.toContain('legacy-key');
  });

  it('prefers CREA8_API_KEY when both are set', () => {
    const result = run({ CREA8_API_KEY: 'test-key', CRE8_API_KEY: 'legacy-key' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });
});
