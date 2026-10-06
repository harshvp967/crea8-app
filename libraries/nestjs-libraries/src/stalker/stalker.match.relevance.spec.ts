import { matchRelevance } from '@gitroom/nestjs-libraries/stalker/stalker.match';

describe('matchRelevance', () => {
  it('is relevant for keyword matches and linked keywords', () => {
    expect(matchRelevance({ text: 'x', matchKind: 'KEYWORD' }, [])).toBe(true);
    expect(matchRelevance({ text: 'x', matchKind: null, keywordId: 'k' }, [])).toBe(true);
  });
  it('is relevant when the text contains an active keyword phrase (whole word)', () => {
    expect(matchRelevance({ text: 'Try Canva today', matchKind: null }, ['canva'])).toBe(true);
    expect(matchRelevance({ text: 'canvas bag', matchKind: null }, ['canva'])).toBe(false);
  });
  it('leaves brand matches to the AI gate and drops unmatched rows', () => {
    expect(matchRelevance({ text: 'brand', matchKind: 'BRAND' }, [])).toBeNull();
    expect(matchRelevance({ text: 'random', matchKind: null }, [])).toBe(false);
  });
});
