export interface AuthenticatedUser {
  id: number;
  email: string;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: AuthenticatedUser;
    }
  }
}
