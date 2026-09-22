// convex/__tests__/games.test.ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

async function withPlayer(instance: ReturnType<typeof convexTest>, subject: string, nickname: string) {
  const asUser = instance.withIdentity({ subject, nickname });
  await asUser.mutation(api.players.ensurePlayer, {});
  return asUser;
}

describe("games.createLocalGame", () => {
  it("creates an unrated active local game owned by the caller", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, { playerTwoName: "Bob" });
    const view = await asAlice.query(api.games.get, { gameId });
    expect(view?.game.mode).toBe("local");
    expect(view?.game.rated).toBe(false);
    expect(view?.game.status).toBe("active");
    expect(view?.game.localPlayerTwoName).toBe("Bob");
  });

  it("defaults the second player's name when none is given", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, {});
    const view = await asAlice.query(api.games.get, { gameId });
    expect(view?.game.localPlayerTwoName).toBe("Player 2");
  });

  it("refuses to start a second game while one is already active", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    await asAlice.mutation(api.games.createLocalGame, {});
    await expect(asAlice.mutation(api.games.createLocalGame, {})).rejects.toThrow("already-in-game");
  });
});

describe("games.createAiGame", () => {
  it("seats the human on the requested colour and the AI on the other", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createAiGame, {
      difficulty: "casual",
      playerColor: "b",
    });
    const view = await asAlice.query(api.games.get, { gameId });
    expect(view?.game.mode).toBe("ai");
    expect(view?.game.aiColor).toBe("w");
    expect(view?.viewerRole).toBe("black");
  });
});

describe("games.makeMove", () => {
  it("applies a legal move and advances the turn", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, {});
    const result = await asAlice.mutation(api.games.makeMove, { gameId, from: "e2", to: "e4" });
    expect(result.san).toBe("e4");
    expect(result.turn).toBe("b");
    expect(result.status).toBe("active");
  });

  it("rejects an illegal move", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, {});
    await expect(asAlice.mutation(api.games.makeMove, { gameId, from: "e2", to: "e5" })).rejects.toThrow();
  });

  it("requires a promotion piece on a promoting move", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, {});
    // Race a white pawn to the 8th rank with nothing else in the way.
    const moves: [string, string][] = [
      ["a2", "a4"], ["h7", "h5"], ["a4", "a5"], ["h5", "h4"],
      ["a5", "a6"], ["h4", "h3"], ["a6", "b7"], ["h3", "g2"],
    ];
    for (const [from, to] of moves) {
      await asAlice.mutation(api.games.makeMove, { gameId, from, to });
    }
    await expect(
      asAlice.mutation(api.games.makeMove, { gameId, from: "b7", to: "a8" }),
    ).rejects.toThrow("promotion-required");
    const result = await asAlice.mutation(api.games.makeMove, {
      gameId,
      from: "b7",
      to: "a8",
      promotion: "q",
    });
    expect(result.san).toBe("bxa8=Q");
  });

  it("online mode: a player may not move on the other player's turn", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const asBob = await withPlayer(t, "user_bob", "bob");
    await asAlice.mutation(api.queue.join, {});
    await asBob.mutation(api.queue.join, {});
    await t.mutation(internal.queue.pair, {});
    const gameId = (await asAlice.query(api.games.myActiveGame, {}))!;
    const view = await asAlice.query(api.games.get, { gameId });

    const [toMove, waiting] =
      view!.viewerRole === "white" ? [asAlice, asBob] : [asBob, asAlice];

    await expect(waiting.mutation(api.games.makeMove, { gameId, from: "e2", to: "e4" })).rejects.toThrow(
      "not-your-turn",
    );
    // The player actually on move can move without error.
    await expect(toMove.mutation(api.games.makeMove, { gameId, from: "e2", to: "e4" })).resolves.toBeDefined();
  });

  it("local mode: the single owner may move both colours", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, {});
    await asAlice.mutation(api.games.makeMove, { gameId, from: "e2", to: "e4" });
    // Now it's black's turn; the same caller (the owner) plays it too.
    const result = await asAlice.mutation(api.games.makeMove, { gameId, from: "e7", to: "e5" });
    expect(result.san).toBe("e5");
  });

  it("rejects any move once the game has ended", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, {});
    await asAlice.mutation(api.games.resign, { gameId });
    await expect(
      asAlice.mutation(api.games.makeMove, { gameId, from: "e2", to: "e4" }),
    ).rejects.toThrow("game-not-active");
  });
});

describe("games.makeMove: checkmate finalizes the game and updates ratings", () => {
  it("scholar's mate ends the game and updates both online players' ratings", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const asBob = await withPlayer(t, "user_bob", "bob");
    await asAlice.mutation(api.queue.join, {});
    await asBob.mutation(api.queue.join, {});
    await t.mutation(internal.queue.pair, {});
    const gameId = (await asAlice.query(api.games.myActiveGame, {}))!;
    const view = await asAlice.query(api.games.get, { gameId });
    const [white, black] = view!.viewerRole === "white" ? [asAlice, asBob] : [asBob, asAlice];

    const scholarsMate: [string, string][] = [
      ["e2", "e4"], ["e7", "e5"],
      ["f1", "c4"], ["b8", "c6"],
      ["d1", "h5"], ["g8", "f6"],
    ];
    for (let i = 0; i < scholarsMate.length; i++) {
      const [from, to] = scholarsMate[i];
      await (i % 2 === 0 ? white : black).mutation(api.games.makeMove, { gameId, from, to });
    }
    // Qxf7#: Qh5 takes f7, checkmating black.
    const result = await white.mutation(api.games.makeMove, { gameId, from: "h5", to: "f7" });
    expect(result.status).toBe("checkmate");
    expect(result.winner).toBe("w");

    const finished = await asAlice.query(api.games.get, { gameId });
    expect(finished?.game.status).toBe("checkmate");

    const winnerIsAlice = view!.viewerRole === "white";
    const winnerMe = winnerIsAlice ? await asAlice.query(api.players.me, {}) : await asBob.query(api.players.me, {});
    const loserMe = winnerIsAlice ? await asBob.query(api.players.me, {}) : await asAlice.query(api.players.me, {});
    expect(winnerMe?.wins).toBe(1);
    expect(winnerMe?.rating).toBeGreaterThan(1200);
    expect(loserMe?.losses).toBe(1);
    expect(loserMe?.rating).toBeLessThan(1200);
  });
});

describe("games.resign", () => {
  it("ends the game with the other side as winner", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, {});
    await asAlice.mutation(api.games.resign, { gameId });
    const view = await asAlice.query(api.games.get, { gameId });
    expect(view?.game.status).toBe("resigned");
    // Local mode: the owner is white and it was white's turn, so white resigned.
    expect(view?.game.winner).toBe("b");
  });

  it("cannot resign a game that has already ended", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createLocalGame, {});
    await asAlice.mutation(api.games.resign, { gameId });
    await expect(asAlice.mutation(api.games.resign, { gameId })).rejects.toThrow("game-not-active");
  });
});

describe("games.offerDraw / respondDraw", () => {
  it("is unavailable in ai-mode games", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const gameId = await asAlice.mutation(api.games.createAiGame, {
      difficulty: "casual",
      playerColor: "w",
    });
    await expect(asAlice.mutation(api.games.offerDraw, { gameId })).rejects.toThrow("draw-not-available");
  });

  it("an offer answered by acceptance ends the game as a draw", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const asBob = await withPlayer(t, "user_bob", "bob");
    await asAlice.mutation(api.queue.join, {});
    await asBob.mutation(api.queue.join, {});
    await t.mutation(internal.queue.pair, {});
    const gameId = (await asAlice.query(api.games.myActiveGame, {}))!;

    await asAlice.mutation(api.games.offerDraw, { gameId });
    await asBob.mutation(api.games.respondDraw, { gameId, accept: true });

    const view = await asAlice.query(api.games.get, { gameId });
    expect(view?.game.status).toBe("draw");
  });
});
