// src/lib/__tests__/chess.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_FEN } from "../constants";
import {
  buildPgn,
  capturedFromMoves,
  checkSquareOf,
  fenAtPly,
  isLegalMove,
  lastMoveAtPly,
  legalTargetsFor,
  materialBalance,
  needsPromotion,
  piecesFromFen,
  replay,
  toHistoryRows,
} from "../chess";

const SCHOLARS_MATE = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];

describe("replay / fenAtPly", () => {
  it("returns the start position for an empty move list", () => {
    expect(fenAtPly([], 0)).toBe(DEFAULT_FEN);
  });

  it("replays a SAN list to the correct FEN", () => {
    const chess = replay(["e4", "e5"]);
    expect(chess.fen()).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
  });

  it("throws on an illegal SAN, per its documented contract", () => {
    expect(() => replay(["e4", "e4"])).toThrow();
  });

  it("fenAtPly(moves, ply) matches replaying just the first `ply` moves", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6"];
    expect(fenAtPly(moves, 2)).toBe(replay(moves.slice(0, 2)).fen());
    expect(fenAtPly(moves, moves.length)).toBe(replay(moves).fen());
  });
});

describe("legalTargetsFor", () => {
  it("gives the knight on b1 its two opening moves", () => {
    const targets = legalTargetsFor(DEFAULT_FEN, "b1").map((t) => t.to).sort();
    expect(targets).toEqual(["a3", "c3"]);
  });

  it("flags a capture", () => {
    // 1. e4 d5 2. exd5: the pawn on e4 can capture on d5.
    const fen = replay(["e4", "d5"]).fen();
    const targets = legalTargetsFor(fen, "e4");
    const capture = targets.find((t) => t.to === "d5");
    expect(capture?.isCapture).toBe(true);
  });

  it("flags a promotion", () => {
    // White pawn one step from queening, nothing else on the board.
    const fen = "8/P7/8/8/8/8/8/k6K w - - 0 1";
    const targets = legalTargetsFor(fen, "a7");
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ to: "a8", isPromotion: true });
  });

  it("flags castling for both sides", () => {
    // Both kings and both a/h rooks untouched, nothing in between.
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const targets = legalTargetsFor(fen, "e1").map((t) => t.to);
    expect(targets).toContain("c1");
    expect(targets).toContain("g1");
    const castleTargets = legalTargetsFor(fen, "e1").filter((t) => t.to === "c1" || t.to === "g1");
    expect(castleTargets.every((t) => t.isCastle)).toBe(true);
  });

  it("flags en passant", () => {
    // 1. e4 a6 2. e5 d5 3. exd6 (en passant): exd5 en passant.
    const fen = replay(["e4", "a6", "e5", "d5"]).fen();
    const targets = legalTargetsFor(fen, "e5");
    const ep = targets.find((t) => t.to === "d6");
    expect(ep?.isEnPassant).toBe(true);
  });

  it("returns nothing for an empty square", () => {
    expect(legalTargetsFor(DEFAULT_FEN, "e4")).toEqual([]);
  });
});

describe("needsPromotion", () => {
  it("is true only for a pawn move onto the last rank", () => {
    const fen = "8/P7/8/8/8/8/8/k6K w - - 0 1";
    expect(needsPromotion(fen, "a7", "a8")).toBe(true);
  });

  it("is false for an ordinary move", () => {
    expect(needsPromotion(DEFAULT_FEN, "e2", "e4")).toBe(false);
  });
});

describe("isLegalMove", () => {
  it("accepts a legal opening move", () => {
    expect(isLegalMove(DEFAULT_FEN, "e2", "e4")).toBe(true);
  });

  it("rejects a move that leaves the mover's own king in check", () => {
    // King on e1 pinned; moving the e-pawn would expose it to the rook on e8.
    const fen = "4r3/8/8/8/8/8/4P3/4K3 w - - 0 1";
    expect(isLegalMove(fen, "e2", "e4")).toBe(false);
  });

  it("rejects a physically impossible move", () => {
    expect(isLegalMove(DEFAULT_FEN, "e2", "e5")).toBe(false);
  });

  it("requires the promotion piece for a promoting move", () => {
    const fen = "8/P7/8/8/8/8/8/k6K w - - 0 1";
    expect(isLegalMove(fen, "a7", "a8")).toBe(false);
    expect(isLegalMove(fen, "a7", "a8", "q")).toBe(true);
  });
});

describe("checkSquareOf", () => {
  it("is null outside of check", () => {
    expect(checkSquareOf(DEFAULT_FEN)).toBeNull();
  });

  it("finds the checked king's square", () => {
    // Scholar's mate: black king on e8 is in checkmate, which is also check.
    const fen = replay(SCHOLARS_MATE).fen();
    expect(checkSquareOf(fen)).toBe("e8");
  });
});

describe("piecesFromFen", () => {
  it("lists all 32 pieces on the starting position", () => {
    const pieces = piecesFromFen(DEFAULT_FEN);
    expect(pieces).toHaveLength(32);
    expect(pieces.filter((p) => p.colour === "w")).toHaveLength(16);
    expect(pieces.filter((p) => p.colour === "b")).toHaveLength(16);
  });

  it("locates a specific piece correctly", () => {
    const pieces = piecesFromFen(DEFAULT_FEN);
    const whiteKing = pieces.find((p) => p.type === "k" && p.colour === "w");
    expect(whiteKing?.square).toBe("e1");
  });
});

describe("capturedFromMoves / materialBalance", () => {
  it("has no captures in a quiet opening", () => {
    const captured = capturedFromMoves(["e4", "e5", "Nf3", "Nc6"]);
    expect(captured.w).toEqual([]);
    expect(captured.b).toEqual([]);
  });

  it("attributes a capture to the capturing colour", () => {
    // 1. e4 d5 2. exd5: white captures black's d-pawn.
    const captured = capturedFromMoves(["e4", "d5", "exd5"]);
    expect(captured.w).toEqual(["p"]);
    expect(captured.b).toEqual([]);
  });

  it("materialBalance is positive when white is ahead", () => {
    const captured = capturedFromMoves(["e4", "d5", "exd5"]);
    expect(materialBalance(captured)).toBeGreaterThan(0);
  });

  it("materialBalance is zero with no captures", () => {
    expect(materialBalance({ w: [], b: [] })).toBe(0);
  });
});

describe("lastMoveAtPly", () => {
  it("is null at ply 0", () => {
    expect(lastMoveAtPly(["e4", "e5"], 0)).toBeNull();
  });

  it("describes the move at the given ply", () => {
    const last = lastMoveAtPly(["e4", "e5"], 1);
    expect(last).toMatchObject({ from: "e2", to: "e4", san: "e4", colour: "w" });
  });

  it("clamps to the end of a shorter move list rather than throwing", () => {
    // ply outlives moves (a take-back shortened the list); must not throw.
    expect(() => lastMoveAtPly(["e4"], 5)).not.toThrow();
    expect(lastMoveAtPly(["e4"], 5)).toMatchObject({ san: "e4" });
  });

  it("records the en passant capture square separately from the destination", () => {
    const moves = ["e4", "a6", "e5", "d5", "exd6"];
    const last = lastMoveAtPly(moves, moves.length);
    expect(last?.capturedSquare).toBe("d5");
    expect(last?.to).toBe("d6");
  });
});

describe("toHistoryRows", () => {
  it("pairs SAN moves by full-move number", () => {
    const rows = toHistoryRows(["e4", "e5", "Nf3"]);
    expect(rows).toEqual([
      { number: 1, white: { ply: 1, san: "e4" }, black: { ply: 2, san: "e5" } },
      { number: 2, white: { ply: 3, san: "Nf3" } },
    ]);
  });

  it("returns an empty array for no moves", () => {
    expect(toHistoryRows([])).toEqual([]);
  });
});

describe("buildPgn", () => {
  it("includes the required headers and the move text", () => {
    const pgn = buildPgn(["e4", "e5"], { white: "Alice", black: "Bob", result: "*" });
    expect(pgn).toContain('[White "Alice"]');
    expect(pgn).toContain('[Black "Bob"]');
    expect(pgn).toContain('[Result "*"]');
    expect(pgn).toContain("1. e4 e5");
  });

  it("defaults Event to Sixty4 and always sets Site to Sixty4", () => {
    const pgn = buildPgn([], { white: "A", black: "B", result: "*" });
    expect(pgn).toContain('[Event "Sixty4"]');
    expect(pgn).toContain('[Site "Sixty4"]');
  });

  it("uses a supplied event name over the default", () => {
    const pgn = buildPgn([], { white: "A", black: "B", result: "*", event: "Club Night" });
    expect(pgn).toContain('[Event "Club Night"]');
  });
});
