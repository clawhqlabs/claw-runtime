export enum ErrorCode {
  Unauthorized = "UNAUTHORIZED",
  NotFound = "NOT_FOUND",
  BadRequest = "BAD_REQUEST",
  Conflict = "CONFLICT",
  InternalError = "INTERNAL_ERROR"
}

export type Response<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
