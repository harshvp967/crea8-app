import clsx from 'clsx';

export const pill = (active: boolean) =>
  clsx(
    'stk-pill inline-flex items-center gap-[6px] whitespace-nowrap rounded-[18px] border px-[12px] min-h-[36px] text-[14px] font-[500] transition-colors',
    active
      ? 'arc-selected'
      : 'border-transparent text-textItemBlur hover:border-newBorder hover:bg-newBoxHover hover:text-newTextColor'
  );

export const chooseVisibleTabs = (
  widths: number[],
  available: number,
  activeIndex: number,
  moreWidth: number
) => {
  const gap = 2;
  const sum = (indexes: number[]) =>
    indexes.reduce((total, index) => total + widths[index], 0) +
    Math.max(0, indexes.length - 1) * gap;
  const all = widths.map((_, index) => index);
  if (sum(all) <= available) {
    return all;
  }
  const room = Math.max(0, available - moreWidth - gap);
  const chosen: number[] = [];
  for (let index = 0; index < widths.length; index += 1) {
    const next = [...chosen, index];
    const pending =
      activeIndex > index && !next.includes(activeIndex) ? widths[activeIndex] + gap : 0;
    if (sum(next) + pending <= room) {
      chosen.push(index);
    }
  }
  if (activeIndex >= 0 && !chosen.includes(activeIndex)) {
    const without = [...chosen];
    while (without.length && sum(without) + widths[activeIndex] + gap > room) {
      without.pop();
    }
    without.push(activeIndex);
    return without;
  }
  return chosen;
};
