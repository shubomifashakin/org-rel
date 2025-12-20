export type FnResult<T> =
  | { status: true; data: T; error: null }
  | { status: false; data: null; error: string };
