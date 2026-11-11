export const API_KEY_MASK = '••••••••••••••••';

// The concealed value is a fixed mask. It must not contain any character from
// the secret, so the key stays out of the DOM until Reveal.
export function visibleSecret(secret: string, revealed: boolean) {
  if (revealed && secret) {
    return secret;
  }
  return API_KEY_MASK;
}

export function configWithoutSecret(config: string, secret: string, revealed: boolean) {
  if (revealed || !secret) {
    return config;
  }
  return config.split(secret).join(API_KEY_MASK);
}
