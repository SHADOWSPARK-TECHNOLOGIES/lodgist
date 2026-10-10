export declare const REQUEST_TIMEOUT_MS: number;
export declare const TIMEOUT_MESSAGE: string;
export declare function timeoutSignal(
  callerSignal?: AbortSignal | null,
  ms?: number,
): { signal: AbortSignal; timedOut: () => boolean; cleanup: () => void };
export declare function isAbortError(err: unknown): boolean;
export declare function isValidListingId(value: unknown): value is string;
