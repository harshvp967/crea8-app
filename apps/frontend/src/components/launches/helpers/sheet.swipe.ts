/** Distance, in px, past which a downward drag closes the sheet. */
export const SHEET_CLOSE_DISTANCE = 72;

/** Downward speed, in px/ms, that closes the sheet even on a short drag. */
export const SHEET_CLOSE_VELOCITY = 0.55;

/**
 * A bottom sheet closes when the finger has moved down far enough, or when
 * the flick is fast enough. Upward and near-zero drags stay open.
 */
export function sheetShouldClose(distance: number, elapsedMs: number) {
  if (distance < 8) {
    return false;
  }
  if (distance >= SHEET_CLOSE_DISTANCE) {
    return true;
  }
  const elapsed = elapsedMs > 0 ? elapsedMs : 1;
  return distance / elapsed >= SHEET_CLOSE_VELOCITY;
}

/** Only downward movement moves the sheet. An upward drag stays put. */
export function sheetDragOffset(startY: number, currentY: number) {
  return Math.max(0, currentY - startY);
}
