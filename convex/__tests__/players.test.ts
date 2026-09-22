// convex/__tests__/players.test.ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function t() {
  return convexTest(schema, modules);
}

describe("players.ensurePlayer", () => {
  it("creates a new player row from a Clerk identity", async () => {
    const asAlice = t().withIdentity({ subject: "user_alice", nickname: "alice" });
    const playerId = await asAlice.mutation(api.players.ensurePlayer, {});
    const me = await asAlice.query(api.players.me, {});
    expect(me?._id).toBe(playerId);
    expect(me?.username).toBe("alice");
    expect(me?.rating).toBe(1200);
    expect(me?.wins).toBe(0);
  });

  it("is idempotent: calling it again returns the same row, not a duplicate", async () => {
    const asAlice = t().withIdentity({ subject: "user_alice", nickname: "alice" });
    const first = await asAlice.mutation(api.players.ensurePlayer, {});
    const second = await asAlice.mutation(api.players.ensurePlayer, {});
    expect(second).toBe(first);
  });

  it("disambiguates two different Clerk accounts that share a display name", async () => {
    const instance = t();
    const asAlice1 = instance.withIdentity({ subject: "user_1", nickname: "alice" });
    const asAlice2 = instance.withIdentity({ subject: "user_2", nickname: "alice" });
    await asAlice1.mutation(api.players.ensurePlayer, {});
    await asAlice2.mutation(api.players.ensurePlayer, {});
    const me1 = await asAlice1.query(api.players.me, {});
    const me2 = await asAlice2.query(api.players.me, {});
    // Both provisioned, and NOT sharing a username: by_usernameLower must stay unique.
    expect(me1?.username).not.toBe(me2?.username);
  });
});

describe("players.me", () => {
  it("returns null when signed out", async () => {
    const me = await t().query(api.players.me, {});
    expect(me).toBeNull();
  });

  it("returns null when signed in but not yet provisioned", async () => {
    const asAlice = t().withIdentity({ subject: "user_alice", nickname: "alice" });
    const me = await asAlice.query(api.players.me, {});
    expect(me).toBeNull();
  });
});

describe("players.getByUsername", () => {
  it("resolves a provisioned player by username, case-insensitively", async () => {
    const instance = t();
    const asAlice = instance.withIdentity({ subject: "user_alice", nickname: "Alice" });
    await asAlice.mutation(api.players.ensurePlayer, {});

    const anon = instance;
    const profile = await anon.query(api.players.getByUsername, { username: "alice" });
    expect(profile?.username).toBe("Alice");
  });

  it("returns null for a username nobody has", async () => {
    const profile = await t().query(api.players.getByUsername, { username: "nobody" });
    expect(profile).toBeNull();
  });
});

describe("players.updateSettings", () => {
  it("rejects a non-hex colour", async () => {
    const asAlice = t().withIdentity({ subject: "user_alice", nickname: "alice" });
    await asAlice.mutation(api.players.ensurePlayer, {});
    await expect(
      asAlice.mutation(api.players.updateSettings, {
        roomPreset: "custom",
        roomColors: { background: "not-a-colour", lightSquare: "#ffffff", darkSquare: "#000000" },
      }),
    ).rejects.toThrow("invalid-colour");
  });

  it("accepts valid hex colours", async () => {
    const asAlice = t().withIdentity({ subject: "user_alice", nickname: "alice" });
    await asAlice.mutation(api.players.ensurePlayer, {});
    await asAlice.mutation(api.players.updateSettings, {
      roomPreset: "custom",
      roomColors: { background: "#111111", lightSquare: "#eeeeee", darkSquare: "#222222" },
    });
    const me = await asAlice.query(api.players.me, {});
    expect(me?.roomColors).toEqual({ background: "#111111", lightSquare: "#eeeeee", darkSquare: "#222222" });
  });
});
