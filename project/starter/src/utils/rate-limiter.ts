
/**
 * Rate Limiter for API requests and token usage.
 *
 * Uses a 60-second sliding window to track:
 * - Requests per minute
 * - Estimated tokens per minute
 * - Concurrent operations
 */

export interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxConcurrent: number;
}

export const DEFAULT_RATE_LIMITS: RateLimiterConfig = {
  maxRequestsPerMinute: 50,
  maxTokensPerMinute: 100000,
  maxConcurrent: 5
};

interface RequestRecord {
  timestamp: number;
  tokens: number;
}

const WINDOW_MS = 60000;
const MAX_WAIT_MS = 5000;
const WAIT_BUFFER_MS = 100;

/**
 * Sliding-window rate limiter.
 *
 * Each successful acquire() reserves one concurrent slot
 * and records the estimated token usage.
 *
 * Each successful acquire() must be paired with release().
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private requestHistory: RequestRecord[] = [];
  private activeRequests = 0;
  private waitQueue: Array<() => void> = [];

  /**
   * Prevents concurrent acquire() calls from reserving
   * the same available capacity.
   */
  private reservationLocked = false;
  private reservationQueue: Array<() => void> = [];

  /**
   * Records associated with active operations.
   */
  private activeRecords: RequestRecord[] = [];

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      ...DEFAULT_RATE_LIMITS,
      ...config
    };

    for (const [name, value] of Object.entries(this.config)) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(
          `Invalid rate limiter configuration: ${name} must be a positive integer.`
        );
      }
    }
  }

  /**
   * Validate token estimates.
   */
  private validateTokens(tokens: number): void {
    if (!Number.isSafeInteger(tokens) || tokens < 0) {
      throw new Error(
        'Token count must be a non-negative integer.'
      );
    }

    if (tokens > this.config.maxTokensPerMinute) {
      throw new Error(
        `Requested ${tokens} tokens, but the configured ` +
        `limit is ${this.config.maxTokensPerMinute} tokens per minute.`
      );
    }
  }

  /**
   * Sleep without blocking the event loop.
   */
  private sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, milliseconds);
    });
  }

  /**
   * Serialize the final capacity check and reservation.
   *
   * This ensures that concurrent acquire() calls cannot
   * both claim the same final available slot.
   */
  private async lockReservation(): Promise<void> {
    if (!this.reservationLocked) {
      this.reservationLocked = true;
      return;
    }

    await new Promise<void>(resolve => {
      this.reservationQueue.push(resolve);
    });
  }

  private unlockReservation(): void {
    const next = this.reservationQueue.shift();

    if (next) {
      next();
    } else {
      this.reservationLocked = false;
    }
  }

  /**
   * Acquire capacity for an operation.
   *
   * Waits for:
   * 1. A concurrent request slot
   * 2. Available requests-per-minute capacity
   * 3. Available tokens-per-minute capacity
   */
  async acquire(estimatedTokens: number = 1000): Promise<void> {
    this.validateTokens(estimatedTokens);

    while (true) {
      // Wait for concurrent capacity.
      while (this.activeRequests >= this.config.maxConcurrent) {
        await this.waitForSlot();
      }

      // Wait for sliding-window capacity.
      await this.waitForRateLimit(estimatedTokens);

      // Atomically check and reserve capacity.
      await this.lockReservation();

      try {
        if (!this.canProceed(estimatedTokens)) {
          continue;
        }

        const record: RequestRecord = {
          timestamp: Date.now(),
          tokens: estimatedTokens
        };

        this.activeRequests++;
        this.requestHistory.push(record);
        this.activeRecords.push(record);

        return;
      } finally {
        this.unlockReservation();
      }
    }
  }

  /**
   * Release a concurrent request slot.
   *
   * actualTokens optionally replaces the estimate
   * for the oldest currently active operation.
   *
   * For operations completing out of order, callers
   * should avoid supplying actualTokens unless they
   * can guarantee the corresponding acquisition order.
   */
  release(actualTokens?: number): void {
    if (this.activeRequests === 0) {
      return;
    }

    if (actualTokens !== undefined) {
      this.validateTokens(actualTokens);
    }

    this.activeRequests--;

    const completedRecord = this.activeRecords.shift();

    if (
      completedRecord !== undefined &&
      actualTokens !== undefined
    ) {
      completedRecord.tokens = actualTokens;
    }

    // Wake the next operation waiting for concurrency.
    const next = this.waitQueue.shift();

    if (next) {
      next();
    }
  }

  /**
   * Return the current limiter status.
   */
  getStatus(): {
    activeRequests: number;
    requestsInWindow: number;
    tokensInWindow: number;
    availableRequests: number;
    availableTokens: number;
  } {
    this.pruneOldRecords();

    const requestsInWindow = this.requestHistory.length;

    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0
    );

    return {
      activeRequests: this.activeRequests,
      requestsInWindow,
      tokensInWindow,
      availableRequests: Math.max(
        0,
        this.config.maxRequestsPerMinute - requestsInWindow
      ),
      availableTokens: Math.max(
        0,
        this.config.maxTokensPerMinute - tokensInWindow
      )
    };
  }

  /**
   * Check whether an operation can start immediately.
   */
  canProceed(estimatedTokens: number = 1000): boolean {
    this.validateTokens(estimatedTokens);

    this.pruneOldRecords();

    const concurrentAvailable =
      this.activeRequests < this.config.maxConcurrent;

    const requestsAvailable =
      this.requestHistory.length < this.config.maxRequestsPerMinute;

    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0
    );

    const tokensAvailable =
      tokensInWindow + estimatedTokens <=
      this.config.maxTokensPerMinute;

    return (
      concurrentAvailable &&
      requestsAvailable &&
      tokensAvailable
    );
  }

  /**
   * Wait for a concurrent request slot.
   *
   * release() wakes queued operations.
   */
  private async waitForSlot(): Promise<void> {
    if (this.activeRequests < this.config.maxConcurrent) {
      return;
    }

    await new Promise<void>(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Wait for requests-per-minute and tokens-per-minute
   * capacity within the sliding window.
   *
   * Concurrency is handled separately by waitForSlot().
   */
  private async waitForRateLimit(
    estimatedTokens: number
  ): Promise<void> {
    while (true) {
      this.pruneOldRecords();

      const requestsInWindow = this.requestHistory.length;

      const tokensInWindow = this.requestHistory.reduce(
        (sum, record) => sum + record.tokens,
        0
      );

      const requestsAvailable =
        requestsInWindow < this.config.maxRequestsPerMinute;

      const tokensAvailable =
        tokensInWindow + estimatedTokens <=
        this.config.maxTokensPerMinute;

      if (requestsAvailable && tokensAvailable) {
        return;
      }

      const oldestRequest = this.requestHistory[0];

      if (oldestRequest === undefined) {
        return;
      }

      const expirationTime =
        oldestRequest.timestamp + WINDOW_MS;

      const remainingTime =
        expirationTime - Date.now() + WAIT_BUFFER_MS;

      const waitTime = Math.min(
        MAX_WAIT_MS,
        Math.max(100, remainingTime)
      );

      await this.sleep(waitTime);
    }
  }

  /**
   * Remove records older than the sliding window.
   */
  private pruneOldRecords(): void {
    const cutoff = Date.now() - WINDOW_MS;

    this.requestHistory = this.requestHistory.filter(
      record => record.timestamp > cutoff
    );
  }
}

/**
 * Execute an asynchronous operation with rate limiting.
 *
 * The acquired slot is always released, including when
 * the wrapped operation throws an error.
 */
export async function withRateLimit<T>(
  rateLimiter: RateLimiter,
  fn: () => Promise<T>,
  estimatedTokens: number = 1000
): Promise<T> {
  await rateLimiter.acquire(estimatedTokens);

  try {
    return await fn();
  } finally {
    rateLimiter.release();
  }
}

/**
 * Shared rate limiter instance.
 */
export const globalRateLimiter = new RateLimiter();
