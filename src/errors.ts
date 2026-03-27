/** Base error class for Critic API errors. */
export class CriticError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "CriticError";
    this.status = status;
    this.body = body;
  }
}

/** Thrown when the API returns 401 or 403. */
export class AuthError extends CriticError {
  constructor(message: string, status: number, body?: unknown) {
    super(message, status, body);
    this.name = "AuthError";
  }
}
