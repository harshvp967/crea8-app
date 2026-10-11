import assert from 'assert';
import dayjs from 'dayjs';
import {
  browserTimezone,
  getTimezone,
  hourSlotInZone,
  isPastCalendarDay,
  isPastHour,
  nowInZone,
} from './set.timezone';

const instant = new Date('2026-10-11T15:17:00.000Z');
const day = '2026-10-11';

const cases = [
  {
    zone: 'Asia/Calcutta',
    pastThrough: 19,
    openFrom: 20,
    clock: '20:47',
  },
  {
    zone: 'UTC',
    pastThrough: 14,
    openFrom: 15,
    clock: '15:17',
  },
  {
    zone: 'America/New_York',
    pastThrough: 10,
    openFrom: 11,
    clock: '11:17',
  },
];

for (const item of cases) {
  const now = nowInZone(item.zone, instant);
  assert.strictEqual(
    now.format('HH:mm'),
    item.clock,
    `${item.zone} clock`
  );
  for (let hour = 0; hour < 24; hour++) {
    const slot = hourSlotInZone(day, hour, item.zone);
    const past = isPastHour(slot, now);
    assert.strictEqual(slot.format('HH'), String(hour).padStart(2, '0'));
    assert.strictEqual(
      past,
      hour < item.openFrom,
      `${item.zone} hour ${hour} past=${past}`
    );
  }
  assert.strictEqual(
    isPastHour(hourSlotInZone(day, item.pastThrough, item.zone), now),
    true
  );
  assert.strictEqual(
    isPastHour(hourSlotInZone(day, item.openFrom, item.zone), now),
    false
  );

  const today = new Date(now.year(), now.month(), now.date());
  const yesterday = new Date(now.year(), now.month(), now.date() - 1);
  assert.strictEqual(isPastCalendarDay(today, now), false, item.zone);
  assert.strictEqual(isPastCalendarDay(yesterday, now), true, item.zone);
}

const memory: Record<string, string> = {};
const windowStub = global as typeof global & { window?: unknown; localStorage?: Storage };
windowStub.window = windowStub;
windowStub.localStorage = {
  getItem: (key: string) => memory[key] || null,
  setItem: (key: string, value: string) => {
    memory[key] = value;
  },
  removeItem: (key: string) => {
    delete memory[key];
  },
  clear: () => undefined,
  key: () => null,
  length: 0,
};
assert.strictEqual(getTimezone(), browserTimezone());
memory.timezone = 'America/New_York';
assert.strictEqual(getTimezone(), 'America/New_York');
delete memory.timezone;
assert.strictEqual(getTimezone(), browserTimezone());
assert.notStrictEqual(browserTimezone(), '');

console.log('calendar timezone checks passed');
console.log(
  cases
    .map((item) => {
      const now = nowInZone(item.zone, instant);
      return `${item.zone} ${now.format('HH:mm')} grey through ${now
        .startOf('hour')
        .subtract(1, 'hour')
        .format('h A')}`;
    })
    .join('\n')
);
