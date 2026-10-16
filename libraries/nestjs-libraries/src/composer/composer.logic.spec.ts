import {
  composerDateLabel,
  composerTimeLabel,
  resolveWallClock,
} from '@gitroom/frontend/components/launches/helpers/date.picker.time';
import {
  releaseVelocity,
  sheetDragOffset,
  sheetShouldClose,
} from '@gitroom/frontend/components/launches/helpers/sheet.swipe';
import {
  persistedThreadValues,
  previewThreadValues,
} from '@gitroom/frontend/components/new-launch/preview.thread';
import {
  editorContentForValue,
  editorHtmlAfterMount,
  isEmptyEditorHtml,
} from '@gitroom/frontend/components/new-launch/editor.persist';
import {
  composerDraftKey,
  consumeComposerHandoff,
  consumeComposerRestored,
  draftSnapshot,
  markComposerLayoutRemount,
  resetComposerHandoffForTests,
  stashComposerHandoff,
} from '@gitroom/frontend/components/new-launch/composer.draft';
import { seedInternalValue } from '@gitroom/frontend/components/new-launch/existing.post';

describe('composer sheet swipe', () => {
  it('closes after a long drag or a fast flick at release, and snaps back otherwise', () => {
    expect(sheetDragOffset(100, 80)).toBe(0);
    expect(sheetDragOffset(100, 140)).toBe(40);
    expect(sheetShouldClose(0, 2)).toBe(false);
    expect(sheetShouldClose(40, 0.1)).toBe(false);
    expect(sheetShouldClose(80, 0)).toBe(true);
    expect(sheetShouldClose(40, 0.55)).toBe(true);

    const flicked = releaseVelocity([
      { y: 0, time: 0 },
      { y: 20, time: 400 },
      { y: 20, time: 500 },
      { y: 60, time: 540 },
    ]);
    expect(flicked).toBeGreaterThan(0.55);
    expect(sheetShouldClose(40, flicked)).toBe(true);

    const slowed = releaseVelocity([
      { y: 0, time: 0 },
      { y: 50, time: 30 },
      { y: 50, time: 200 },
      { y: 58, time: 500 },
    ]);
    expect(slowed).toBeLessThan(0.55);
    expect(sheetShouldClose(58, slowed)).toBe(false);
  });
});

describe('composer time picker', () => {
  const wall = {
    format: (pattern: string) =>
      pattern === 'YYYY-MM-DD' ? '2026-10-16' : pattern,
  };

  it('follows 12-hour or 24-hour labels', () => {
    expect(composerDateLabel(wall, true)).toBe('ddd, MMM D · h:mm A');
    expect(composerTimeLabel(wall, false)).toBe('HH:mm');
    expect(composerDateLabel(wall, false)).toBe('ddd, D MMM · HH:mm');
  });

  it('moves a spring-forward gap to the next real wall time once', () => {
    expect(resolveWallClock('2026-03-08', 2, 30, 0, 'America/New_York')).toEqual({
      wall: '2026-03-08 03:30:00',
      shifted: true,
    });
    expect(resolveWallClock('2026-03-08', 3, 30, 0, 'America/New_York')).toEqual({
      wall: '2026-03-08 03:30:00',
      shifted: false,
    });
    expect(resolveWallClock('2026-10-16', 19, 5, 0, 'America/New_York')).toEqual({
      wall: '2026-10-16 19:05:00',
      shifted: false,
    });
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

  it('drops a trailing blank the user added, and keeps an image-only item', () => {
    const added = previewThreadValues([
      text('<p>Nimbus note</p>'),
      text('<p><br></p>', true),
    ]);
    expect(added).toHaveLength(1);

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
    expect(editorContentForValue('<p>hello</p>', '', '<p>hello</p>')).toBe('');
    expect(editorContentForValue('<p>hello</p>', '<p>replaced</p>', '<p>hello</p>')).toBe(
      '<p>replaced</p>'
    );
    expect(editorContentForValue('<p>hello</p>', '<p>hello</p>', '<p>hello</p>')).toBe(
      null
    );
  });

  it('restores a draft only for the same post after a layout remount', () => {
    resetComposerHandoffForTests();
    expect(composerDraftKey(undefined)).toBe('new');
    expect(composerDraftKey(' post-1 ')).toBe('post-1');

    const snapshot = draftSnapshot({
      global: [{ content: '<p>kept</p>' }],
      setDate: (): void => undefined,
    });
    stashComposerHandoff('post-1', snapshot, 1_000);
    expect(consumeComposerHandoff('post-1', 1_050)).toBeNull();
    expect(consumeComposerRestored('post-1')).toBe(false);

    markComposerLayoutRemount(1_000);
    stashComposerHandoff('post-1', snapshot, 1_050);
    expect(consumeComposerHandoff('new', 1_060)).toBeNull();
    expect(consumeComposerRestored('new')).toBe(false);

    markComposerLayoutRemount(2_000);
    stashComposerHandoff('post-1', snapshot, 2_050);
    expect(consumeComposerHandoff('post-1', 2_060)).toEqual({
      global: [{ content: '<p>kept</p>' }],
    });
    expect(consumeComposerRestored('post-1')).toBe(true);
    expect(consumeComposerRestored('post-1')).toBe(false);

    markComposerLayoutRemount(3_000);
    stashComposerHandoff('post-1', snapshot, 3_010);
    expect(consumeComposerHandoff('post-1', 3_500)).toBeNull();
    expect(consumeComposerRestored('post-1')).toBe(false);
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
