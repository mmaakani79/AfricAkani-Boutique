/** Rejects if `promise` has not settled within `ms`. The underlying work is not
 *  cancelled (a server action can't be): it may still finish, which is why the
 *  order submission is idempotent — see order-replay.ts. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`No answer after ${ms} ms.`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
