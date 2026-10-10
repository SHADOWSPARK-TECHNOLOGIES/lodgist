export declare const AUTH_ERRORS: { loginFailed: string; registerFailed: string; tooMany: string; network: string };
export declare function authErrorMessage(err: unknown, kind: "login" | "register"): { message: string; signInLink: boolean };
