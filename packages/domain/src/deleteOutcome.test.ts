import { describe, expect, it } from "vitest";
import { NothingDeletedError, requireRowsDeleted } from "./deleteOutcome.js";

describe("requireRowsDeleted", () => {
  it("passes through when at least one row came back", () => {
    expect(() => requireRowsDeleted([{ id: "a" }], "Property")).not.toThrow();
  });

  it("throws when the delete matched nothing", () => {
    expect(() => requireRowsDeleted([], "Property")).toThrow(NothingDeletedError);
  });

  it("throws when PostgREST returned no rows at all", () => {
    expect(() => requireRowsDeleted(null, "Bed")).toThrow(NothingDeletedError);
  });

  it("names the record in the message, so a caller can say which delete failed", () => {
    expect(() => requireRowsDeleted([], "Planting")).toThrow(/Planting/);
  });

  it("carries the record name as a field, not only inside the message", () => {
    try {
      requireRowsDeleted([], "Plant");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NothingDeletedError);
      expect((error as NothingDeletedError).entity).toBe("Plant");
    }
  });

  it("is an Error, so existing catch blocks that read `.message` still work", () => {
    expect(new NothingDeletedError("Property")).toBeInstanceOf(Error);
  });
});
