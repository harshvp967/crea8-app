import { threadText } from '@gitroom/frontend/components/new-launch/preview.thread';

/** Empty TipTap documents (`<p></p>`, `<p><br></p>`) carry no post text. */
export function isEmptyEditorHtml(html: unknown) {
  const text = typeof html === 'string' ? html : '';
  if (/<img\b/i.test(text)) {
    return false;
  }
  return threadText(text).length === 0;
}

/**
 * A remount can report an empty document before the stored post is applied.
 * Keep the stored HTML unless the user cleared the field themselves.
 */
export function editorHtmlAfterMount(
  stored: string,
  reported: string,
  userCleared: boolean
) {
  if (userCleared) {
    return reported;
  }
  if (isEmptyEditorHtml(reported) && !isEmptyEditorHtml(stored)) {
    return stored;
  }
  return reported;
}

/**
 * What to write into the editor after `value` changes.
 * `null` leaves the document alone (the editor just emitted that HTML).
 * A string is applied as-is, including '' from a delete, a channel switch,
 * or an AI replace. An empty external value is never filled back in.
 */
export function editorContentForValue(
  editorHtml: string,
  value: string,
  lastEmitted: string | null
) {
  if (value === lastEmitted) {
    return null;
  }
  if (editorHtml === value) {
    return null;
  }
  return value;
}
