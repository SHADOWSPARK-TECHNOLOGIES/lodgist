export declare const COMMIT_VARS: string[];
export declare function healthPayload(env?: Record<string, string | undefined> | null): {
  status: "ok";
  service: "lodgist-frontend";
  commit: string | null;
};
