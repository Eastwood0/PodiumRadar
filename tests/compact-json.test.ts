import { describe, expect, it } from "vitest";
import { decodeCompactJson } from "../scripts/lib/compact-json";

describe("decodeCompactJson", () => {
  it("decodes objects, arrays, shared references and undefined", () => {
    const entries = [[2, [[1, 2], [3, 4], [5, 6]]], [0, "title"], [0, "Muse"], [0, "dates"], [1, [7, 7]], [0, "missing"], [-1], [0, "2027-01-01"]];
    expect(decodeCompactJson(entries)).toEqual({ title: "Muse", dates: ["2027-01-01", "2027-01-01"], missing: undefined });
  });
  it("rejects unknown types and cycles", () => {
    expect(() => decodeCompactJson([[9, 1]])).toThrow(/onbekend type/);
    expect(() => decodeCompactJson([[1, [0]]])).toThrow(/kringverwijzing/);
  });
});
