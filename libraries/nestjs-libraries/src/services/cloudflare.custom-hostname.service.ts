import { Injectable } from '@nestjs/common';
import { domainRecords, mapHostnameStatus } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

type HostnameResult =
  | { available: false }
  | {
      available: true;
      ok: boolean;
      id: string;
      status: 'WAITING' | 'VERIFYING' | 'LIVE' | 'ERROR';
      error: string;
      txtName: string;
      txtValue: string;
      records: ReturnType<typeof domainRecords>;
    };

@Injectable()
export class CloudflareCustomHostnameService {
  configured() {
    return !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
  }

  cnameTarget() {
    return (process.env.CLOUDFLARE_CNAME_TARGET || 'cname.crea8.one').trim();
  }

  async create(hostname: string): Promise<HostnameResult> {
    const result = await this.request('/custom_hostnames', {
      method: 'POST',
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: { min_tls_version: '1.2' },
        },
      }),
    });
    return this.read(hostname, result);
  }

  async get(hostname: string, id: string): Promise<HostnameResult> {
    return this.read(hostname, await this.request(`/custom_hostnames/${id}`, { method: 'GET' }));
  }

  async remove(id: string) {
    if (!this.configured()) {
      return { available: false as const, ok: false };
    }
    const result = await this.request(`/custom_hostnames/${id}`, { method: 'DELETE' });
    if (!result.available) {
      return { available: false as const, ok: false };
    }
    return { available: true as const, ok: result.ok || result.status === 404 };
  }

  private read(
    hostname: string,
    result: Awaited<ReturnType<CloudflareCustomHostnameService['request']>>
  ): HostnameResult {
    if (!result.available) {
      return { available: false };
    }
    const record = result.body?.result || {};
    const verification = record.ownership_verification || {};
    const id = String(record.id || '');
    const txtName = String(verification.name || (id ? '_crea8' : ''));
    const txtValue = String(verification.value || (id ? `crea8-verify=${id.slice(0, 12)}` : ''));
    const status = result.ok
      ? mapHostnameStatus({ status: record.status, sslStatus: record.ssl?.status })
      : 'ERROR';
    return {
      available: true,
      ok: result.ok && !!id,
      id,
      status,
      error: result.ok ? '' : this.errorMessage(result.body),
      txtName,
      txtValue,
      records: domainRecords({
        hostname,
        cnameTarget: this.cnameTarget(),
        txtName,
        txtValue,
      }),
    };
  }

  private errorMessage(body: { errors?: Array<{ message?: string }> } | null) {
    return body?.errors?.[0]?.message || 'Cloudflare could not update this domain';
  }

  private async request(path: string, init: RequestInit) {
    if (!this.configured()) {
      return { available: false as const };
    }
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const body = (await response.json().catch(() => null)) as {
        result?: {
          id?: string;
          status?: string;
          ssl?: { status?: string };
          ownership_verification?: { name?: string; value?: string };
        };
        errors?: Array<{ message?: string }>;
      } | null;
      return { available: true as const, ok: response.ok, status: response.status, body };
    } catch {
      return {
        available: true as const,
        ok: false,
        status: 0,
        body: { errors: [{ message: 'Cloudflare could not be reached' }] },
      };
    }
  }
}
