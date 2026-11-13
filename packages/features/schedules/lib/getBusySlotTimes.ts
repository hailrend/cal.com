import type { Dayjs } from "@calcom/dayjs";
import type { DateRange } from "./date-ranges";

const MS_PER_MINUTE = 60_000;

/**
 * From the slot grid built on working hours alone, returns the start times (epoch ms, ascending) of the
 * slots that cannot be booked because they do not fit entirely inside a range that is still available.
 */
export function getBusySlotTimes({
  candidateSlots,
  availableDateRanges,
  eventLength,
}: {
  candidateSlots: { time: Dayjs; away?: boolean }[];
  availableDateRanges: DateRange[];
  eventLength: number;
}): number[] {
  const lengthInMs = eventLength * MS_PER_MINUTE;

  const candidateStarts = candidateSlots
    // Out-of-office slots are already returned and rendered through the `away` flag.
    .filter((slot) => !slot.away)
    .map((slot) => slot.time.valueOf())
    .sort((a, b) => a - b);

  const ranges = availableDateRanges
    .map((range) => ({ start: range.start.valueOf(), end: range.end.valueOf() }))
    .sort((a, b) => a.end - b.end);

  // earliestStartFrom[i] is the earliest start among ranges[i..]; with ranges sorted by end, a slot fits
  // in some range ending at or after it exactly when that earliest start is not after the slot start.
  const earliestStartFrom = new Array<number>(ranges.length);
  let earliestStart = Number.POSITIVE_INFINITY;
  for (let i = ranges.length - 1; i >= 0; i--) {
    earliestStart = Math.min(earliestStart, ranges[i].start);
    earliestStartFrom[i] = earliestStart;
  }

  const busySlotTimes: number[] = [];
  let firstRangeEndingLateEnough = 0;

  for (const slotStart of candidateStarts) {
    const slotEnd = slotStart + lengthInMs;
    while (firstRangeEndingLateEnough < ranges.length && ranges[firstRangeEndingLateEnough].end < slotEnd) {
      firstRangeEndingLateEnough++;
    }
    const fitsInAvailableRange =
      firstRangeEndingLateEnough < ranges.length &&
      earliestStartFrom[firstRangeEndingLateEnough] <= slotStart;

    if (!fitsInAvailableRange) busySlotTimes.push(slotStart);
  }

  return busySlotTimes;
}
