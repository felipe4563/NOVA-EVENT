import { describe, expect, it } from "vitest";
import { unirSaltos } from "./texto";

describe("unirSaltos", () => {
  it("\r\n y \r sueltos pasan a \n", () => {
    expect(unirSaltos("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });
  it("el largo cuenta un carácter por salto", () => {
    expect(unirSaltos("x\r\n".repeat(1000)).length).toBe(2000);
  });
});
