import { describe, it, expect } from "vitest";
import {
  parseMoney,
  moneyInput,
  duration,
  timeInRange,
  entryValue,
} from "../services/format";
import { entry } from "./fixtures";
describe("time and financial calculations", () => {
  it("uses integer minor units and currency-specific precision", () => {
    expect(parseMoney("12.34", "USD")).toBe(1234);
    expect(parseMoney("100", "JPY")).toBe(100);
    expect(moneyInput(1234, "USD")).toBe("12.34");
    expect(parseMoney("", "USD")).toBeNull();
    expect(() => parseMoney("1.234", "USD")).toThrow();
    expect(() => parseMoney("1.1", "JPY")).toThrow();
    expect(() => parseMoney("-1", "USD")).toThrow();
  });
  it("calculates hourly estimates without floats in stored money", () => {
    expect(entryValue(entry())).toBe(6000);
    expect(entryValue({ ...entry(), billable: false })).toBe(0);
    expect(entryValue({ ...entry(), rateMinor: null })).toBe(0);
  });
  it("allocates time across local-range boundaries and excludes non-overlap", () => {
    expect(timeInRange(entry(), 1000, 1801000)).toBe(1800000);
    expect(timeInRange(entry(), 5000000, 6000000)).toBe(0);
    expect(duration(3601000)).toBe("01:00:01");
  });
});
