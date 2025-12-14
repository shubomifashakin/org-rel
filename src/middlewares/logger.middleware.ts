import { Request, Response, NextFunction } from 'express';

export function logger(req: Request, _: Response, next: NextFunction) {
  console.log(
    JSON.stringify({
      path: req.originalUrl,
      method: req.method,
    }),
  );
  next();
}
