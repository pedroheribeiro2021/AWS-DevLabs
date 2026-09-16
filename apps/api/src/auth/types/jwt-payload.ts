import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
