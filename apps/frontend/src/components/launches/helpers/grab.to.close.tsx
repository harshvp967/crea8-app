'use client';

import { RefObject, useEffect, useRef } from 'react';
import {
  DragSample,
  releaseVelocity,
  sheetDragOffset,
  sheetShouldClose,
} from '@gitroom/frontend/components/launches/helpers/sheet.swipe';

type CloseResult = void | boolean | Promise<void | boolean>;

function isPromise(value: CloseResult): value is Promise<void | boolean> {
  return Boolean(value) && typeof (value as Promise<void | boolean>).then === 'function';
}

/**
 * Drag the `.arc-grab` handle downward to close a sheet.
 * The sheet follows the finger with a translate, then snaps back when the
 * drag is too short and too slow. No stylesheet changes: the transform is
 * inline and cleared when the gesture ends.
 */
export function useGrabToClose(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => CloseResult
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
    let offset = 0;
    let dragging = false;
    let closing = false;
    let samples: DragSample[] = [];
    const previousTouchAction = handle.style.touchAction;
    handle.style.touchAction = 'none';

    const clearTransform = () => {
      root.style.transition = '';
      root.style.transform = '';
    };

    const snapHome = () => {
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

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      dragging = true;
      startY = event.clientY;
      offset = 0;
      samples = [{ y: event.clientY, time: event.timeStamp }];
      root.style.transition = 'none';
      handle.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      offset = sheetDragOffset(startY, event.clientY);
      samples.push({ y: event.clientY, time: event.timeStamp });
      if (samples.length > 12) {
        samples = samples.slice(-12);
      }
      root.style.transform = offset ? `translateY(${offset}px)` : '';
    };

    const finish = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      samples.push({ y: event.clientY, time: event.timeStamp });
      const velocity = releaseVelocity(samples);
      if (!sheetShouldClose(offset, velocity)) {
        snapHome();
        return;
      }
      const result = onCloseRef.current();
      if (isPromise(result)) {
        // The discard confirm keeps the sheet mounted. Hide it, park it at
        // rest while it is hidden, and show it again only if the user stays.
        root.style.visibility = 'hidden';
        clearTransform();
        void result.then((closed) => {
          if (closed === true || !root.isConnected) {
            return;
          }
          root.style.visibility = '';
        });
        return;
      }
      // Leave the dragged translate in place so the sheet does not jump home
      // before it unmounts.
      closing = true;
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);

    return () => {
      handle.style.touchAction = previousTouchAction;
      if (!closing) {
        clearTransform();
        root.style.visibility = '';
      }
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
    };
  }, [active, ref]);
}
