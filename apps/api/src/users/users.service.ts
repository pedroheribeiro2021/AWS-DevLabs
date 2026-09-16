import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.client.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  create(data: { email: string; passwordHash: string; name: string }) {
    return this.prisma.client.user.create({ data });
  }

  setHashedRefreshToken(userId: string, hashedRefreshToken: string | null) {
    return this.prisma.client.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }
}
