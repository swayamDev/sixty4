// src/lib/engine/__tests__/candidates.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_FEN } from "@/lib/constants";
import type { Candidate } from "@/lib/types";
import {
  candidatesFromLegalMoves,
  isCaptureSan,
  linesToCandidates,
  normaliseMove,
  selectCandidate,
  uciToSan,
} from "../candidates";
import type { PvLine } from "../parse-uci";

function candidate(overrides: Partial<Candidate>): Candidate {
  return { san: "e4", uci: "e2e4", scoreCp: 0, mateIn: null, depth: 10, pv: ["e2e4"], ...overrides };
}

/** Always returns the same value, making "random" selection assertable. */
function fixedRandom(value: number) {
  return () => value;
}

describe("uciToSan", () => {
  it("converts a legal UCI move to SAN", () => {
    expect(uciToSan(DEFAULT_FEN, "e2e4")).toBe("e4");
  });

  it("returns null for an illegal move", () => {
    expect(uciToSan(DEFAULT_FEN, "e2e5")).toBeNull();
  });

  it("returns null for a malformed UCI string", () => {
    expect(uciToSan(DEFAULT_FEN, "not-a-move")).toBeNull();
  });

  it("carries a promotion piece through", () => {
    const fen = "8/P7/8/8/8/8/8/k6K w - - 0 1";
    expect(uciToSan(fen, "a7a8q")).toBe("a8=Q+"); // also check: black king sits on a1
  });
});

describe("normaliseMove", () => {
  it("accepts SAN", () => {
    expect(normaliseMove(DEFAULT_FEN, "e4")).toBe("e4");
  });

  it("accepts UCI/LAN and returns the canonical SAN", () => {
    expect(normaliseMove(DEFAULT_FEN, "e2e4")).toBe("e4");
  });

  it("returns null for illegal or empty input", () => {
    expect(normaliseMove(DEFAULT_FEN, "e2e5")).toBeNull();
    expect(normaliseMove(DEFAULT_FEN, "")).toBeNull();
    expect(normaliseMove(DEFAULT_FEN, "   ")).toBeNull();
  });
});

describe("linesToCandidates", () => {
  const lines: PvLine[] = [
    { multipv: 2, depth: 12, seldepth: null, scoreCp: 10, mateIn: null, pv: ["d2d4"] },
    { multipv: 1, depth: 12, seldepth: null, scoreCp: 30, mateIn: null, pv: ["e2e4"] },
  ];

  it("sorts by multipv rank regardless of input order", () => {
    const candidates = linesToCandidates(DEFAULT_FEN, lines);
    expect(candidates.map((c) => c.san)).toEqual(["e4", "d4"]);
  });

  it("drops a line whose head move is illegal", () => {
    const withIllegal: PvLine[] = [
      { multipv: 1, depth: 12, seldepth: null, scoreCp: 0, mateIn: null, pv: ["e2e5"] },
      { multipv: 2, depth: 12, seldepth: null, scoreCp: 0, mateIn: null, pv: ["e2e4"] },
    ];
    const candidates = linesToCandidates(DEFAULT_FEN, withIllegal);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].san).toBe("e4");
  });

  it("drops a duplicate SAN head (keeping the first/better-ranked one)", () => {
    const dup: PvLine[] = [
      { multipv: 1, depth: 12, seldepth: null, scoreCp: 30, mateIn: null, pv: ["e2e4"] },
      { multipv: 2, depth: 12, seldepth: null, scoreCp: 30, mateIn: null, pv: ["e2e4"] },
    ];
    expect(linesToCandidates(DEFAULT_FEN, dup)).toHaveLength(1);
  });

  it("skips a line with an empty pv", () => {
    const empty: PvLine[] = [{ multipv: 1, depth: 12, seldepth: null, scoreCp: 0, mateIn: null, pv: [] }];
    expect(linesToCandidates(DEFAULT_FEN, empty)).toEqual([]);
  });
});

describe("candidatesFromLegalMoves", () => {
  it("returns up to `limit` legal moves with null scores", () => {
    const candidates = candidatesFromLegalMoves(DEFAULT_FEN, 5);
    expect(candidates).toHaveLength(5);
    for (const c of candidates) expect(c.scoreCp).toBeNull();
  });

  it("returns an empty list for an invalid FEN rather than throwing", () => {
    expect(candidatesFromLegalMoves("not a fen", 5)).toEqual([]);
  });

  it("clamps limit to at least 1", () => {
    expect(candidatesFromLegalMoves(DEFAULT_FEN, 0).length).toBeGreaterThanOrEqual(1);
  });
});

describe("isCaptureSan", () => {
  it("is true for SAN containing x", () => {
    expect(isCaptureSan("Nxe5")).toBe(true);
    expect(isCaptureSan("exd5")).toBe(true);
  });

  it("is false for a quiet move", () => {
    expect(isCaptureSan("Nf3")).toBe(false);
  });
});

describe("selectCandidate", () => {
  it("returns null for an empty candidate list", () => {
    expect(selectCandidate("grandmaster", [])).toBeNull();
  });

  it("always takes a rank-1 forced mate, regardless of difficulty", () => {
    const candidates = [candidate({ san: "Qh5#", mateIn: 1 }), candidate({ san: "e4" })];
    for (const difficulty of ["beginner", "casual", "intermediate", "advanced", "grandmaster"] as const) {
      expect(selectCandidate(difficulty, candidates, fixedRandom(0.99))?.san).toBe("Qh5#");
    }
  });

  it("advanced and grandmaster always take rank 1", () => {
    const candidates = [candidate({ san: "best" }), candidate({ san: "second" })];
    expect(selectCandidate("advanced", candidates, fixedRandom(0.99))?.san).toBe("best");
    expect(selectCandidate("grandmaster", candidates, fixedRandom(0.99))?.san).toBe("best");
  });

  it("intermediate takes rank 1 below the 0.7 threshold and rank 2 above it", () => {
    const candidates = [candidate({ san: "best" }), candidate({ san: "second" })];
    expect(selectCandidate("intermediate", candidates, fixedRandom(0.5))?.san).toBe("best");
    expect(selectCandidate("intermediate", candidates, fixedRandom(0.9))?.san).toBe("second");
  });

  it("intermediate falls back to rank 1 if there is no rank 2", () => {
    const candidates = [candidate({ san: "only" })];
    expect(selectCandidate("intermediate", candidates, fixedRandom(0.9))?.san).toBe("only");
  });

  it("casual picks only from the top 3 candidates", () => {
    const candidates = [1, 2, 3, 4, 5].map((n) => candidate({ san: `m${n}` }));
    // random() = 0.99 -> index 2 (the last of a 3-item pool), never m4/m5.
    expect(selectCandidate("casual", candidates, fixedRandom(0.99))?.san).toBe("m3");
  });

  it("beginner prefers a quiet move about half the time", () => {
    // pick() re-uses the same random() draw for indexing into whichever pool is
    // in play, so the pool order is arranged so each branch lands on a distinct san.
    const candidates = [
      candidate({ san: "Nf3" }), // quiet, rank 0
      candidate({ san: "Nxe5" }), // capture, rank 1
      candidate({ san: "Bxc6" }), // capture, rank 2
    ];
    // random() < 0.5 -> filter to quiet moves only -> just "Nf3" left.
    expect(selectCandidate("beginner", candidates, fixedRandom(0.1))?.san).toBe("Nf3");
    // random() >= 0.5 -> no quiet filter; the same draw (0.9) indexes into the
    // full 3-item pool at floor(0.9 * 3) = 2, landing on a capture.
    expect(selectCandidate("beginner", candidates, fixedRandom(0.9))?.san).toBe("Bxc6");
  });

  it("beginner falls back to the full pool when every candidate is a capture", () => {
    const candidates = [candidate({ san: "Nxe5" }), candidate({ san: "Bxc6" })];
    expect(selectCandidate("beginner", candidates, fixedRandom(0.1))).not.toBeNull();
  });

  it("filters out losing-mate lines from the random pool when a safe option exists", () => {
    const candidates = [
      candidate({ san: "blunder", mateIn: -2 }),
      candidate({ san: "safe", mateIn: null }),
    ];
    // casual pool is top-3; with the losing line filtered, only "safe" remains.
    expect(selectCandidate("casual", candidates, fixedRandom(0.99))?.san).toBe("safe");
  });

  it("still returns a losing-mate line if it is the only option", () => {
    const candidates = [candidate({ san: "forced", mateIn: -1 })];
    expect(selectCandidate("advanced", candidates)?.san).toBe("forced");
  });
});
