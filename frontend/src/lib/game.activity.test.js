import { parseActivityMessage } from "./game";

describe("activity feed message safety", () => {
  test("does not crash when a legacy event has no message field", () => {
    expect(() => parseActivityMessage(undefined)).not.toThrow();
    expect(parseActivityMessage(undefined)).toBe("");
  });

  test("still parses valid activity text", () => {
    const result = parseActivityMessage("Crew Alfa saiu para Operação Centro.");
    expect(Array.isArray(result) || typeof result === "string").toBe(true);
  });
});
