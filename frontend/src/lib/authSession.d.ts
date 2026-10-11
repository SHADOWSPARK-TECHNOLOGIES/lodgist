import type { User } from "./types";
export type AuthSessionUser = Pick<User, "id" | "email" | "name" | "role" | "isHNW">;
export declare function authSessionFromResponse(body: unknown): { token: string; user: AuthSessionUser } | null;
export declare const LOGIN_FAILED: string;
export declare function completeLogin(
  callLogin: () => Promise<unknown>,
  signIn: (session: { token: string; user: AuthSessionUser }) => void,
): Promise<{ token: string; user: AuthSessionUser }>;
