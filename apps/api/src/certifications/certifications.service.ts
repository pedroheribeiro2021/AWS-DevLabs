import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CertificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.client.certification.findMany({
      where: { isActive: true },
      include: {
        examVersions: {
          where: { isCurrent: true },
        },
      },
    });
  }
}
