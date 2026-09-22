// convex/__tests__/queue.test.ts
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

describe("queue.join / leave / myStatus", () => {
  it("joining puts the player in the queue", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    await asAlice.mutation(api.queue.join, {});
    const status = await asAlice.query(api.queue.myStatus, {});
    expect(status.inQueue).toBe(true);
    expect(status.joinedAt).not.toBeNull();
  });

  it("joining twice is a no-op, not a second row", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    await asAlice.mutation(api.queue.join, {});
    const first = await asAlice.query(api.queue.myStatus, {});
    await asAlice.mutation(api.queue.join, {});
    const second = await asAlice.query(api.queue.myStatus, {});
    expect(second.joinedAt).toBe(first.joinedAt);
  });

  it("leave removes the player from the queue", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    await asAlice.mutation(api.queue.join, {});
    await asAlice.mutation(api.queue.leave, {});
    const status = await asAlice.query(api.queue.myStatus, {});
    expect(status.inQueue).toBe(false);
  });

  it("a signed-out caller is never in the queue", async () => {
    const t = convexTest(schema, modules);
    const status = await t.query(api.queue.myStatus, {});
    expect(status).toEqual({ inQueue: false, joinedAt: null });
  });

  it("joining while already in an active game throws", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    await asAlice.mutation(api.games.createLocalGame, {});
    await expect(asAlice.mutation(api.queue.join, {})).rejects.toThrow("already-in-game");
  });
});

describe("queue.pair (internal)", () => {
  it("pairs two waiting players into a new active online game", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const asBob = await withPlayer(t, "user_bob", "bob");

    await asAlice.mutation(api.queue.join, {});
    await asBob.mutation(api.queue.join, {});
    // join() already schedules `pair`, but the scheduled run hasn't executed in
    // this same synchronous test tick; run it directly rather than depend on
    // the scheduler, so the assertion isn't a race against fake-timer plumbing.
    await t.mutation(internal.queue.pair, {});

    const aliceStatus = await asAlice.query(api.queue.myStatus, {});
    const bobStatus = await asBob.query(api.queue.myStatus, {});
    expect(aliceStatus.inQueue).toBe(false);
    expect(bobStatus.inQueue).toBe(false);

    const aliceGameId = await asAlice.query(api.games.myActiveGame, {});
    const bobGameId = await asBob.query(api.games.myActiveGame, {});
    expect(aliceGameId).not.toBeNull();
    expect(aliceGameId).toBe(bobGameId);

    const view = await asAlice.query(api.games.get, { gameId: aliceGameId! });
    expect(view?.game.mode).toBe("online");
    expect(view?.game.status).toBe("active");
  });

  it("does not pair a lone waiting player with themselves", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    await asAlice.mutation(api.queue.join, {});
    await t.mutation(internal.queue.pair, {});
    const status = await asAlice.query(api.queue.myStatus, {});
    expect(status.inQueue).toBe(true);
  });

  it("does not pair two players whose ratings are outside the current window", async () => {
    const t = convexTest(schema, modules);
    const asAlice = await withPlayer(t, "user_alice", "alice");
    const asBob = await withPlayer(t, "user_bob", "bob");
    // Push Bob's rating far away from the fresh-account default of 1200 before
    // he joins, so the initial (narrowest) window rejects the pairing.
    await t.run(async (ctx) => {
      const bob = await ctx.db
        .query("players")
        .withIndex("by_usernameLower", (q) => q.eq("usernameLower", "bob"))
        .unique();
      if (bob) await ctx.db.patch("players", bob._id, { ratingHuman: 2600 });
    });

    await asAlice.mutation(api.queue.join, {});
    await asBob.mutation(api.queue.join, {});
    await t.mutation(internal.queue.pair, {});

    const aliceStatus = await asAlice.query(api.queue.myStatus, {});
    expect(aliceStatus.inQueue).toBe(true);
  });
});
