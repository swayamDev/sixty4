// src/lib/__tests__/difficulty.test.ts
import { describe, expect, it } from "vitest";
import { AI_RATING, DIFFICULTIES, DIFFICULTY_ORDER, aiDisplayName } from "../difficulty";

describe("DIFFICULTIES", () => {
  it("has exactly one config per DIFFICULTY_ORDER entry, keyed by its own id", () => {
    expect(Object.keys(DIFFICULTIES).sort()).toEqual([...DIFFICULTY_ORDER].sort());
    for (const id of DIFFICULTY_ORDER) {
      expect(DIFFICULTIES[id].id).toBe(id);
    }
  });

  it("gets strictly harder from beginner to grandmaster on every difficulty axis", () => {
    for (let i = 1; i < DIFFICULTY_ORDER.length; i++) {
      const prev = DIFFICULTIES[DIFFICULTY_ORDER[i - 1]];
      const curr = DIFFICULTIES[DIFFICULTY_ORDER[i]];
      expect(curr.depth).toBeGreaterThan(prev.depth);
      expect(curr.skillLevel).toBeGreaterThanOrEqual(prev.skillLevel);
      expect(curr.aiRating).toBeGreaterThan(prev.aiRating);
    }
  });

  it("skillLevel stays within Stockfish's documented 0-20 range", () => {
    for (const id of DIFFICULTY_ORDER) {
      expect(DIFFICULTIES[id].skillLevel).toBeGreaterThanOrEqual(0);
      expect(DIFFICULTIES[id].skillLevel).toBeLessThanOrEqual(20);
    }
  });

  it("only allows hints at the two easiest tiers", () => {
    expect(DIFFICULTIES.beginner.hintsAllowed).toBe(true);
    expect(DIFFICULTIES.casual.hintsAllowed).toBe(true);
    expect(DIFFICULTIES.intermediate.hintsAllowed).toBe(false);
    expect(DIFFICULTIES.advanced.hintsAllowed).toBe(false);
    expect(DIFFICULTIES.grandmaster.hintsAllowed).toBe(false);
  });

  it("gives every persona a distinct, non-empty name", () => {
    const names = DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].persona.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.length).toBeGreaterThan(0);
  });
});

describe("AI_RATING", () => {
  it("matches each difficulty's own aiRating field", () => {
    for (const id of DIFFICULTY_ORDER) {
      expect(AI_RATING[id]).toBe(DIFFICULTIES[id].aiRating);
    }
  });
});

describe("aiDisplayName", () => {
  it("returns the persona name for each difficulty", () => {
    expect(aiDisplayName("beginner")).toBe("Pip");
    expect(aiDisplayName("casual")).toBe("Marco");
    expect(aiDisplayName("intermediate")).toBe("Ada");
    expect(aiDisplayName("advanced")).toBe("Viktor");
    expect(aiDisplayName("grandmaster")).toBe("Kasparova");
  });
});
