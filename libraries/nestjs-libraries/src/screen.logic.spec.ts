import { creditCapacity } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { newAlertDraft } from '@gitroom/frontend/components/stalker/alert.form';
import {
  postComposerChrome,
  setComposerChrome,
} from '@gitroom/frontend/components/sets/set.form';
import { confirmPhraseMatches } from '@gitroom/frontend/components/settings/delete.confirm';

describe('account menu credit capacity', () => {
  it('uses the same plan-plus-pack total as the billing card', () => {
    const allowance = 1800;
    const packCredits = 650;
    const menu = creditCapacity(allowance, packCredits);
    const billing = creditCapacity(allowance, packCredits);
    expect(menu).toBe(billing);
    expect(menu).toBe(2450);
    expect(menu).not.toBe(allowance);
  });
});

describe('new alert form', () => {
  it('starts empty and saves as Save', () => {
    const draft = newAlertDraft();
    expect(draft.name).toBe('');
    expect(draft.name).not.toBe('Negative X posts with traction');
    expect(draft.saveLabel).toBe('Save');
    expect(draft.saveLabel).not.toBe('New alert');
  });
});

describe('set form', () => {
  it('is not a dated post composer', () => {
    const created = setComposerChrome(false);
    expect(created.title).toBe('New set');
    expect(created.showDate).toBe(false);
    expect(created.showRepeat).toBe(false);
    const post = postComposerChrome();
    expect(post.showDate).toBe(true);
    expect(post.showRepeat).toBe(true);
  });
});

describe('delete account confirmation', () => {
  it('does not accept a click until the phrase is typed', () => {
    expect(confirmPhraseMatches('', 'delete')).toBe(false);
    expect(confirmPhraseMatches('Delete', 'delete')).toBe(true);
  });
});
