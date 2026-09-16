import 'dotenv/config';
import { prisma } from '../src/index.js';

async function main() {
  const certification = await prisma.certification.upsert({
    where: { slug: 'aws-certified-developer-associate' },
    update: {},
    create: {
      slug: 'aws-certified-developer-associate',
      name: 'AWS Certified Developer – Associate',
      description:
        'Certificação AWS focada em desenvolvimento, deployment e debugging de aplicações na nuvem AWS.',
    },
  });

  const examVersion = await prisma.examVersion.upsert({
    where: {
      certificationId_code: {
        certificationId: certification.id,
        code: 'DVA-C03',
      },
    },
    update: {},
    create: {
      certificationId: certification.id,
      code: 'DVA-C03',
      questionCount: 65,
      durationMinutes: 130,
      passingScorePercent: 72,
      isCurrent: true,
    },
  });

  await prisma.domain.upsert({
    where: {
      examVersionId_code: {
        examVersionId: examVersion.id,
        code: 'domain-1',
      },
    },
    update: {},
    create: {
      examVersionId: examVersion.id,
      code: 'domain-1',
      name: 'Development with AWS Services',
      weightPercent: 32,
      order: 1,
    },
  });

  console.log('Seed concluído:', { certification: certification.slug, examVersion: examVersion.code });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
