import type { AdminRequestUser } from '../middlewares/auth.middleware.js';

declare module 'express-serve-static-core' {
  interface Request {
    adminUser?: AdminRequestUser;
  }
}
