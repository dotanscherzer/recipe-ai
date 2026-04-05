import { Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from './auth';

type AsyncAuthHandler = (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncAuthHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
  };
}
