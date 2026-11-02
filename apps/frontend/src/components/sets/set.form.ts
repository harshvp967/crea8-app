// A set is reusable content. It is not scheduled, so the composer must not
// offer a date or a repeat control. A post composer still does.
export function setComposerChrome(editing: boolean) {
  return {
    title: editing ? 'Edit set' : 'New set',
    showDate: false,
    showRepeat: false,
  };
}

export function postComposerChrome() {
  return {
    title: 'Create Post',
    showDate: true,
    showRepeat: true,
  };
}
