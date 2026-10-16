// Turns a saved post into editor values without throwing when a field is
// missing or the wrong shape. The calendar edit path used to call
// `post.content.split` and `selectedIntegrations.find(...)!.integration`
// while the channel was not selected yet.

export type EditorMedia = { id: string; path: string; thumbnail?: string };

export type EditorValue = {
  id: string;
  content: string;
  delay: number;
  media: EditorMedia[];
};

type SavedPost = {
  id?: string;
  content?: unknown;
  delay?: number | null;
  image?: unknown;
  tags?: unknown;
  intervalInDays?: number | null;
  publishDate?: unknown;
  state?: unknown;
};

type SavedTag = {
  tag?: { name?: string | null } | null;
};

export function editorHtml(content: unknown) {
  const text = typeof content === 'string' ? content : '';
  if (/<p[\s>]/i.test(text)) {
    return text;
  }

  return text
    .split('\n')
    .map((line) => `<p>${line}</p>`)
    .join('');
}

export function editorMedia(image: unknown): EditorMedia[] {
  if (!Array.isArray(image)) {
    return [];
  }

  return image.filter(
    (item): item is EditorMedia => !!item && typeof item === 'object'
  );
}

export function editorSettings(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }

  return settings as Record<string, unknown>;
}

export function editorTags(posts: unknown) {
  const tags = (Array.isArray(posts) ? posts[0] : undefined) as
    | { tags?: unknown }
    | undefined;
  if (!Array.isArray(tags?.tags)) {
    return [] as { label: string; value: string }[];
  }

  return (tags.tags as SavedTag[]).flatMap((row) => {
    const name = row?.tag?.name;
    if (!name) {
      return [];
    }

    return [{ label: name, value: name }];
  });
}

export function editorValuesFromPosts(
  posts: unknown,
  fallbackId: () => string
): EditorValue[] {
  if (!Array.isArray(posts)) {
    return [];
  }

  return (posts as SavedPost[]).map((post) => ({
    delay: typeof post?.delay === 'number' ? post.delay : 0,
    content: editorHtml(post?.content),
    id: post?.id || fallbackId(),
    media: editorMedia(post?.image),
  }));
}

export function siblingPublishDate(sibling: { posts?: SavedPost[] } | null | undefined) {
  const date = sibling?.posts?.[0]?.publishDate;
  return typeof date === 'string' || date instanceof Date ? date : undefined;
}

export function parseAdditionalSettings(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : parsed ?? [];
  } catch {
    return [];
  }
}

type SelectedRow = {
  integration?: { id?: string } | null;
};

type InternalRow = {
  integration?: { id?: string } | null;
  integrationValue: EditorValue[];
};

// Inserts thread values for one channel. Returns the state unchanged when that
// channel is not selected, instead of reading `.integration` off undefined.
export function attachInternalValue<
  T extends {
    internal: InternalRow[];
    selectedIntegrations: SelectedRow[];
  }
>(state: T, index: number, integrationId: string, value: EditorValue[]): Partial<T> {
  const integrationIndex = state.internal.findIndex(
    (item) => item.integration?.id === integrationId
  );

  if (integrationIndex === -1) {
    const selected = state.selectedIntegrations.find(
      (item) => item.integration?.id === integrationId
    );
    if (!selected?.integration) {
      return {};
    }

    return {
      internal: [
        ...state.internal,
        {
          integration: selected.integration,
          integrationValue: value,
        },
      ],
    } as Partial<T>;
  }

  const updated = state.internal[integrationIndex];
  const newValues = (updated.integrationValue || []).reduce((acc, item, itemIndex) => {
    acc.push(item);
    if (itemIndex === index) {
      acc.push(...value);
    }
    return acc;
  }, [] as EditorValue[]);

  return {
    internal: state.internal.map((item, itemIndex) =>
      itemIndex === integrationIndex
        ? { ...item, integrationValue: newValues }
        : item
    ),
  } as Partial<T>;
}
