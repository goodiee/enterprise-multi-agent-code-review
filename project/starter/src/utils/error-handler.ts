
/**
 * Custom error class for review operations.
 */
export class ReviewError extends Error {
  constructor(
    message: string,
    public code: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReviewError';

    Object.setPrototypeOf(this, ReviewError.prototype);

    Error.captureStackTrace?.(this, ReviewError);
  }
}

/**
 * Error codes for the review system.
 */
export const ErrorCodes = {
  // Configuration errors
  MISSING_API_KEY: 'MISSING_API_KEY',
  MISSING_GITHUB_TOKEN: 'MISSING_GITHUB_TOKEN',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // GitHub errors
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Agent errors
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_FAILED: 'AGENT_FAILED',
  STRUCTURED_OUTPUT_FAILED: 'STRUCTURED_OUTPUT_FAILED',

  // General errors
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode =
  typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Wait asynchronously for the specified number of milliseconds.
 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Retry an asynchronous operation using exponential backoff.
 *
 * maxRetries is the number of retries AFTER the initial attempt.
 *
 * Example:
 * maxRetries = 3
 * Total possible attempts = 4
 *
 * Delay before retry:
 * Retry 1: delayMs * 2^0 + jitter
 * Retry 2: delayMs * 2^1 + jitter
 * Retry 3: delayMs * 2^2 + jitter
 *
 * Jitter adds a random delay between 0 and 100 ms.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  if (
    !Number.isSafeInteger(maxRetries) ||
    maxRetries < 0
  ) {
    throw new ReviewError(
      'maxRetries must be a non-negative integer.',
      ErrorCodes.INVALID_CONFIG,
      { maxRetries }
    );
  }

  if (
    !Number.isFinite(delayMs) ||
    delayMs < 0
  ) {
    throw new ReviewError(
      'delayMs must be a non-negative number.',
      ErrorCodes.INVALID_CONFIG,
      { delayMs }
    );
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // No retries remain.
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff.
      const backoff = delayMs * Math.pow(2, attempt);

      // Random jitter between 0 and 100 ms.
      const jitter = Math.random() * 100;

      const waitTime = backoff + jitter;

      console.warn(
        `[Retry] Attempt ${attempt + 1} failed. ` +
        `Retrying in ${Math.round(waitTime)} ms. ` +
        `Error: ${formatError(error)}`
      );

      await sleep(waitTime);
    }
  }

  throw new ReviewError(
    `Operation failed after ${maxRetries + 1} attempts: ` +
    formatError(lastError),
    ErrorCodes.RETRY_EXHAUSTED,
    {
      attempts: maxRetries + 1,
      maxRetries,
      lastError: formatError(lastError)
    }
  );
}

/**
 * Wrap an asynchronous operation with a timeout.
 *
 * Promise.race returns or rejects with whichever promise
 * settles first.
 *
 * Note: timing out does not cancel the underlying operation.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  ) {
    throw new ReviewError(
      'timeoutMs must be a positive number.',
      ErrorCodes.INVALID_CONFIG,
      { timeoutMs }
    );
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new ReviewError(
          `${errorMessage} after ${timeoutMs} ms`,
          ErrorCodes.AGENT_TIMEOUT,
          { timeoutMs }
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      timeoutPromise
    ]);
  } finally {
    // Prevent the timer from remaining active when
    // the operation finishes before the timeout.
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Check whether an unknown error is a ReviewError.
 */
export function isReviewError(
  error: unknown
): error is ReviewError {
  return error instanceof ReviewError;
}

/**
 * Format an error for logging or display.
 */
export function formatError(error: unknown): string {
  if (isReviewError(error)) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
