export type ThreadItem = {
  content?: unknown;
  media?: unknown;
  image?: unknown;
  /** The user pressed add-thread. An empty card they added stays in the preview. */
  added?: boolean;
};

export function threadText(content: unknown) {
  const text = typeof content === 'string' ? content : '';
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

export function threadItemHasBody(item: ThreadItem | null | undefined) {
  if (!item) {
    return false;
  }
  const content = typeof item.content === 'string' ? item.content : '';
  if (/<img\b/i.test(content)) {
    return true;
  }
  if (threadText(content)) {
    return true;
  }
  const media = Array.isArray(item.media)
    ? item.media
    : Array.isArray(item.image)
    ? item.image
    : [];
  return media.length > 0;
}

/**
 * Preview drops trailing blanks the same way save does, including a blank
 * the user added and left empty. An image-only item stays. The first item stays.
 */
export function previewThreadValues<T extends ThreadItem>(values: T[] | null | undefined): T[] {
  return persistedThreadValues(values);
}

/**
 * Save drops trailing blanks, including ones the user added and left empty.
 * An image-only item is kept. The first item stays so an empty draft still
 * reaches validation.
 */
export function persistedThreadValues<T extends ThreadItem>(values: T[] | null | undefined): T[] {
  const list = Array.isArray(values) ? values : [];
  let end = list.length;
  while (end > 1 && !threadItemHasBody(list[end - 1])) {
    end -= 1;
  }
  return list.slice(0, end);
}
