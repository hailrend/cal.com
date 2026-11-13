import dayjs from "@calcom/dayjs";
import { describe, expect, it } from "vitest";
import { getBusySlotTimes } from "./getBusySlotTimes";

const at = (time: string) => dayjs.utc(`2026-11-16T${time}:00Z`);
const range = (start: string, end: string) => ({ start: at(start), end: at(end) });
const slots = (...times: string[]) => times.map((time) => ({ time: at(time) }));
const toTimes = (result: number[]) => result.map((time) => dayjs.utc(time).format("HH:mm"));

describe("getBusySlotTimes", () => {
  it("returns no busy slots when every candidate fits in an available range", () => {
    const result = getBusySlotTimes({
      candidateSlots: slots("09:00", "09:30", "10:00"),
      availableDateRanges: [range("09:00", "10:30")],
      eventLength: 30,
    });
    expect(result).toEqual([]);
  });

  it("marks candidates that fall in the gap between available ranges", () => {
    const result = getBusySlotTimes({
      candidateSlots: slots("09:00", "09:30", "10:00", "10:30", "11:00"),
      availableDateRanges: [range("09:00", "10:00"), range("11:00", "12:00")],
      eventLength: 30,
    });
    expect(toTimes(result)).toEqual(["10:00", "10:30"]);
  });

  it("marks a candidate that only partially overlaps an available range", () => {
    const result = getBusySlotTimes({
      candidateSlots: slots("10:00", "10:30", "11:00"),
      availableDateRanges: [range("10:00", "10:30"), range("10:45", "12:00")],
      eventLength: 30,
    });
    expect(toTimes(result)).toEqual(["10:30"]);
  });

  it("uses the event length, not the slot interval, to decide whether a slot fits", () => {
    const result = getBusySlotTimes({
      candidateSlots: slots("09:00", "09:15", "09:30", "09:45", "10:00"),
      availableDateRanges: [range("09:00", "10:00"), range("11:00", "12:00")],
      eventLength: 60,
    });
    expect(toTimes(result)).toEqual(["09:15", "09:30", "09:45", "10:00"]);
  });

  it("marks every candidate when nothing is available", () => {
    const result = getBusySlotTimes({
      candidateSlots: slots("09:00", "09:30"),
      availableDateRanges: [],
      eventLength: 30,
    });
    expect(toTimes(result)).toEqual(["09:00", "09:30"]);
  });

  it("handles unsorted input and overlapping available ranges", () => {
    const result = getBusySlotTimes({
      candidateSlots: slots("11:00", "09:00", "10:00"),
      availableDateRanges: [range("10:30", "12:00"), range("09:00", "09:30"), range("08:00", "09:45")],
      eventLength: 30,
    });
    expect(toTimes(result)).toEqual(["10:00"]);
  });

  it("skips out-of-office candidates", () => {
    const result = getBusySlotTimes({
      candidateSlots: [{ time: at("09:00"), away: true }, { time: at("09:30") }],
      availableDateRanges: [],
      eventLength: 30,
    });
    expect(toTimes(result)).toEqual(["09:30"]);
  });
});
