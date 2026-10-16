'use client';

import { RefObject, useEffect, useRef } from 'react';
import { sheetDragOffset, sheetShouldClose } from '@gitroom/frontend/components/launches/helpers/sheet.swipe';

/**
 * Drag the `.arc-grab` handle downward to close a sheet.
 * The sheet follows the finger with a translate, then snaps back when the
 * drag is too short and too slow. No stylesheet changes: the transform is
 * inline and cleared when the gesture ends.
 */
export function useGrabToClose(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const root = ref.current;
    const handle = root?.querySelector<HTMLElement>('.arc-grab');
    if (!root || !handle) {
      return;
    }

    let startY = 0;
    let startTime = 0;
    let offset = 0;
    let dragging = false;
    const previousTouchAction = handle.style.touchAction;
    handle.style.touchAction = 'none';

    const clearTransform = () => {
      root.style.transition = '';
      root.style.transform = '';
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      dragging = true;
      startY = event.clientY;
      startTime = event.timeStamp;
      offset = 0;
      root.style.transition = 'none';
      handle.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      offset = sheetDragOffset(startY, event.clientY);
      root.style.transform = offset ? `translateY(${offset}px)` : '';
    };

    const finish = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      const elapsed = event.timeStamp - startTime;
      if (sheetShouldClose(offset, elapsed)) {
        clearTransform();
        onCloseRef.current();
        return;
      }
      if (!offset) {
        clearTransform();
        return;
      }
      root.style.transition = 'transform 180ms ease';
      root.style.transform = 'translateY(0px)';
      const done = () => {
        clearTransform();
        root.removeEventListener('transitionend', done);
      };
      root.addEventListener('transitionend', done);
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);

    return () => {
      handle.style.touchAction = previousTouchAction;
      clearTransform();
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
    };
  }, [active, ref]);
}
