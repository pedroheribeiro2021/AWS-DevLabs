import type { User } from '@aws-devlab/database';

export type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'createdAt'>;

export function toPublicUser(user: User): PublicUser {
  const { id, email, name, role, createdAt } = user;
  return { id, email, name, role, createdAt };
}
