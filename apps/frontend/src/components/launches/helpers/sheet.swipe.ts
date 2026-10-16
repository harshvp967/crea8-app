/** Distance, in px, past which a downward drag closes the sheet. */
export const SHEET_CLOSE_DISTANCE = 72;

/** Downward speed, in px/ms, that closes the sheet even on a short drag. */
export const SHEET_CLOSE_VELOCITY = 0.55;

/** Release speed uses only the last slice of the gesture, not the whole drag. */
export const SHEET_VELOCITY_WINDOW_MS = 100;

export type DragSample = {
  y: number;
  time: number;
};

/**
 * A bottom sheet closes when the finger has moved down far enough, or when
 * the flick at release is fast enough. Upward and near-zero drags stay open.
 * `velocity` is px/ms from `releaseVelocity`, positive downward.
 */
export function sheetShouldClose(distance: number, velocity: number) {
  if (distance < 8) {
    return false;
  }
  if (distance >= SHEET_CLOSE_DISTANCE) {
    return true;
  }
  return velocity >= SHEET_CLOSE_VELOCITY;
}

/** Speed between the newest sample and the oldest sample still inside the window. */
export function releaseVelocity(
  samples: DragSample[],
  windowMs = SHEET_VELOCITY_WINDOW_MS
) {
  if (samples.length < 2) {
    return 0;
  }
  const last = samples[samples.length - 1];
  let anchor = last;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (last.time - samples[index].time <= windowMs) {
      anchor = samples[index];
    } else {
      break;
    }
  }
  const elapsed = last.time - anchor.time;
  if (elapsed <= 0) {
    return 0;
  }
  return (last.y - anchor.y) / elapsed;
}

/** Only downward movement moves the sheet. An upward drag stays put. */
export function sheetDragOffset(startY: number, currentY: number) {
  return Math.max(0, currentY - startY);
}
