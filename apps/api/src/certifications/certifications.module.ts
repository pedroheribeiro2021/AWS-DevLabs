import { Module } from '@nestjs/common';
import { CertificationsController } from './certifications.controller.js';
import { CertificationsService } from './certifications.service.js';

@Module({
  controllers: [CertificationsController],
  providers: [CertificationsService],
})
export class CertificationsModule {}
