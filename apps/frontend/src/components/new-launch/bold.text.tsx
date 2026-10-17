'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
const originalMap = {
  a: '𝗮',
  b: '𝗯',
  c: '𝗰',
  d: '𝗱',
  e: '𝗲',
  f: '𝗳',
  g: '𝗴',
  h: '𝗵',
  i: '𝗶',
  j: '𝗷',
  k: '𝗸',
  l: '𝗹',
  m: '𝗺',
  n: '𝗻',
  o: '𝗼',
  p: '𝗽',
  q: '𝗾',
  r: '𝗿',
  s: '𝘀',
  t: '𝘁',
  u: '𝘂',
  v: '𝘃',
  w: '𝘄',
  x: '𝘅',
  y: '𝘆',
  z: '𝘇',
  A: '𝗔',
  B: '𝗕',
  C: '𝗖',
  D: '𝗗',
  E: '𝗘',
  F: '𝗙',
  G: '𝗚',
  H: '𝗛',
  I: '𝗜',
  J: '𝗝',
  K: '𝗞',
  L: '𝗟',
  M: '𝗠',
  N: '𝗡',
  O: '𝗢',
  P: '𝗣',
  Q: '𝗤',
  R: '𝗥',
  S: '𝗦',
  T: '𝗧',
  U: '𝗨',
  V: '𝗩',
  W: '𝗪',
  X: '𝗫',
  Y: '𝗬',
  Z: '𝗭',
  '1': '𝟭',
  '2': '𝟮',
  '3': '𝟯',
  '4': '𝟰',
  '5': '𝟱',
  '6': '𝟲',
  '7': '𝟳',
  '8': '𝟴',
  '9': '𝟵',
  '0': '𝟬',
};
const reverseMap = Object.fromEntries(
  Object.entries(originalMap).map(([key, value]) => [value, key])
);
export const useEditorMarkActive = (editor: any, markName: string) => {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!editor?.on) {
      setActive(false);
      return;
    }
    const update = () => setActive(!!editor.isActive?.(markName));
    update();
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor, markName]);
  return active;
};
export const BoldText: FC<{
  editor: any;
  currentValue: string;
}> = ({ editor }) => {
  const active = useEditorMarkActive(editor, 'bold');
  const mark = () => {
    editor?.commands?.unsetUnderline();
    editor?.commands?.toggleBold();
    editor?.commands?.focus();
  };
  return (
    <button
      type="button"
      data-tooltip-id="tooltip"
      data-tooltip-content="Bold"
      aria-label="Bold"
      aria-pressed={active}
      onClick={mark}
      className={clsx(
        'c8-tool select-none cursor-pointer rounded-[6px] flex justify-center items-center',
        active && 'is-active'
      )}
    >
      <HugeIcon name="bold" size={18} />
    </button>
  );
};
