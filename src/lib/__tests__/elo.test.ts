// src/lib/__tests__/elo.test.ts
import { describe, expect, it } from "vitest";
import {
  aiRatingDelta,
  applyDelta,
  expectedScore,
  K_AI,
  K_ONLINE,
  MIN_RATING,
  onlineRatings,
  ratingDelta,
  START_RATING,
} from "../elo";

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  it("favours the higher-rated player", () => {
    expect(expectedScore(1600, 1200)).toBeGreaterThan(0.5);
    expect(expectedScore(1200, 1600)).toBeLessThan(0.5);
  });

  it("is symmetric: the two expected scores sum to 1", () => {
    const a = expectedScore(1450, 1300);
    const b = expectedScore(1300, 1450);
    expect(a + b).toBeCloseTo(1, 5);
  });
});

describe("ratingDelta", () => {
  it("is positive when a lower-rated player wins", () => {
    const delta = ratingDelta(1200, 1600, 1, K_ONLINE);
    expect(delta).toBeGreaterThan(0);
  });

  it("is negative when a higher-rated player loses", () => {
    const delta = ratingDelta(1600, 1200, 0, K_ONLINE);
    expect(delta).toBeLessThan(0);
  });

  it("is zero for a draw between equal ratings", () => {
    expect(ratingDelta(1200, 1200, 0.5, K_ONLINE)).toBe(0);
  });

  it("scales with K", () => {
    const online = ratingDelta(1200, 1200, 1, K_ONLINE);
    const ai = ratingDelta(1200, 1200, 1, K_AI);
    expect(online).toBe(K_ONLINE / 2);
    expect(ai).toBe(K_AI / 2);
  });
});

describe("applyDelta", () => {
  it("adds the delta normally", () => {
    expect(applyDelta(1200, 16)).toBe(1216);
    expect(applyDelta(1200, -16)).toBe(1184);
  });

  it("floors at MIN_RATING rather than going negative", () => {
    expect(applyDelta(MIN_RATING, -50)).toBe(MIN_RATING);
    expect(applyDelta(120, -1000)).toBe(MIN_RATING);
  });
});

describe("onlineRatings", () => {
  it("gives the winner a positive delta and the loser a negative one", () => {
    const { whiteDelta, blackDelta } = onlineRatings(1200, 1200, "w");
    expect(whiteDelta).toBeGreaterThan(0);
    expect(blackDelta).toBeLessThan(0);
  });

  it("is symmetric for a draw between equal ratings", () => {
    const { whiteDelta, blackDelta } = onlineRatings(1400, 1400, "draw");
    expect(whiteDelta).toBe(0);
    expect(blackDelta).toBe(0);
  });

  it("gives an upset winner more points than a favourite winner", () => {
    const upset = onlineRatings(1200, 1600, "w").whiteDelta;
    const favourite = onlineRatings(1600, 1200, "w").whiteDelta;
    expect(upset).toBeGreaterThan(favourite);
  });
});

describe("aiRatingDelta", () => {
  it("uses the AI K-factor, not the online one", () => {
    const delta = aiRatingDelta(START_RATING, START_RATING, 1);
    expect(delta).toBe(K_AI / 2);
  });

  it("rewards beating a stronger AI more than beating a weaker one", () => {
    const beatStrong = aiRatingDelta(1200, 2000, 1);
    const beatWeak = aiRatingDelta(1200, 800, 1);
    expect(beatStrong).toBeGreaterThan(beatWeak);
  });
});
