import {
  attachInternalValue,
  editorHtml,
  editorMedia,
  editorSettings,
  editorTags,
  editorValuesFromPosts,
  parseAdditionalSettings,
  siblingPublishDate,
} from '@gitroom/frontend/components/new-launch/existing.post';

// Opening a calendar post used to throw before the composer painted:
//
// TypeError: Cannot read properties of undefined (reading 'integration')
//     at addInternalValue (apps/frontend/src/components/new-launch/store.ts)
//     at AddEditModalInnerInner (apps/frontend/src/components/new-launch/add.edit.modal.tsx)
//
// The editor effect calls addInternalValue as soon as the modal's child mounts.
// That child mounts while selectedIntegrations still holds a different channel
// (a previous composer that did not reset, or this effect running before the
// edit effect selects the post's channel). find() is undefined, and `!.integration`
// throws. The page becomes "Application error: a client-side exception has occurred".
// The same open also threw on null settings (`Object.keys`), null content
// (`.split`), a non-array image (`.map is not a function`), a deleted tag
// (`.name`), and an empty sibling thread (`.publishDate`).

const channel = (id: string) => ({ integration: { id } });

describe('existing post editor hydration', () => {
  it('does not throw when the post channel is not selected yet', () => {
    const state = {
      internal: [] as {
        integration?: { id?: string } | null;
        integrationValue: {
          id: string;
          content: string;
          delay: number;
          media: { id: string; path: string }[];
        }[];
      }[],
      selectedIntegrations: [channel('other-channel')],
    };

    expect(() =>
      attachInternalValue(state, 0, 'missing-channel', [
        { id: 'p1', content: '<p>hi</p>', delay: 0, media: [] },
      ])
    ).not.toThrow();

    expect(
      attachInternalValue(state, 0, 'missing-channel', [
        { id: 'p1', content: '<p>hi</p>', delay: 0, media: [] },
      ])
    ).toEqual({});
    expect(state.internal).toEqual([]);
  });

  it('attaches the thread once the channel is selected', () => {
    const selected = channel('x-1');
    const next = attachInternalValue(
      { internal: [], selectedIntegrations: [selected] },
      0,
      'x-1',
      [{ id: 'p1', content: '<p>hi</p>', delay: 0, media: [] }]
    );

    expect(next.internal).toEqual([
      {
        integration: selected.integration,
        integrationValue: [{ id: 'p1', content: '<p>hi</p>', delay: 0, media: [] }],
      },
    ]);
  });

  it('keeps null content, object media, and a deleted tag from crashing', () => {
    expect(editorHtml(null)).toBe('<p></p>');
    expect(editorHtml(undefined)).toBe('<p></p>');
    expect(editorHtml('a\nb')).toBe('<p>a</p><p>b</p>');
    expect(editorHtml('<p>kept</p>')).toBe('<p>kept</p>');

    expect(editorMedia({})).toEqual([]);
    expect(editorMedia(null)).toEqual([]);
    expect(editorMedia([{ id: 'm1', path: '/a.png' }, null])).toEqual([
      { id: 'm1', path: '/a.png' },
    ]);

    expect(editorSettings(null)).toEqual({});
    expect(editorSettings(undefined)).toEqual({});
    expect(editorSettings('null')).toEqual({});
    expect(editorSettings({ who_can_reply_post: 'everyone' })).toEqual({
      who_can_reply_post: 'everyone',
    });

    const values = editorValuesFromPosts(
      [
        { id: 'post-1', content: null, image: { id: 'm', path: '/a.png' }, delay: 2 },
        { content: 'second' },
      ],
      () => 'generated'
    );
    expect(values[0]).toEqual({
      id: 'post-1',
      content: '<p></p>',
      delay: 2,
      media: [],
    });
    expect(values[1].id).toBe('generated');
    expect(values[1].content).toBe('<p>second</p>');

    expect(
      editorTags([{ tags: [{ tag: null }, { tag: { name: 'launch' } }] }])
    ).toEqual([{ label: 'launch', value: 'launch' }]);
    expect(editorTags([])).toEqual([]);
    expect(editorTags(undefined)).toEqual([]);
  });

  it('skips a sibling that has no posts and ignores a broken license-style settings blob', () => {
    expect(siblingPublishDate({ posts: [] })).toBeUndefined();
    expect(siblingPublishDate(undefined)).toBeUndefined();
    expect(siblingPublishDate({ posts: [{ publishDate: '2026-10-16T12:00:00.000Z' }] })).toBe(
      '2026-10-16T12:00:00.000Z'
    );

    expect(parseAdditionalSettings('{')).toEqual([]);
    expect(parseAdditionalSettings(null)).toEqual([]);
    expect(parseAdditionalSettings('null')).toEqual([]);
    expect(parseAdditionalSettings('[{"id":"a"}]')).toEqual([{ id: 'a' }]);
    expect(parseAdditionalSettings([{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });
});
