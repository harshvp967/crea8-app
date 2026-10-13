import { HttpException } from '@nestjs/common';
import { getAuth } from '@gitroom/nestjs-libraries/chat/async.storage';

export const checkAuth = (
  inputData: any,
  context: any
) => {
  const auth = getAuth();
  const authInfo = context?.mcp?.extra?.authInfo || auth;
  if (authInfo && context?.requestContext) {
    (context.requestContext as any).set(
      'organization',
      JSON.stringify(authInfo)
    );
    (context.requestContext as any).set('ui', 'false');
  }
};

export type ToolOrganization = {
  id: string;
  subscription?: {
    subscriptionTier?: string | null;
    isLifetime?: boolean | null;
    deletedAt?: Date | null;
  } | null;
};

export const organizationFromTool = (
  inputData: any,
  context: any
): ToolOrganization => {
  checkAuth(inputData, context);
  const raw = (context?.requestContext as any)?.get('organization');
  if (!raw || typeof raw !== 'string') {
    throw new Error('Missing organization');
  }
  return JSON.parse(raw);
};

export const toolFailure = (err: unknown) => {
  if (!(err instanceof HttpException)) {
    return undefined;
  }
  const response = err.getResponse();
  const message =
    typeof response === 'string'
      ? response
      : Array.isArray((response as { message?: unknown })?.message)
        ? ((response as { message: string[] }).message || []).join(', ')
        : (response as { message?: string })?.message || err.message;
  return { output: { error: String(message) } };
};
