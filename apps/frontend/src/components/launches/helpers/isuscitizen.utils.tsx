export const CLOCK_PREFERENCE_EVENT = 'crea8-clock-preference';

export const isUSCitizen = () => {
  const userLanguage = localStorage.getItem('isUS') || ((navigator.language || navigator.languages[0]).startsWith('en-US') ? 'US' : 'GLOBAL');
  return userLanguage === 'US';
};

/** Same-tab listeners do not receive the native `storage` event. */
export function publishClockPreference(value: 'US' | 'GLOBAL') {
  localStorage.setItem('isUS', value);
  window.dispatchEvent(new Event(CLOCK_PREFERENCE_EVENT));
}
