// Every error the API returns has the same shape: { code, message }.
// The frontend can switch on `code` and show `message` to the user.

const STATUS = {
  "bad-request": 400,
  unauthenticated: 401,
  "permission-denied": 403,
  "not-found": 404,
  "invalid-state": 409,
  "already-active": 409,
  "limit-reached": 409,
  "slot-taken": 409,
  expired: 410,
  "lot-closed": 422,
  "rate-limited": 429,
  internal: 500,
};

export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = STATUS[code] ?? 400;
  }
}

export const fail = (code, message) => { throw new AppError(code, message); };

/** Wraps an async route so thrown errors reach the error handler. */
export const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) return res.status(err.status).json({ code: err.code, message: err.message });
  if (err?.name === "CastError" || err?.name === "ValidationError") {
    return res.status(400).json({ code: "bad-request", message: "Some of the data sent is not valid." });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ code: "bad-request", message: "The request body is not valid JSON." });
  }
  console.error(err);
  res.status(500).json({ code: "internal", message: "Something went wrong on the server. Please try again." });
}
