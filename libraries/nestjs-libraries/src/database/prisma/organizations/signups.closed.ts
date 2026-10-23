export const SIGNUPS_CLOSED_MESSAGE = 'Sign-ups are closed';

export function signupsClosed(): never {
  throw new Error(SIGNUPS_CLOSED_MESSAGE);
}
