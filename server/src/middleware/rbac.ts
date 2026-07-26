import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

type Role = 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN' | 'SUPER_ADMIN';

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role as Role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }

    next();
  };
}
