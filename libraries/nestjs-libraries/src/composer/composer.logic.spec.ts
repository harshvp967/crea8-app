import {
  clockPeriod,
  composerDateLabel,
  composerTimeLabel,
  hour24FromChoice,
  hour24WithPeriod,
  hourChoices,
  wallClockString,
} from '@gitroom/frontend/components/launches/helpers/date.picker.time';
import {
  sheetDragOffset,
  sheetShouldClose,
} from '@gitroom/frontend/components/launches/helpers/sheet.swipe';
import {
  persistedThreadValues,
  previewThreadValues,
} from '@gitroom/frontend/components/new-launch/preview.thread';
import {
  editorHtmlAfterMount,
  isEmptyEditorHtml,
} from '@gitroom/frontend/components/new-launch/editor.persist';
import {
  consumeComposerHandoff,
  consumeComposerRestored,
  draftSnapshot,
  resetComposerHandoffForTests,
  stashComposerHandoff,
} from '@gitroom/frontend/components/new-launch/composer.draft';
import { seedInternalValue } from '@gitroom/frontend/components/new-launch/existing.post';

describe('composer sheet swipe', () => {
  it('closes after a long drag or a fast flick, and snaps back otherwise', () => {
    expect(sheetDragOffset(100, 80)).toBe(0);
    expect(sheetDragOffset(100, 140)).toBe(40);
    expect(sheetShouldClose(0, 100)).toBe(false);
    expect(sheetShouldClose(40, 400)).toBe(false);
    expect(sheetShouldClose(80, 400)).toBe(true);
    expect(sheetShouldClose(40, 40)).toBe(true);
  });
});

describe('composer time picker', () => {
  const wall = {
    format: (pattern: string) =>
      pattern === 'YYYY-MM-DD' ? '2026-10-16' : pattern,
  };

  it('keeps the picked hour and minute on the wall clock that gets saved', () => {
    expect(wallClockString(wall, 19, 5)).toBe('2026-10-16 19:05:00');
    expect(hour24FromChoice(7, 'PM', true)).toBe(19);
    expect(hour24FromChoice(12, 'AM', true)).toBe(0);
    expect(hour24FromChoice(12, 'PM', true)).toBe(12);
    expect(hour24WithPeriod(19, 'AM')).toBe(7);
    expect(clockPeriod(19)).toBe('PM');
    expect(clockPeriod(0)).toBe('AM');
  });

  it('marks the selected hour and follows 12-hour or 24-hour labels', () => {
    const twelve = hourChoices(19, true);
    expect(twelve.find((hour) => hour.selected)?.label).toBe('7');
    expect(twelve).toHaveLength(12);
    const day = hourChoices(19, false);
    expect(day.find((hour) => hour.selected)?.label).toBe('19');
    expect(day).toHaveLength(24);
    expect(composerDateLabel(wall, true)).toBe('ddd, MMM D · h:mm A');
    expect(composerTimeLabel(wall, false)).toBe('HH:mm');
    expect(composerDateLabel(wall, false)).toBe('ddd, D MMM · HH:mm');
  });
});

describe('composer preview thread', () => {
  const text = (content: string, added?: boolean) => ({
    content,
    media: [] as { id: string; path: string }[],
    ...(added ? { added: true } : {}),
  });

  it('hides a trailing blank that was not added as a thread item', () => {
    expect(
      previewThreadValues([
        text('<p>Nimbus note</p>'),
        text('<p></p>'),
        text(''),
      ]).map((item) => item.content)
    ).toEqual(['<p>Nimbus note</p>']);
  });

  it('keeps a trailing blank the user added, and an image-only item', () => {
    const added = previewThreadValues([
      text('<p>Nimbus note</p>'),
      text('<p><br></p>', true),
    ]);
    expect(added).toHaveLength(2);

    const withPicture = previewThreadValues([
      text('<p>Nimbus note</p>'),
      { content: '', media: [{ id: 'm', path: '/a.png' }] },
    ]);
    expect(withPicture).toHaveLength(2);
  });

  it('does not save trailing blanks, including ones the user left empty', () => {
    expect(
      persistedThreadValues([
        text('<p>Nimbus note</p>'),
        text('', true),
        { content: '<p></p>', image: [{ id: 'm', path: '/a.png' }] },
      ])
    ).toHaveLength(3);

    expect(
      persistedThreadValues([
        text('<p>Nimbus note</p>'),
        text('<p></p>', true),
      ])
    ).toHaveLength(1);
  });
});

describe('composer editor remount', () => {
  it('keeps stored text when a remount reports an empty document', () => {
    expect(isEmptyEditorHtml('<p></p>')).toBe(true);
    expect(isEmptyEditorHtml('<p>hello</p>')).toBe(false);
    expect(editorHtmlAfterMount('<p>hello</p>', '<p></p>', false)).toBe(
      '<p>hello</p>'
    );
    expect(editorHtmlAfterMount('<p>hello</p>', '<p></p>', true)).toBe(
      '<p></p>'
    );
    expect(editorHtmlAfterMount('<p>hello</p>', '<p>hello!</p>', false)).toBe(
      '<p>hello!</p>'
    );
  });

  it('restores a draft only when the composer remounts immediately', () => {
    resetComposerHandoffForTests();
    stashComposerHandoff(
      draftSnapshot({
        global: [{ content: '<p>kept</p>' }],
        setDate: (): void => undefined,
      }),
      1_000
    );
    expect(consumeComposerHandoff(1_050)).toEqual({
      global: [{ content: '<p>kept</p>' }],
    });
    expect(consumeComposerRestored()).toBe(true);

    stashComposerHandoff({ global: [{ content: '<p>old</p>' }] }, 1_000);
    expect(consumeComposerHandoff(1_500)).toBeNull();
    expect(consumeComposerRestored()).toBe(false);
    resetComposerHandoffForTests();
  });

  it('replaces a channel thread instead of stacking a second empty post', () => {
    const selected = { integration: { id: 'bluesky-1' } };
    const first = seedInternalValue(
      { internal: [], selectedIntegrations: [selected] },
      'bluesky-1',
      [{ id: 'p1', content: '<p>Nimbus</p>', delay: 0, media: [] }]
    );
    const second = seedInternalValue(
      {
        internal: first.internal!,
        selectedIntegrations: [selected],
      },
      'bluesky-1',
      [{ id: 'p1', content: '<p>Nimbus</p>', delay: 0, media: [] }]
    );
    expect(second.internal?.[0].integrationValue).toHaveLength(1);
  });
});
