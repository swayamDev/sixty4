// src/lib/__tests__/elo-parity.test.ts
//
// src/lib/elo.ts and convex/lib/elo.ts are the same module duplicated (the file
// header on each says so: "== convex/lib/elo.ts" / "== src/lib/elo.ts"), because
// Convex functions can't import from src/. This test only exists to catch drift:
// if someone fixes a bug in one copy and forgets the other, this fails.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("elo.ts duplication stays in sync", () => {
  it("src/lib/elo.ts and convex/lib/elo.ts are byte-identical", () => {
    const a = readFileSync(path.resolve(__dirname, "../elo.ts"), "utf-8");
    const b = readFileSync(path.resolve(__dirname, "../../../convex/lib/elo.ts"), "utf-8");
    expect(a).toBe(b);
  });
});
