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
        'Certificação AWS focada em desenvolver, publicar e depurar aplicações na nuvem AWS.',
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

  const domain = await prisma.domain.upsert({
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
      // Nome oficial do domínio no exam guide da AWS (mantido em inglês, como no
      // documento oficial); o conteúdo dentro dele é ensinado em português.
      name: 'Development with AWS Services',
      weightPercent: 32,
      order: 1,
    },
  });

  const lambdaService = await prisma.aWSService.upsert({
    where: { name: 'AWS Lambda' },
    update: {},
    create: {
      name: 'AWS Lambda',
      shortName: 'Lambda',
      category: 'Compute',
      description: 'Executa seu código sem provisionar ou gerenciar servidores, cobrado por invocação.',
    },
  });

  const topic =
    (await prisma.topic.findFirst({
      where: { domainId: domain.id, name: 'Fundamentos do AWS Lambda' },
    })) ??
    (await prisma.topic.create({
      data: {
        domainId: domain.id,
        name: 'Fundamentos do AWS Lambda',
        order: 1,
        learningObjectives: {
          create: [
            {
              description: 'Explicar o que é o AWS Lambda e quando usá-lo em vez de um servidor.',
              order: 1,
            },
            {
              description: 'Descrever o ciclo de vida de execução do Lambda, incluindo cold starts.',
              order: 2,
            },
          ],
        },
        concepts: {
          create: [
            {
              name: 'Cold start',
              description:
                'A latência adicional gerada quando o Lambda precisa inicializar um novo ambiente de execução antes de rodar seu código, em vez de reaproveitar um ambiente já "aquecido" (warm).',
              awsServices: { connect: { id: lambdaService.id } },
            },
          ],
        },
      },
    }));

  const existingLesson = await prisma.lesson.findFirst({
    where: { topicId: topic.id, title: 'O que é o AWS Lambda?' },
  });

  if (!existingLesson) {
    await prisma.lesson.create({
      data: {
        topicId: topic.id,
        order: 1,
        estimatedMinutes: 8,
        title: 'O que é o AWS Lambda?',
        content: `## Objetivo

Ao final desta lição você vai conseguir explicar o que é o AWS Lambda, por que ele existe e reconhecer o tipo de carga de trabalho em que ele é uma boa escolha.

## O que é

O AWS Lambda é um serviço de computação que executa seu código em resposta a eventos — uma requisição HTTP, um arquivo chegando no S3, uma mensagem numa fila — sem que você precise provisionar ou gerenciar servidores. Você envia uma função; a AWS cuida da infraestrutura, do escalonamento e dos patches.

## Por que ele existe

Servidores tradicionais (ou mesmo containers de longa duração) ficam ociosos entre uma requisição e outra, e você paga por esse tempo ocioso. O Lambda inverte esse modelo: você é cobrado por invocação e por milissegundo de execução, e ele escala de zero a milhares de execuções simultâneas automaticamente.

## Quando usar

Bom encaixe: tarefas curtas e orientadas a eventos — back-ends de API (via API Gateway), processamento de arquivos, jobs agendados, "cola" entre serviços da AWS.

Não é um bom encaixe: processos de longa duração (o Lambda tem um timeout máximo de execução de 15 minutos), cargas que precisam manter estado em memória entre requisições, ou latência ultra baixa e consistente sob throughput muito alto e sustentado (onde uma frota de servidores já aquecida pode sair mais barata e previsível).

## Cold starts

Na primeira vez que uma função roda (ou depois de ficar ociosa), o Lambda precisa inicializar um novo ambiente de execução antes de rodar seu código — isso é um "cold start" e adiciona latência. Invocações seguintes que reaproveitam esse mesmo ambiente ("warm") pulam essa inicialização. Isso importa para APIs sensíveis a latência e é um tópico recorrente na prova: cold starts ficam mais perceptíveis com pacotes de deployment maiores, funções conectadas a uma VPC, e runtimes com inicialização mais pesada.

## Relação com a prova DVA-C03

Fundamentos de Lambda aparecem em todo o domínio "Development with AWS Services" — espere questões de cenário sobre escolher Lambda vs. EC2/containers, e sobre diagnosticar latência causada por cold starts.`,
        resources: {
          create: [
            {
              title: 'AWS Lambda — documentação oficial',
              url: 'https://docs.aws.amazon.com/lambda/latest/dg/welcome.html',
              type: 'documentation',
              order: 1,
            },
          ],
        },
      },
    });
  }

  console.log('Seed done:', {
    certification: certification.slug,
    examVersion: examVersion.code,
    topic: topic.name,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
