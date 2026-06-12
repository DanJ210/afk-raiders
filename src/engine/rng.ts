/**
 * Seeded pseudo-random number generator using the mulberry32 algorithm.
 * All engine randomness flows through this — Math.random() is banned in src/engine/.
 */

export interface WeightedItem<T> {
  weight: number
  value: T
}

export class RNG {
  private seed: number

  constructor(seed: number) {
    this.seed = seed >>> 0 // ensure 32-bit unsigned
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.seed += 0x6d2b79f5
    let z = this.seed
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }

  /** Returns an integer in [min, max] (inclusive) */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /** Returns a random element from an array */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error('RNG.pick called on empty array')
    return array[Math.floor(this.next() * array.length)]
  }

  /**
   * Returns a random element from a weighted array.
   * Items must have a `weight: number` field; higher weight = more likely.
   */
  weightedPick<T extends { weight: number }>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('RNG.weightedPick called on empty array')
    const total = items.reduce((sum, item) => sum + item.weight, 0)
    let threshold = this.next() * total
    for (const item of items) {
      threshold -= item.weight
      if (threshold <= 0) return item
    }
    return items[items.length - 1]
  }

  /** Clones the RNG at its current state — useful for branching simulations */
  clone(): RNG {
    return new RNG(this.seed)
  }

  /** Returns the current seed value (for serialisation) */
  getSeed(): number {
    return this.seed
  }
}

/** Creates an RNG from a numeric seed */
export function createRNG(seed: number): RNG {
  return new RNG(seed)
}
