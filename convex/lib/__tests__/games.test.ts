// convex/lib/__tests__/games.test.ts
import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../_generated/dataModel";
import { actingColour, canActAs, colourOf, requireParticipant, sideName, viewerRole } from "../games";

const WHITE = "white_player" as Id<"players">;
const BLACK = "black_player" as Id<"players">;
const STRANGER = "someone_else" as Id<"players">;

/** Minimal fixture: only the fields these pure helpers actually read. */
function game(overrides: Partial<Doc<"games">> = {}): Doc<"games"> {
  return {
    whiteId: WHITE,
    blackId: BLACK,
    mode: "online",
    turn: "w",
    ...overrides,
  } as unknown as Doc<"games">;
}

function player(overrides: Partial<Doc<"players">> = {}): Doc<"players"> {
  return { username: "alice", ...overrides } as unknown as Doc<"players">;
}

describe("colourOf", () => {
  it("returns 'w' for the white player", () => {
    expect(colourOf(game(), WHITE)).toBe("w");
  });

  it("returns 'b' for the black player", () => {
    expect(colourOf(game(), BLACK)).toBe("b");
  });

  it("returns null for a non-participant", () => {
    expect(colourOf(game(), STRANGER)).toBeNull();
  });

  it("returns null against a null side (AI plays that colour)", () => {
    const g = game({ whiteId: null });
    expect(colourOf(g, STRANGER)).toBeNull();
  });
});

describe("requireParticipant", () => {
  it("returns the participant's colour", () => {
    expect(requireParticipant(game(), WHITE)).toBe("w");
    expect(requireParticipant(game(), BLACK)).toBe("b");
  });

  it("throws 'not-a-participant' for anyone else", () => {
    expect(() => requireParticipant(game(), STRANGER)).toThrow("not-a-participant");
  });
});

describe("canActAs", () => {
  it("online mode: only the owner of a colour can act as it", () => {
    const g = game({ mode: "online" });
    expect(canActAs(g, WHITE, "w")).toBe(true);
    expect(canActAs(g, WHITE, "b")).toBe(false);
    expect(canActAs(g, BLACK, "b")).toBe(true);
  });

  it("local mode: the owner (whiteId) may act as either colour", () => {
    const g = game({ mode: "local", whiteId: WHITE, blackId: null });
    expect(canActAs(g, WHITE, "w")).toBe(true);
    expect(canActAs(g, WHITE, "b")).toBe(true);
  });

  it("local mode: nobody else may act, for either colour", () => {
    const g = game({ mode: "local", whiteId: WHITE, blackId: null });
    expect(canActAs(g, STRANGER, "w")).toBe(false);
    expect(canActAs(g, STRANGER, "b")).toBe(false);
  });
});

describe("actingColour", () => {
  it("local mode: the owner acts for whichever colour is on move", () => {
    const g = game({ mode: "local", whiteId: WHITE, blackId: null, turn: "b" });
    expect(actingColour(g, WHITE)).toBe("b");
  });

  it("non-local mode: falls back to the participant's own colour", () => {
    const g = game({ mode: "online", turn: "b" });
    expect(actingColour(g, WHITE)).toBe("w");
  });

  it("throws for a non-participant in non-local mode", () => {
    const g = game({ mode: "online" });
    expect(() => actingColour(g, STRANGER)).toThrow("not-a-participant");
  });
});

describe("viewerRole", () => {
  it("is 'spectator' for a signed-out viewer", () => {
    expect(viewerRole(game(), null)).toBe("spectator");
  });

  it("identifies white and black in online mode", () => {
    const g = game({ mode: "online" });
    expect(viewerRole(g, WHITE)).toBe("white");
    expect(viewerRole(g, BLACK)).toBe("black");
  });

  it("is 'spectator' for a non-participant", () => {
    expect(viewerRole(game(), STRANGER)).toBe("spectator");
  });

  it("local mode: the owner is 'local', anyone else is 'spectator'", () => {
    const g = game({ mode: "local", whiteId: WHITE, blackId: null });
    expect(viewerRole(g, WHITE)).toBe("local");
    expect(viewerRole(g, STRANGER)).toBe("spectator");
  });
});

describe("sideName", () => {
  it("prefers the player document's username when one exists", () => {
    const g = game({ mode: "online" });
    expect(sideName(g, "w", player({ username: "alice" }))).toBe("alice");
  });

  it("resolves the AI persona name for the AI's colour in ai mode", () => {
    const g = game({ mode: "ai", aiColor: "b", difficulty: "grandmaster" });
    expect(sideName(g, "b", null)).toBe("Kasparova");
  });

  it("defaults to the casual persona when difficulty is unset", () => {
    const g = game({ mode: "ai", aiColor: "b" });
    expect(sideName(g, "b", null)).toBe("Marco");
  });

  it("returns the local player-two name for black in local mode", () => {
    const g = game({ mode: "local", localPlayerTwoName: "Bob" });
    expect(sideName(g, "b", null)).toBe("Bob");
  });

  it("falls back to the default local player-two name when unset", () => {
    const g = game({ mode: "local", localPlayerTwoName: undefined });
    expect(sideName(g, "b", null)).toBe("Player 2");
  });

  it("returns 'Unknown' when there is no player and no AI/local context fits", () => {
    const g = game({ mode: "online" });
    expect(sideName(g, "w", null)).toBe("Unknown");
  });
});
