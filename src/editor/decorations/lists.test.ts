import { describe, expect, it } from "vitest";
import { parseTaskPrefix } from "./lists";

describe("parseTaskPrefix", () => {
  it("parses unchecked task prefixes", () => {
    const parsed = parseTaskPrefix("- [ ] buy milk", 100, 100);
    expect(parsed).toEqual({
      checked: false,
      replaceTo: 106,
    });
  });

  it("parses checked task prefixes", () => {
    const parsed = parseTaskPrefix("  - [x] done", 0, 2);
    expect(parsed).toEqual({
      checked: true,
      replaceTo: 8,
    });
  });

  it("returns null when task prefix is incomplete", () => {
    expect(parseTaskPrefix("- [ buy milk", 0, 0)).toBeNull();
    expect(parseTaskPrefix("- [] buy milk", 0, 0)).toBeNull();
    expect(parseTaskPrefix("- [X buy milk", 0, 0)).toBeNull();
  });
});
