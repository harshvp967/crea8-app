export function confirmPhraseMatches(typed: string, phrase: string) {
  const expected = phrase.trim().toLowerCase();
  if (!expected) {
    return true;
  }
  return typed.trim().toLowerCase() === expected;
}
