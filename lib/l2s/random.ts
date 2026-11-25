/**
 * Mersenne Twister (MT19937) that reproduces CPython's `random` module for the
 * calls used by learn2slither (`seed(int)`, `randint`, `randrange`, `random`).
 *
 * Matching CPython exactly means replay files (.rpl) recorded by the Python
 * version play back identically here: apple respawns are driven by the seed
 * stored in the replay.
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

export class PyRandom {
  private mt = new Uint32Array(N);
  private mti = N + 1;

  constructor(seed?: number) {
    this.seed(seed ?? PyRandom.entropy());
  }

  /** A random 32-bit seed taken from the platform's entropy source. */
  static entropy(): number {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return Math.floor(Math.random() * 0x100000000);
  }

  /** Equivalent of `random.seed(n)` for a non-negative integer n < 2**53. */
  seed(n: number): void {
    let value = Math.floor(Math.abs(n));
    const key: number[] = [];
    do {
      key.push(value % 0x100000000);
      value = Math.floor(value / 0x100000000);
    } while (value > 0);
    this.initByArray(key);
  }

  private initGenrand(s: number): void {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < N; i++) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.mti = N;
  }

  private initByArray(key: number[]): void {
    const mt = this.mt;
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(N, key.length); k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1664525)) >>> 0) + key[j] + j;
      i++;
      j++;
      if (i >= N) {
        mt[0] = mt[N - 1];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1566083941)) >>> 0) - i;
      i++;
      if (i >= N) {
        mt[0] = mt[N - 1];
        i = 1;
      }
    }
    mt[0] = 0x80000000;
  }

  private genrandUint32(): number {
    const mt = this.mt;
    let y: number;
    if (this.mti >= N) {
      let kk = 0;
      for (; kk < N - M; kk++) {
        y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
        mt[kk] = mt[kk + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      for (; kk < N - 1; kk++) {
        y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
        mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      y = (mt[N - 1] & UPPER_MASK) | (mt[0] & LOWER_MASK);
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      this.mti = 0;
    }
    y = mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** `random.getrandbits(k)` for 0 < k <= 32. */
  private getrandbits(k: number): number {
    return this.genrandUint32() >>> (32 - k);
  }

  /** CPython's `_randbelow_with_getrandbits(n)`. */
  private randbelow(n: number): number {
    if (n <= 0) return 0;
    const k = 32 - Math.clz32(n); // n.bit_length()
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return r;
  }

  /** `random.randrange(stop)` or `random.randrange(start, stop)`. */
  randrange(start: number, stop?: number): number {
    if (stop === undefined) return this.randbelow(start);
    return start + this.randbelow(stop - start);
  }

  /** `random.randint(a, b)` — inclusive on both ends. */
  randint(a: number, b: number): number {
    return a + this.randbelow(b - a + 1);
  }

  /** `random.random()` / `random.uniform(0, 1)` — float in [0, 1). */
  random(): number {
    const a = this.genrandUint32() >>> 5;
    const b = this.genrandUint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }
}
