export type Vec = [number, number];

/** Action codes, in the order used for Q-table columns before state sorting. */
export const ACTIONS = ["U", "D", "L", "R"] as const;
export type Action = (typeof ACTIONS)[number];

/** Direction vectors as [dx, dy]; index-aligned with ACTIONS. */
export const DIRECTIONS: readonly Vec[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** Vision cell types, used to compute the state index. "g" = green apple further away. */
export const VALUES = { "0": 0, G: 1, R: 2, S: 3, g: 4 } as const;
export const VALUES_COUNT = Object.keys(VALUES).length;

export const REWARDS = { "0": -5, G: 1000, R: -100, L: -1000, g: 200 } as const;

export const APPLE_CODES = ["G", "R"] as const;

/** Board cell codes: empty, head, body, green apple, red apple. */
export type Cell = "0" | "H" | "S" | "G" | "R";

export type EatResult = "0" | "G" | "R" | "L";

export function directionIndex(direction: Vec): number {
  return DIRECTIONS.findIndex(
    (d) => d[0] === direction[0] && d[1] === direction[1],
  );
}

/** `math.comb` — returns 0 when k > n, like Python. */
export function comb(n: number, k: number): number {
  if (k < 0 || n < 0) throw new RangeError("comb() arguments must be non-negative");
  if (k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return Math.round(result);
}
