import 'dotenv/config';
import { prisma } from '../src/index.js';

/**
 * Creates a topic (with its single learning objective) if it doesn't exist yet,
 * or syncs its order and objective wording if it does -- shared by the two
 * "skeleton" topic loops below, which are otherwise identical in shape.
 */
async function upsertTopicWithObjective(
  domainId: string,
  name: string,
  order: number,
  objective: string,
) {
  const existingTopic = await prisma.topic.findFirst({ where: { domainId, name } });

  if (existingTopic) {
    await prisma.topic.update({ where: { id: existingTopic.id }, data: { order } });

    const existingObjective = await prisma.learningObjective.findFirst({
      where: { topicId: existingTopic.id },
    });
    if (existingObjective) {
      await prisma.learningObjective.update({
        where: { id: existingObjective.id },
        data: { description: objective },
      });
    } else {
      await prisma.learningObjective.create({
        data: { topicId: existingTopic.id, description: objective, order: 1 },
      });
    }
    return existingTopic;
  }

  return prisma.topic.create({
    data: {
      domainId,
      name,
      order,
      learningObjectives: { create: [{ description: objective, order: 1 }] },
    },
  });
}

type QuestionSeed = {
  prompt: string;
  type: 'KNOWLEDGE' | 'APPLICATION' | 'SCENARIO' | 'EXAM_LEVEL';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  explanation: string;
  officialReferences?: string;
  options: { text: string; isCorrect: boolean; explanation: string }[];
};

/**
 * Seeds a topic's questions with the update-or-create pattern: scalar fields
 * sync on reseed, options are only created once (see docs/Pendencias.md for
 * the nested-relation sync gap).
 */
async function seedQuestions(topicId: string, questions: QuestionSeed[]) {
  for (const q of questions) {
    const questionData = {
      type: q.type,
      difficulty: q.difficulty,
      explanation: q.explanation,
      officialReferences: q.officialReferences,
    };

    const existingQuestion = await prisma.question.findFirst({ where: { topicId, prompt: q.prompt } });

    if (existingQuestion) {
      await prisma.question.update({ where: { id: existingQuestion.id }, data: questionData });
    } else {
      await prisma.question.create({
        data: {
          topicId,
          prompt: q.prompt,
          ...questionData,
          options: {
            create: q.options.map((option, index) => ({
              text: option.text,
              isCorrect: option.isCorrect,
              explanation: option.explanation,
              order: index + 1,
            })),
          },
        },
      });
    }
  }
}

type FlashcardSeed = {
  conceptName: string;
  conceptDescription: string;
  serviceId: string;
  front: string;
  back: string;
};

/** Seeds one Concept + Flashcard per entry, update-or-create like seedQuestions. */
async function seedFlashcards(topicId: string, cards: FlashcardSeed[]) {
  for (const card of cards) {
    const existingConcept = await prisma.concept.findFirst({ where: { topicId, name: card.conceptName } });

    const concept = existingConcept
      ? await prisma.concept.update({
          where: { id: existingConcept.id },
          data: { description: card.conceptDescription },
        })
      : await prisma.concept.create({
          data: {
            topicId,
            name: card.conceptName,
            description: card.conceptDescription,
            awsServices: { connect: { id: card.serviceId } },
          },
        });

    const existingFlashcard = await prisma.flashcard.findFirst({
      where: { conceptId: concept.id, front: card.front },
    });

    if (existingFlashcard) {
      await prisma.flashcard.update({ where: { id: existingFlashcard.id }, data: { back: card.back } });
    } else {
      await prisma.flashcard.create({
        data: { conceptId: concept.id, front: card.front, back: card.back },
      });
    }
  }
}

type LessonSeed = {
  order: number;
  estimatedMinutes: number;
  title: string;
  content: string;
  resources: { title: string; url: string }[];
};

/**
 * Seeds a topic's lessons with the update-or-create pattern (matched by
 * title); resources are only created once, like question options.
 */
async function seedLessons(topicId: string, lessons: LessonSeed[]) {
  for (const lessonDef of lessons) {
    const existingLesson = await prisma.lesson.findFirst({ where: { topicId, title: lessonDef.title } });

    if (existingLesson) {
      await prisma.lesson.update({
        where: { id: existingLesson.id },
        data: { order: lessonDef.order, estimatedMinutes: lessonDef.estimatedMinutes, content: lessonDef.content },
      });
    } else {
      await prisma.lesson.create({
        data: {
          topicId,
          order: lessonDef.order,
          estimatedMinutes: lessonDef.estimatedMinutes,
          title: lessonDef.title,
          content: lessonDef.content,
          resources: {
            create: lessonDef.resources.map((resource, index) => ({
              ...resource,
              type: 'documentation',
              order: index + 1,
            })),
          },
        },
      });
    }
  }
}

type LabSeed = {
  title: string;
  data: {
    level: number;
    order: number;
    estimatedMinutes: number;
    objective: string;
    prerequisites: string;
    context: string;
    troubleshooting: string;
    cleanup: string;
    costWarning: string;
  };
  steps: { order: number; title: string; instructions: string; validation: string }[];
};

/** Seeds a topic's labs (matched by title); steps are only created once. */
async function seedLabs(topicId: string, labs: LabSeed[]) {
  for (const labDef of labs) {
    const existingLab = await prisma.lab.findFirst({ where: { topicId, title: labDef.title } });

    if (existingLab) {
      await prisma.lab.update({ where: { id: existingLab.id }, data: labDef.data });
    } else {
      await prisma.lab.create({
        data: { topicId, title: labDef.title, ...labDef.data, steps: { create: labDef.steps } },
      });
    }
  }
}

async function main() {
  // Every upsert below passes the same fields to `update` and `create` (rather
  // than `update: {}`), so a wording/value edit made here actually reaches an
  // already-seeded database on the next `pnpm db:seed` run. See Session 15 for
  // the near-miss this generalizes: the Lambda lesson's DVA-C03 -> DVA-C02
  // rename landed in this file but silently never reached the seeded row,
  // because its block only ever `create`d.
  const certificationData = {
    name: 'AWS Certified Developer – Associate',
    description: 'Certificação AWS focada em desenvolver, publicar e depurar aplicações na nuvem AWS.',
  };
  const certification = await prisma.certification.upsert({
    where: { slug: 'aws-certified-developer-associate' },
    update: certificationData,
    create: { slug: 'aws-certified-developer-associate', ...certificationData },
  });

  const examVersionData = {
    questionCount: 65,
    durationMinutes: 130,
    passingScorePercent: 72,
    isCurrent: true,
  };
  const examVersion = await prisma.examVersion.upsert({
    where: {
      certificationId_code: {
        certificationId: certification.id,
        code: 'DVA-C02',
      },
    },
    update: examVersionData,
    create: { certificationId: certification.id, code: 'DVA-C02', ...examVersionData },
  });

  const domainData = {
    // Nome oficial do domínio no exam guide da AWS (mantido em inglês, como no
    // documento oficial); o conteúdo dentro dele é ensinado em português.
    name: 'Development with AWS Services',
    weightPercent: 32,
    order: 1,
  };
  const domain = await prisma.domain.upsert({
    where: {
      examVersionId_code: {
        examVersionId: examVersion.id,
        code: 'domain-1',
      },
    },
    update: domainData,
    create: { examVersionId: examVersion.id, code: 'domain-1', ...domainData },
  });

  const lambdaServiceData = {
    shortName: 'Lambda',
    category: 'Compute',
    description: 'Executa seu código sem provisionar ou gerenciar servidores, cobrado por invocação.',
  };
  const lambdaService = await prisma.aWSService.upsert({
    where: { name: 'AWS Lambda' },
    update: lambdaServiceData,
    create: { name: 'AWS Lambda', ...lambdaServiceData },
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

  const lambdaLessonContent = `## Objetivo

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

## Relação com a prova DVA-C02

Fundamentos de Lambda aparecem em todo o domínio "Development with AWS Services" — espere questões de cenário sobre escolher Lambda vs. EC2/containers, e sobre diagnosticar latência causada por cold starts.`;

  const existingLesson = await prisma.lesson.findFirst({
    where: { topicId: topic.id, title: 'O que é o AWS Lambda?' },
  });

  if (existingLesson) {
    // Keeps previously-seeded content in sync with edits to this script (e.g. the
    // DVA-C03 -> DVA-C02 rename in Session 11 fixed the source here but never
    // reached the already-seeded row, since this block used to only ever `create`).
    await prisma.lesson.update({
      where: { id: existingLesson.id },
      data: { content: lambdaLessonContent },
    });
  } else {
    await prisma.lesson.create({
      data: {
        topicId: topic.id,
        order: 1,
        estimatedMinutes: 8,
        title: 'O que é o AWS Lambda?',
        content: lambdaLessonContent,
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

  const labData = {
    level: 1,
    order: 1,
    estimatedMinutes: 25,
    objective:
      'Ao final deste laboratório você terá criado uma função Lambda pelo Console da AWS, invocado ela manualmente e visualizado o resultado e os logs de execução.',
    prerequisites:
      'Conta AWS com acesso ao Console (Free Tier é suficiente). Nenhum conhecimento prévio de Lambda é necessário — a lição "O que é o AWS Lambda?" ajuda a entender o contexto, mas não é obrigatória para seguir os passos.',
    context:
      'Uma equipe de e-commerce precisa de uma função simples que, futuramente, vai calcular o frete de um pedido. Antes de integrar com o resto do sistema, o time quer validar o básico: criar a função, rodar ela manualmente e confirmar que ela responde como esperado.',
    troubleshooting:
      'Erro "Runtime.HandlerNotFound": confira se o nome do handler configurado na aba Runtime settings bate com o nome do arquivo e da função exportada (ex.: index.handler). \n\nFunção não aparece na lista após criar: confirme se está na mesma região da AWS em que criou a função (canto superior direito do Console). \n\nInvocação sem retorno visível: o resultado aparece na aba "Test" após clicar em "Test" novamente — role a página até a seção "Execution results".',
    cleanup:
      'Se não for reaproveitar a função, exclua-a: abra a função no Console, clique em "Actions" > "Delete function". Isso evita que ela apareça em listagens futuras sem necessidade (o custo de mantê-la parada é zero, mas manter o ambiente limpo ajuda em laboratórios futuros).',
    costWarning:
      'Fica dentro do Free Tier da AWS (1 milhão de invocações gratuitas por mês). Este laboratório usa poucas invocações manuais e não deixa nada rodando continuamente, então não deve gerar cobrança.',
  };

  const existingLab = await prisma.lab.findFirst({
    where: { topicId: topic.id, title: 'Criar e invocar sua primeira função Lambda' },
  });

  if (existingLab) {
    // Steps aren't synced here (a nested `create`, not a diffable list) -- only
    // this lab's own scalar fields. See the comment above certificationData.
    await prisma.lab.update({ where: { id: existingLab.id }, data: labData });
  } else {
    await prisma.lab.create({
      data: {
        topicId: topic.id,
        title: 'Criar e invocar sua primeira função Lambda',
        ...labData,
        steps: {
          create: [
            {
              order: 1,
              title: 'Criar a função',
              instructions:
                'No Console da AWS, acesse o serviço Lambda e clique em "Create function". Escolha "Author from scratch", dê o nome `calcula-frete-teste`, selecione o runtime Node.js 22.x (ou Python 3.13, se preferir) e mantenha a role de execução padrão sugerida pelo Console. Clique em "Create function".',
              validation:
                'A página da função abre automaticamente, mostrando o editor de código e o nome `calcula-frete-teste` no topo.',
            },
            {
              order: 2,
              title: 'Editar o código',
              instructions:
                'No editor de código embutido, substitua o conteúdo padrão pelo seguinte (ajuste a sintaxe se escolheu Python):\n\n```js\nexport const handler = async (event) => {\n  return {\n    statusCode: 200,\n    body: JSON.stringify({ message: "Frete calculado com sucesso", pedidoId: event.pedidoId ?? null }),\n  };\n};\n```\n\nClique em "Deploy" para publicar a alteração.',
              validation:
                'O botão "Deploy" mostra uma confirmação e o indicador de "Changes not deployed" desaparece.',
            },
            {
              order: 3,
              title: 'Testar a função',
              instructions:
                'Clique na aba "Test". Crie um novo test event com o nome `pedido-exemplo` e o corpo `{ "pedidoId": "123" }`. Clique em "Test" para invocar a função.',
              validation:
                'Na seção "Execution results", o status é "Succeeded" e o campo `body` da resposta contém `"pedidoId":"123"`.',
            },
            {
              order: 4,
              title: 'Observar os logs',
              instructions:
                'Ainda na página da função, acesse a aba "Monitor" e clique em "View CloudWatch logs". Abra o log stream mais recente.',
              validation:
                'Você consegue ver uma entrada `START RequestId: ...` seguida de `END` e `REPORT`, com a duração e a memória usada pela invocação.',
            },
          ],
        },
      },
    });
  }

  const questionsToSeed: {
    prompt: string;
    type: 'KNOWLEDGE' | 'APPLICATION' | 'SCENARIO' | 'EXAM_LEVEL';
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    explanation: string;
    officialReferences?: string;
    options: { text: string; isCorrect: boolean; explanation: string }[];
  }[] = [
    {
      prompt: 'Qual das alternativas descreve corretamente o modelo de cobrança do AWS Lambda?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'O Lambda cobra por invocação e pelo tempo de execução (arredondado em milissegundos), além da memória alocada. Não há cobrança por servidor ocioso, porque não existe servidor dedicado esperando requisições.',
      officialReferences: 'https://aws.amazon.com/lambda/pricing/',
      options: [
        {
          text: 'Você paga por hora, independentemente de quantas vezes a função é invocada.',
          isCorrect: false,
          explanation:
            'Esse é o modelo de instâncias EC2 sob demanda, não o do Lambda. O Lambda não tem uma unidade de cobrança por hora de servidor ligado.',
        },
        {
          text: 'Você paga por invocação e pelo tempo de execução, em milissegundos.',
          isCorrect: true,
          explanation:
            'Correto: o Lambda cobra por número de invocações e pela duração de cada execução (multiplicada pela memória alocada), o que é a base do modelo "pague pelo que usar" do serverless.',
        },
        {
          text: 'Você paga apenas uma taxa fixa mensal por função criada.',
          isCorrect: false,
          explanation:
            'Não existe taxa fixa por função criada; criar uma função e nunca invocá-la não gera custo de execução.',
        },
        {
          text: 'O Lambda é sempre gratuito, independentemente do uso.',
          isCorrect: false,
          explanation:
            'O Free Tier cobre 1 milhão de invocações e 400.000 GB-segundos de computação por mês, mas uso acima disso é cobrado normalmente.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda que processa pedidos ocasionalmente demora bem mais para responder do que o normal, mas isso acontece apenas na primeira chamada após um período sem uso. Qual é a causa mais provável?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'O padrão descrito — lentidão isolada na primeira chamada após um período ocioso — é a assinatura clássica de um cold start: o Lambda precisa inicializar um novo ambiente de execução antes de rodar o código. Chamadas seguintes reaproveitam esse ambiente ("warm") e voltam ao tempo normal.',
      options: [
        {
          text: 'Cold start: o Lambda precisa inicializar um novo ambiente de execução.',
          isCorrect: true,
          explanation:
            'Correto: cold starts acontecem justamente quando não há um ambiente "warm" disponível, o que bate com o padrão de lentidão só na primeira chamada após ociosidade.',
        },
        {
          text: 'Throttling por exceder o limite de concorrência da conta.',
          isCorrect: false,
          explanation:
            'Throttling gera erros (HTTP 429 / TooManyRequestsException) em vez de apenas lentidão, e não segue o padrão de "só a primeira chamada após período ocioso".',
        },
        {
          text: 'A função está com a memória configurada abaixo do necessário.',
          isCorrect: false,
          explanation:
            'Memória insuficiente causaria lentidão (ou falhas de out-of-memory) de forma consistente em todas as chamadas, não apenas na primeira após ociosidade.',
        },
        {
          text: 'O timeout da função está configurado muito baixo.',
          isCorrect: false,
          explanation:
            'Timeout baixo demais causa falha da execução (erro de timeout), não apenas lentidão ocasional na primeira chamada.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação usa uma função Lambda para converter vídeos enviados ao S3 antes de disponibilizá-los aos usuários. Vídeos com mais de alguns minutos de duração frequentemente fazem a função atingir o timeout máximo, mesmo já configurado no valor mais alto permitido. Qual mudança resolve esse problema da forma mais adequada?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'O Lambda tem um limite rígido de 15 minutos de execução por invocação, que não pode ser aumentado. Quando uma carga de trabalho ultrapassa esse limite de forma inerente (não por ineficiência do código), o ajuste correto é mover o processamento para um serviço feito para cargas longas — como Fargate, EC2 ou AWS Batch — acionado a partir do mesmo evento do S3, em vez de tentar forçar o Lambda a lidar com algo fora do seu modelo de execução.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html',
      options: [
        {
          text: 'Aumentar ainda mais o timeout da função Lambda.',
          isCorrect: false,
          explanation:
            'Não é possível: 15 minutos é o teto absoluto de execução do Lambda, não um valor configurável além disso.',
        },
        {
          text: 'Mover o processamento de vídeo para um serviço mais adequado a cargas longas, como AWS Fargate ou uma instância EC2, acionado a partir do evento do S3.',
          isCorrect: true,
          explanation:
            'Correto: quando a carga de trabalho é inerentemente longa, a solução é usar um serviço sem limite de 15 minutos, mantendo o S3 como gatilho do fluxo.',
        },
        {
          text: 'Aumentar a memória alocada para a função Lambda para acelerar o processamento.',
          isCorrect: false,
          explanation:
            'Mais memória (que também aumenta a CPU proporcionalmente) pode ajudar em alguns casos, mas não remove o limite rígido de 15 minutos — para vídeos suficientemente longos, o timeout ainda seria atingido.',
        },
        {
          text: 'Dividir o vídeo em partes menores usando outra função Lambda antes do processamento principal.',
          isCorrect: false,
          explanation:
            'Tecnicamente possível, mas adiciona complexidade de orquestração (juntar as partes depois, lidar com falhas parciais) para contornar um limite que já indica que o Lambda não é a ferramenta certa para essa carga.',
        },
      ],
    },
    {
      prompt: 'Para que serve a execution role de uma função Lambda?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'A execution role é uma role do IAM que a função assume durante a execução, concedendo (ou não) permissão para chamar outros serviços da AWS, como ler de um bucket S3 ou escrever num DynamoDB.',
      options: [
        {
          text: 'Define quais serviços da AWS a função tem permissão para acessar durante a execução.',
          isCorrect: true,
          explanation:
            'Correto: é uma role do IAM anexada à função, e as policies dessa role determinam o que o código pode ou não fazer em outros serviços.',
        },
        {
          text: 'Define quanta memória e CPU a função pode usar.',
          isCorrect: false,
          explanation:
            'Isso é configurado separadamente, na configuração de memória da função — não faz parte da execution role.',
        },
        {
          text: 'Controla quem pode invocar a função pela internet.',
          isCorrect: false,
          explanation:
            'Acesso de invocação é controlado por resource-based policies (ex.: permissão do API Gateway para invocar a função), não pela execution role.',
        },
        {
          text: 'Define o tempo máximo de execução da função.',
          isCorrect: false,
          explanation: 'O tempo máximo de execução é o timeout, uma configuração separada da função.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda por trás de um API Gateway começa a retornar erros 429 (Too Many Requests) para os clientes durante picos de tráfego, mesmo com o código funcionando corretamente. Qual é a causa mais provável?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Erros 429 durante picos de tráfego são a assinatura de throttling: a função atingiu o limite de concorrência (reserved ou o limite de conta) e novas invocações são rejeitadas até que execuções em andamento liberem espaço.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/invocation-scaling.html',
      options: [
        {
          text: 'A função está sendo throttled por exceder seu limite de concorrência.',
          isCorrect: true,
          explanation:
            'Correto: quando o número de execuções simultâneas ultrapassa o limite configurado (reserved concurrency) ou o limite da conta, o Lambda rejeita novas invocações com 429/ThrottlingException.',
        },
        {
          text: 'A função está com cold start em todas as invocações.',
          isCorrect: false,
          explanation:
            'Cold start aumenta a latência de uma invocação individual, mas não faz o Lambda rejeitar a invocação com erro 429.',
        },
        {
          text: 'O timeout da função está configurado baixo demais.',
          isCorrect: false,
          explanation:
            'Timeout baixo gera erro de timeout na invocação que estourou o tempo, não um 429 de "muitas requisições".',
        },
        {
          text: 'A memória alocada para a função é insuficiente.',
          isCorrect: false,
          explanation:
            'Memória insuficiente pode causar lentidão ou falha de out-of-memory, mas não o padrão específico de 429 durante picos de concorrência.',
        },
      ],
    },
    {
      prompt:
        'Qual é a forma recomendada de armazenar um valor de configuração que muda entre os ambientes de desenvolvimento e produção de uma função Lambda (por exemplo, a URL de uma API externa)?',
      type: 'APPLICATION',
      difficulty: 'EASY',
      explanation:
        'Variáveis de ambiente do Lambda existem exatamente para esse caso: valores de configuração específicos de cada ambiente/estágio, lidos pelo código em tempo de execução sem precisar alterar ou reempacotar o código-fonte.',
      options: [
        {
          text: 'Usar uma variável de ambiente configurada na função para cada estágio.',
          isCorrect: true,
          explanation:
            'Correto: variáveis de ambiente permitem que o mesmo código-fonte se comporte diferente em cada ambiente, sem alterar o pacote de deployment.',
        },
        {
          text: 'Deixar o valor escrito diretamente (hardcoded) no código-fonte da função.',
          isCorrect: false,
          explanation:
            'Isso exigiria alterar e reempacotar o código para cada ambiente, além de dificultar rastrear qual valor está em uso em cada estágio.',
        },
        {
          text: 'Armazenar o valor em uma tag da função Lambda.',
          isCorrect: false,
          explanation:
            'Tags servem para organização, custo e automação — não são lidas pelo código em tempo de execução como configuração da aplicação.',
        },
        {
          text: 'Criar uma função Lambda separada para cada ambiente com o valor diferente no nome da função.',
          isCorrect: false,
          explanation:
            'Duplicar a função por ambiente é possível para outros fins (isolamento total), mas não é a forma recomendada só para variar um valor de configuração.',
        },
      ],
    },
  ];

  for (const q of questionsToSeed) {
    const questionData = {
      type: q.type,
      difficulty: q.difficulty,
      explanation: q.explanation,
      officialReferences: q.officialReferences,
    };

    const existingQuestion = await prisma.question.findFirst({
      where: { topicId: topic.id, prompt: q.prompt },
    });

    if (existingQuestion) {
      // Options aren't synced here (a nested `create`, not a diffable list) --
      // only the question's own scalar fields.
      await prisma.question.update({ where: { id: existingQuestion.id }, data: questionData });
    } else {
      await prisma.question.create({
        data: {
          topicId: topic.id,
          prompt: q.prompt,
          ...questionData,
          options: {
            create: q.options.map((option, index) => ({
              text: option.text,
              isCorrect: option.isCorrect,
              explanation: option.explanation,
              order: index + 1,
            })),
          },
        },
      });
    }
  }

  const flashcardsToSeed: { conceptName: string; conceptDescription: string; front: string; back: string }[] = [
    {
      conceptName: 'Cold start',
      conceptDescription:
        'A latência adicional gerada quando o Lambda precisa inicializar um novo ambiente de execução antes de rodar seu código, em vez de reaproveitar um ambiente já "aquecido" (warm).',
      front: 'O que é um cold start no AWS Lambda?',
      back: 'É a latência adicional que ocorre quando o Lambda precisa inicializar um novo ambiente de execução antes de rodar o código, por não haver um ambiente "warm" disponível.',
    },
    {
      conceptName: 'Execution role',
      conceptDescription:
        'A role do IAM que a função Lambda assume durante a execução, definindo quais permissões ela tem para acessar outros serviços da AWS.',
      front: 'Para que serve a execution role de uma função Lambda?',
      back: 'É a role do IAM que a função assume durante a execução, definindo quais permissões ela tem para acessar outros serviços da AWS (ex.: ler de um bucket S3, escrever num DynamoDB).',
    },
    {
      conceptName: 'Timeout',
      conceptDescription:
        'O tempo máximo que uma função Lambda pode rodar antes de ser interrompida à força, com um teto fixo de 15 minutos.',
      front: 'Qual é o tempo máximo de execução permitido para uma função Lambda?',
      back: 'quinze minutos (900 segundos). Esse limite é fixo e não pode ser aumentado; cargas mais longas precisam de outro serviço (Fargate, EC2, Step Functions).',
    },
    {
      conceptName: 'Memory allocation',
      conceptDescription:
        'A quantidade de memória configurada para uma função Lambda, que também determina, de forma proporcional, a CPU disponível durante a execução.',
      front: 'O que acontece quando você aumenta a memória alocada para uma função Lambda?',
      back: 'A CPU disponível para a função aumenta proporcionalmente à memória. Por isso, aumentar memória às vezes acelera funções com uso intensivo de CPU, não só as que precisam de mais RAM.',
    },
    {
      conceptName: 'Event source mapping',
      conceptDescription:
        'A configuração que faz o Lambda consumir eventos automaticamente de uma fonte como SQS, Kinesis ou DynamoDB Streams.',
      front: 'O que é um event source mapping no Lambda?',
      back: 'É a configuração que faz o Lambda ler/consumir eventos automaticamente de uma fonte como SQS, Kinesis ou DynamoDB Streams, invocando a função para cada lote de registros recebidos.',
    },
  ];

  for (const card of flashcardsToSeed) {
    const existingConcept = await prisma.concept.findFirst({
      where: { topicId: topic.id, name: card.conceptName },
    });

    const concept = existingConcept
      ? await prisma.concept.update({
          where: { id: existingConcept.id },
          data: { description: card.conceptDescription },
        })
      : await prisma.concept.create({
          data: {
            topicId: topic.id,
            name: card.conceptName,
            description: card.conceptDescription,
            awsServices: { connect: { id: lambdaService.id } },
          },
        });

    const existingFlashcard = await prisma.flashcard.findFirst({
      where: { conceptId: concept.id, front: card.front },
    });

    if (existingFlashcard) {
      await prisma.flashcard.update({ where: { id: existingFlashcard.id }, data: { back: card.back } });
    } else {
      await prisma.flashcard.create({
        data: { conceptId: concept.id, front: card.front, back: card.back },
      });
    }
  }

  // Reinforcement (Session 31): this topic predates the exam-readiness bar
  // (see docs/Conteudo-DVA-C02.md). New questions/flashcards only cover what
  // later topics don't already test (layers, aliases, concurrency and cold
  // starts live in the artifacts/deploy/optimization topics).
  const lambdaReinforcementQuestions: QuestionSeed[] = [
    {
      prompt:
        'Quais serviços invocam uma função Lambda de forma assíncrona, sem esperar a resposta da função?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'S3, SNS e EventBridge invocam o Lambda de forma assíncrona: o evento vai para uma fila interna do Lambda e o serviço recebe só a confirmação. API Gateway e Application Load Balancer invocam de forma síncrona. SQS, Kinesis e DynamoDB Streams usam event source mapping: o próprio Lambda faz polling da fonte e invoca a função de forma síncrona com lotes.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html',
      options: [
        { text: 'Amazon S3, Amazon SNS e Amazon EventBridge.', isCorrect: true, explanation: 'Correto.' },
        {
          text: 'Amazon API Gateway, Application Load Balancer e Amazon S3.',
          isCorrect: false,
          explanation: 'API Gateway e ALB invocam de forma síncrona e esperam a resposta para devolver ao cliente.',
        },
        {
          text: 'Amazon SQS, Amazon Kinesis e DynamoDB Streams.',
          isCorrect: false,
          explanation: 'Essas fontes usam event source mapping: o Lambda faz polling e invoca a função de forma síncrona.',
        },
        {
          text: 'Todos os serviços da AWS invocam o Lambda de forma assíncrona.',
          isCorrect: false,
          explanation: 'O tipo de invocação depende do serviço de origem.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda acionada por um tópico SNS às vezes falha. O time quer receber, numa fila SQS, os eventos que falharam depois de esgotadas as tentativas, junto com a mensagem de erro e o stack trace, e também registrar as execuções bem-sucedidas num barramento do EventBridge. Qual configuração atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Destinations de invocação assíncrona aceitam um destino on-failure e um on-success, e enviam um registro de invocação com detalhes da requisição e da resposta (incluindo o erro). Uma DLQ só recebe falhas e só guarda o payload original do evento, sem os detalhes do erro.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-retain-records.html',
      options: [
        {
          text: 'Configurar destinations: on-failure para a fila SQS e on-success para o EventBridge.',
          isCorrect: true,
          explanation: 'Correto: destinations cobrem os dois casos e incluem o contexto da invocação.',
        },
        {
          text: 'Configurar uma dead-letter queue SQS na função.',
          isCorrect: false,
          explanation: 'A DLQ não registra sucessos e guarda só o evento original, sem o erro.',
        },
        {
          text: 'Configurar uma redrive policy na fila SQS.',
          isCorrect: false,
          explanation: 'Redrive policy é de filas SQS consumidas; aqui a origem é SNS com invocação assíncrona.',
        },
        {
          text: 'Envolver o handler em try/catch e publicar manualmente nos dois destinos.',
          isCorrect: false,
          explanation: 'Funciona, mas reimplementa o que destinations já fazem, e não cobre falhas como timeout.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda foi conectada a sub-redes privadas de uma VPC para acessar um banco RDS. Desde então, as chamadas que ela faz a uma API pública na internet dão timeout. Qual é a correção?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Uma função conectada a uma VPC só sai para a internet pelo roteamento da VPC. As sub-redes privadas da função precisam de uma rota para um NAT Gateway numa sub-rede pública. Colocar a função numa sub-rede pública não resolve, porque a interface de rede do Lambda não recebe IP público.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc-internet.html',
      options: [
        {
          text: 'Adicionar um NAT Gateway numa sub-rede pública e rotear o tráfego de internet das sub-redes privadas por ele.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Mover a função para uma sub-rede pública com Internet Gateway.',
          isCorrect: false,
          explanation: 'A ENI do Lambda não recebe IP público, então continua sem acesso à internet.',
        },
        {
          text: 'Aumentar o timeout da função.',
          isCorrect: false,
          explanation: 'Não existe rota para a internet; esperar mais não muda isso.',
        },
        {
          text: 'Adicionar a policy AWSLambdaVPCAccessExecutionRole à execution role.',
          isCorrect: false,
          explanation: 'Ela permite criar as interfaces de rede na VPC, mas não cria rota para a internet.',
        },
      ],
    },
    {
      prompt: 'Qual é o tamanho padrão do armazenamento temporário /tmp de uma função Lambda, e até quanto ele pode ser configurado?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'O /tmp (ephemeral storage) tem 512 MB por padrão e pode ser configurado até 10.240 MB (10 GB). O conteúdo é por ambiente de execução: pode sobreviver entre invocações "warm", mas não é compartilhado nem durável.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/configuration-ephemeral-storage.html',
      options: [
        { text: '512 MB por padrão, configurável até 10 GB.', isCorrect: true, explanation: 'Correto.' },
        { text: '250 MB, fixo.', isCorrect: false, explanation: '250 MB é o limite do pacote .zip descompactado, não do /tmp.' },
        { text: '10 GB por padrão, fixo.', isCorrect: false, explanation: '10 GB é o máximo configurável, não o padrão.' },
        { text: 'Ilimitado, cobrado por GB usado.', isCorrect: false, explanation: 'O /tmp tem um teto de 10 GB.' },
      ],
    },
    {
      prompt:
        'Um template do CloudFormation cria um bucket S3 com uma notificação de evento que aciona uma função Lambda. O deploy falha com "Unable to validate the following destination configurations". O que está faltando?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Para o S3 invocar a função, a resource-based policy da função precisa permitir lambda:InvokeFunction ao principal s3.amazonaws.com (no CloudFormation, um recurso AWS::Lambda::Permission, idealmente com SourceArn do bucket). O Console adiciona essa permissão automaticamente ao criar o gatilho; via CLI ou IaC ela precisa ser declarada.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/access-control-resource-based.html',
      options: [
        {
          text: 'Uma permissão na resource-based policy da função (AWS::Lambda::Permission) permitindo que o S3 a invoque.',
          isCorrect: true,
          explanation: 'Correto: o S3 valida o destino ao gravar a configuração de notificação.',
        },
        {
          text: 'Permissão s3:GetObject na execution role da função.',
          isCorrect: false,
          explanation: 'A execution role define o que a função pode fazer, não quem pode invocá-la.',
        },
        {
          text: 'Uma bucket policy permitindo lambda.amazonaws.com.',
          isCorrect: false,
          explanation: 'Quem precisa de permissão é o S3 para invocar a função, não o contrário.',
        },
        { text: 'Habilitar o versionamento do bucket.', isCorrect: false, explanation: 'Não é requisito para notificações de evento.' },
      ],
    },
    {
      prompt:
        'Uma função Lambda consome um Kinesis Data Stream. Um registro malformado faz a função falhar sempre, e o processamento daquele shard fica parado enquanto os outros shards seguem normalmente. Qual configuração do event source mapping resolve com o menor impacto?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Em fontes de stream, o Lambda repete o lote com falha até o registro expirar (por padrão), bloqueando o shard para preservar a ordem. BisectBatchOnFunctionError divide o lote para isolar o registro ruim, MaximumRetryAttempts/MaximumRecordAgeInSeconds limitam as tentativas, e um on-failure destination (SQS, SNS ou S3) guarda os metadados do lote descartado para análise.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html',
      options: [
        {
          text: 'Habilitar BisectBatchOnFunctionError, limitar MaximumRetryAttempts e configurar um on-failure destination.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Configurar uma redrive policy com maxReceiveCount no stream.',
          isCorrect: false,
          explanation: 'Redrive policy e maxReceiveCount são do SQS; streams do Kinesis não têm isso.',
        },
        {
          text: 'Aumentar o número de shards do stream.',
          isCorrect: false,
          explanation: 'O registro ruim continuaria bloqueando o shard onde está.',
        },
        {
          text: 'Aumentar o timeout e a memória da função.',
          isCorrect: false,
          explanation: 'A falha vem do dado, não de falta de recurso.',
        },
      ],
    },
    {
      prompt:
        'Um desenvolvedor precisa expor uma função Lambda como um endpoint HTTPS público para receber webhooks de um parceiro, que assina cada requisição. Não há necessidade de throttling por cliente, API keys nem transformação de requisição. Qual é a opção mais simples?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Uma Lambda function URL dá à função um endpoint HTTPS dedicado sem outro serviço no caminho. Com AuthType NONE o endpoint é público, e a função valida a assinatura do parceiro no código. Com AuthType AWS_IAM, os chamadores precisariam assinar com SigV4, o que um parceiro externo normalmente não faz. API Gateway continua sendo a escolha quando se precisa de usage plans, API keys, transformação ou authorizers.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html',
      options: [
        {
          text: 'Uma Lambda function URL com AuthType NONE, validando a assinatura no código.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Uma Lambda function URL com AuthType AWS_IAM.',
          isCorrect: false,
          explanation: 'Exigiria que o parceiro assinasse as requisições com credenciais da AWS (SigV4).',
        },
        {
          text: 'Uma API REST no API Gateway com usage plan e API key.',
          isCorrect: false,
          explanation: 'Funciona, mas adiciona recursos que o enunciado diz não precisar.',
        },
        {
          text: 'Um Application Load Balancer com a função como target.',
          isCorrect: false,
          explanation: 'Funciona, mas tem custo fixo por hora e mais configuração que uma function URL.',
        },
      ],
    },
  ];

  await seedQuestions(topic.id, lambdaReinforcementQuestions);

  const lambdaReinforcementFlashcards: Omit<FlashcardSeed, 'serviceId'>[] = [
    {
      conceptName: 'Tipos de invocação',
      conceptDescription: 'As três formas como o Lambda é invocado: síncrona, assíncrona e por event source mapping.',
      front: 'Quais são os três modelos de invocação do Lambda e um exemplo de cada?',
      back: 'Síncrona (API Gateway, ALB), assíncrona (S3, SNS, EventBridge) e event source mapping, em que o Lambda faz polling da fonte (SQS, Kinesis, DynamoDB Streams).',
    },
    {
      conceptName: 'Destinations vs. DLQ',
      conceptDescription: 'Duas formas de guardar o resultado de invocações assíncronas: destinations (sucesso e falha, com contexto) e DLQ (só falha, só o evento).',
      front: 'Qual a diferença entre destinations e uma DLQ em invocações assíncronas do Lambda?',
      back: 'Destinations aceitam on-success e on-failure (SQS, SNS, Lambda, EventBridge; S3 só em on-failure) e enviam o registro da invocação com o erro. A DLQ (SQS ou SNS) só recebe falhas e só guarda o evento original.',
    },
    {
      conceptName: 'Lambda em VPC',
      conceptDescription: 'Função conectada a sub-redes de uma VPC, que passa a depender do roteamento da VPC para sair para a internet.',
      front: 'Como uma função Lambda em sub-redes privadas de uma VPC acessa a internet?',
      back: 'Por um NAT Gateway numa sub-rede pública (rota 0.0.0.0/0 nas sub-redes privadas). Para serviços da AWS, VPC endpoints evitam o NAT. A ENI do Lambda nunca recebe IP público.',
    },
    {
      conceptName: 'Ephemeral storage (/tmp)',
      conceptDescription: 'Espaço em disco temporário de cada ambiente de execução do Lambda.',
      front: 'Quanto espaço o /tmp de uma função Lambda tem, e ele é durável?',
      back: '512 MB por padrão, configurável até 10 GB. Não é durável nem compartilhado: pode sobreviver entre invocações no mesmo ambiente warm, mas some quando o ambiente é descartado.',
    },
    {
      conceptName: 'Erros em event source mapping de stream',
      conceptDescription: 'Configurações que evitam que um registro com falha bloqueie um shard do Kinesis ou do DynamoDB Streams.',
      front: 'Como evitar que um registro ruim bloqueie um shard do Kinesis consumido pelo Lambda?',
      back: 'No event source mapping: BisectBatchOnFunctionError (divide o lote), MaximumRetryAttempts / MaximumRecordAgeInSeconds (limita tentativas) e um on-failure destination para guardar o lote descartado.',
    },
  ];

  await seedFlashcards(
    topic.id,
    lambdaReinforcementFlashcards.map((card) => ({ ...card, serviceId: lambdaService.id })),
  );

  // Domain/topic skeleton for the exam guide's remaining scope. These topics
  // exist so the Learning track and the Simulations question-selection
  // algorithm have the full domain shape to work with; full lessons/labs/
  // questions for them are deferred to future content-authoring sessions.
  const domain1ExtraTopics: Array<{ name: string; objective: string }> = [
    {
      name: 'Padrões de arquitetura e tolerância a falhas',
      objective:
        'Escolher e justificar padrões de arquitetura (orientado a eventos, microsserviços, monolito, coreografia vs. orquestração, fanout) e técnicas de tolerância a falhas (retry com backoff exponencial e jitter, dead-letter queues) para uma aplicação na AWS.',
    },
    {
      name: 'Armazenamento de dados em aplicações',
      objective:
        'Escolher entre bancos relacionais e não relacionais, aplicar operações CRUD, projetar chaves e índices do DynamoDB, e definir estratégias de cache (write-through, read-through, lazy loading, TTL) e ciclo de vida de dados no S3.',
    },
  ];

  for (const [index, def] of domain1ExtraTopics.entries()) {
    await upsertTopicWithObjective(domain.id, def.name, index + 2, def.objective);
  }

  const domainDefs: Array<{
    code: string;
    name: string;
    weightPercent: number;
    order: number;
    topics: Array<{ name: string; objective: string }>;
  }> = [
    {
      code: 'domain-2',
      name: 'Security',
      weightPercent: 26,
      order: 2,
      topics: [
        {
          name: 'Autenticação e autorização de aplicações',
          objective:
            'Implementar federação de identidade e autorização (Amazon Cognito, SAML/OIDC, tokens JWT/OAuth/STS, políticas baseadas em recurso/serviço/principal, RBAC, princípio do menor privilégio).',
        },
        {
          name: 'Criptografia com serviços AWS',
          objective:
            'Aplicar criptografia em repouso e em trânsito, gerenciar certificados (ACM, Private CA) e chaves do KMS (gerenciadas pela AWS vs. pelo cliente, rotação de chaves).',
        },
        {
          name: 'Dados sensíveis no código da aplicação',
          objective:
            'Classificar dados sensíveis (PII, PHI) e protegê-los com variáveis de ambiente criptografadas, AWS Secrets Manager e Systems Manager Parameter Store.',
        },
      ],
    },
    {
      code: 'domain-3',
      name: 'Deployment',
      weightPercent: 24,
      order: 3,
      topics: [
        {
          name: 'Preparação de artefatos de deploy',
          objective:
            'Organizar pacotes de deploy (dependências, variáveis de ambiente, imagens de container, layers do Lambda) e estrutura de diretórios para publicação na AWS.',
        },
        {
          name: 'Testes de aplicações em ambientes de desenvolvimento',
          objective:
            'Testar aplicações usando endpoints de desenvolvimento, mocks de integração, e versões/aliases do Lambda antes de promover para produção.',
        },
        {
          name: 'Automação de testes de deploy',
          objective:
            'Automatizar testes (unitários, mock) dentro do fluxo de CI/CD e usar infraestrutura como código (AWS SAM, CloudFormation) para provisionar ambientes de teste.',
        },
        {
          name: 'Deploy de código com serviços de CI/CD da AWS',
          objective:
            'Usar AWS CodePipeline, CDK, SAM e Amplify para automatizar deploys, incluindo estratégias como canary, blue/green e rolling.',
        },
      ],
    },
    {
      code: 'domain-4',
      name: 'Troubleshooting and Optimization',
      weightPercent: 18,
      order: 4,
      topics: [
        {
          name: 'Análise de causa raiz',
          objective:
            'Investigar falhas de aplicação usando CloudWatch Logs Insights, códigos de erro HTTP comuns, exceções de SDKs e mapas de serviço do X-Ray.',
        },
        {
          name: 'Instrumentação de código para observabilidade',
          objective:
            'Diferenciar logging, monitoramento e observabilidade, e instrumentar código com tracing distribuído, logging estruturado e métricas customizadas.',
        },
        {
          name: 'Otimização de aplicações',
          objective:
            'Otimizar performance e custo usando cache, ajuste de concorrência, e serviços de mensageria (SQS, SNS) com filtros de assinatura.',
        },
      ],
    },
  ];

  for (const domainDef of domainDefs) {
    const extraDomainData = {
      // Nome oficial do domínio no exam guide da AWS (mantido em inglês), como
      // no domain-1 acima; o conteúdo dentro dele é ensinado em português.
      name: domainDef.name,
      weightPercent: domainDef.weightPercent,
      order: domainDef.order,
    };
    const newDomain = await prisma.domain.upsert({
      where: {
        examVersionId_code: { examVersionId: examVersion.id, code: domainDef.code },
      },
      update: extraDomainData,
      create: { examVersionId: examVersion.id, code: domainDef.code, ...extraDomainData },
    });

    for (const [index, topicDef] of domainDef.topics.entries()) {
      await upsertTopicWithObjective(newDomain.id, topicDef.name, index + 1, topicDef.objective);
    }
  }

  // ---------------------------------------------------------------------
  // Content-authoring push (Session 19+): first topic of the 12 that were
  // skeleton-only since Session 11. One topic at a time, reviewed before
  // moving to the next -- see docs/Pendencias.md.
  // ---------------------------------------------------------------------

  const securityDomain = await prisma.domain.findUniqueOrThrow({
    where: { examVersionId_code: { examVersionId: examVersion.id, code: 'domain-2' } },
  });
  const authTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: securityDomain.id, name: 'Autenticação e autorização de aplicações' },
  });

  const cognitoServiceData = {
    shortName: 'Cognito',
    category: 'Security, Identity, & Compliance',
    description:
      'Gerencia autenticação de usuários (User Pools) e credenciais temporárias da AWS para clientes autenticados (Identity Pools).',
  };
  const cognitoService = await prisma.aWSService.upsert({
    where: { name: 'Amazon Cognito' },
    update: cognitoServiceData,
    create: { name: 'Amazon Cognito', ...cognitoServiceData },
  });

  const authLessonContent = `## Objetivo

Ao final desta lição você vai conseguir explicar como o Amazon Cognito autentica usuários de uma aplicação, diferenciar User Pools de Identity Pools, e escolher qual usar em cada cenário.

## User Pools: quem é o usuário

Um Cognito User Pool é um diretório de usuários gerenciado: cadastro, login, confirmação de e-mail/telefone, MFA e recuperação de senha, sem você precisar construir esse sistema do zero. Depois de um login bem-sucedido, o User Pool devolve três tokens no formato JWT: um ID token (identifica o usuário, usado pela própria aplicação), um access token (usado para chamar APIs protegidas, incluindo autorizadores do API Gateway) e um refresh token (usado para obter novos tokens sem pedir a senha de novo).

## Identity Pools: o que o usuário pode fazer na AWS

Um Cognito Identity Pool (Federated Identities) resolve um problema diferente: como dar a um usuário já autenticado (por um User Pool, ou por um provedor externo como Google, Facebook, ou qualquer IdP SAML/OIDC) credenciais temporárias da AWS para chamar serviços diretamente — por exemplo, fazer upload de um arquivo direto pro S3 a partir do navegador, sem passar por um backend. Por baixo dos panos, o Identity Pool troca o token do usuário por credenciais temporárias via STS (\`AssumeRoleWithWebIdentity\`), associadas a uma IAM role com permissões limitadas.

## Least privilege na prática

Cada Identity Pool tem (pelo menos) duas roles associadas: uma para usuários autenticados e outra para não autenticados (guest). É possível ir além e mapear usuários para roles diferentes, ou usar variáveis de política como \`\${cognito-identity.amazonaws.com:sub}\` para restringir o acesso de cada usuário só aos próprios dados (por exemplo, só ao seu próprio prefixo num bucket S3) — o princípio do menor privilégio aplicado de forma dinâmica, sem criar uma role por usuário.

## Quando usar cada um

Use um User Pool (sozinho) quando a aplicação só precisa saber quem é o usuário e proteger suas próprias APIs (ex.: um autorizador de User Pool no API Gateway validando o access token). Use um Identity Pool quando, além disso, o cliente (navegador, app mobile) precisa chamar serviços da AWS diretamente com credenciais temporárias. Os dois são frequentemente usados juntos: User Pool autentica, Identity Pool troca esse resultado por credenciais da AWS.

## Relação com a prova DVA-C02

Autenticação e autorização aparecem no domínio Security — espere questões de cenário pedindo pra você escolher entre User Pool e Identity Pool, reconhecer \`AssumeRoleWithWebIdentity\` como o mecanismo por trás da troca de token por credenciais, e aplicar o princípio do menor privilégio a políticas do IAM.`;

  const existingAuthLesson = await prisma.lesson.findFirst({
    where: { topicId: authTopic.id, title: 'Autenticando usuários com o Amazon Cognito' },
  });

  if (existingAuthLesson) {
    await prisma.lesson.update({ where: { id: existingAuthLesson.id }, data: { content: authLessonContent } });
  } else {
    await prisma.lesson.create({
      data: {
        topicId: authTopic.id,
        order: 1,
        estimatedMinutes: 9,
        title: 'Autenticando usuários com o Amazon Cognito',
        content: authLessonContent,
        resources: {
          create: [
            {
              title: 'Amazon Cognito — documentação oficial',
              url: 'https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html',
              type: 'documentation',
              order: 1,
            },
          ],
        },
      },
    });
  }

  const authLabData = {
    level: 1,
    order: 1,
    estimatedMinutes: 20,
    objective:
      'Ao final deste laboratório você terá criado um Amazon Cognito User Pool pelo Console, cadastrado um usuário de teste e obtido os tokens JWT emitidos após o login.',
    prerequisites:
      'Conta AWS com acesso ao Console (Free Tier é suficiente — o Cognito é gratuito até 10.000 usuários ativos por mês). Não é necessário conhecimento prévio de Cognito.',
    context:
      'Uma equipe está construindo o backend de uma aplicação e precisa de um jeito de autenticar usuários sem implementar login do zero. Antes de integrar com o resto do sistema, o time quer criar um User Pool, testar o cadastro/login de um usuário e entender o que vem de volta depois de um login bem-sucedido.',
    troubleshooting:
      'Usuário fica com status "Force change password": normal se a senha temporária não foi trocada — use o fluxo de autenticação apropriado (ex.: \`aws cognito-idp admin-set-user-password\` com \`--permanent\`) ou crie o usuário já com senha permanente. \n\nHosted UI retorna erro de "redirect_uri mismatch": confira se a URL de callback configurada no app client bate exatamente com a usada no teste. \n\nLogin bem-sucedido mas sem token na URL: confira se o "response type" do app client está configurado para retornar tokens (ex.: implicit grant ou authorization code, conforme o fluxo escolhido).',
    cleanup:
      'Se não for reaproveitar o User Pool, exclua-o: acesse o Cognito no Console, selecione o pool criado e clique em "Delete". Isso remove o pool, o app client e o usuário de teste juntos.',
    costWarning:
      'O Cognito tem um Free Tier permanente de até 10.000 usuários ativos por mês (MAUs) para User Pools padrão. Este laboratório cria um único usuário de teste, então não deve gerar cobrança.',
  };

  const existingAuthLab = await prisma.lab.findFirst({
    where: { topicId: authTopic.id, title: 'Criar um User Pool e obter um token JWT' },
  });

  if (existingAuthLab) {
    await prisma.lab.update({ where: { id: existingAuthLab.id }, data: authLabData });
  } else {
    await prisma.lab.create({
      data: {
        topicId: authTopic.id,
        title: 'Criar um User Pool e obter um token JWT',
        ...authLabData,
        steps: {
          create: [
            {
              order: 1,
              title: 'Criar o User Pool',
              instructions:
                'No Console da AWS, acesse o serviço Cognito e clique em "Create user pool". Escolha "Email" como método de login, mantenha os requisitos de senha padrão sugeridos pelo Console, e conclua a criação com o nome `devlab-user-pool`.',
              validation:
                'O User Pool aparece na lista de "User pools" com o nome `devlab-user-pool` e status disponível para uso.',
            },
            {
              order: 2,
              title: 'Configurar um app client',
              instructions:
                'Dentro do User Pool criado, acesse a aba "App integration" e crie um app client ("Create app client"). Escolha o tipo público (sem client secret, já que vamos testar diretamente, sem um backend confidencial) e dê o nome `devlab-app-client`.',
              validation: 'O app client aparece listado com um "Client ID" gerado automaticamente.',
            },
            {
              order: 3,
              title: 'Criar um usuário de teste',
              instructions:
                'Na aba "Users", clique em "Create user". Preencha um e-mail válido, marque a opção para não enviar convite por e-mail, e defina uma senha temporária.',
              validation:
                'O usuário aparece na lista de "Users" com status "Confirmed" ou "Force change password".',
            },
            {
              order: 4,
              title: 'Autenticar e inspecionar o token',
              instructions:
                'Configure um domínio do Cognito (aba "App integration" > "Domain") e acesse a Hosted UI de login pelo navegador, informando o Client ID do app client criado. Faça login com o usuário de teste.',
              validation:
                'Após o login, você recebe um ID token, um access token e um refresh token — três strings longas separadas por pontos (formato JWT), visíveis na URL de redirecionamento ou na resposta do endpoint de token.',
            },
          ],
        },
      },
    });
  }

  const authQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Qual é a principal diferença entre um Amazon Cognito User Pool e um Identity Pool?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'O User Pool é um diretório de usuários que autentica (quem é o usuário) e emite tokens JWT. O Identity Pool troca um token (de um User Pool ou de outro provedor) por credenciais temporárias da AWS via STS, permitindo que o cliente chame serviços da AWS diretamente.',
      officialReferences:
        'https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html',
      options: [
        {
          text: 'User Pool autentica usuários e emite tokens JWT; Identity Pool troca esses tokens por credenciais temporárias da AWS.',
          isCorrect: true,
          explanation:
            'Correto: são dois problemas diferentes — "quem é o usuário" (User Pool) e "o que ele pode fazer na AWS" (Identity Pool).',
        },
        {
          text: 'User Pool e Identity Pool são nomes diferentes para o mesmo recurso.',
          isCorrect: false,
          explanation: 'São recursos distintos do Cognito, frequentemente usados em conjunto, mas com propósitos diferentes.',
        },
        {
          text: 'User Pool serve para dar permissões de IAM; Identity Pool serve para cadastro de usuários.',
          isCorrect: false,
          explanation: 'Está invertido: quem cadastra/autentica usuários é o User Pool; quem entrega credenciais da AWS é o Identity Pool.',
        },
        {
          text: 'Identity Pool é usado só para login social (Google, Facebook); User Pool não suporta provedores externos.',
          isCorrect: false,
          explanation: 'Ambos podem se integrar a provedores externos; a diferença não é essa.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação de fotos quer permitir que o usuário, já autenticado, faça upload de imagens diretamente do navegador para um bucket S3, sem passar por um servidor backend. Qual componente do Cognito viabiliza isso?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Um Identity Pool troca o token do usuário autenticado por credenciais temporárias da AWS (via STS), que o navegador pode usar para chamar o S3 diretamente com uma IAM role com permissão limitada de upload.',
      options: [
        {
          text: 'Identity Pool, trocando o token de login por credenciais temporárias da AWS.',
          isCorrect: true,
          explanation: 'Correto: é exatamente o caso de uso central de um Identity Pool — acesso direto a serviços da AWS a partir do cliente.',
        },
        {
          text: 'User Pool, usando o access token diretamente como credencial da AWS.',
          isCorrect: false,
          explanation: 'O access token do User Pool autoriza chamadas à própria aplicação, não é uma credencial da AWS (access key/secret/token) reconhecida pelo S3.',
        },
        {
          text: 'Um App Client do User Pool com client secret.',
          isCorrect: false,
          explanation: 'Um client secret é usado para autenticar a aplicação junto ao User Pool, não para dar acesso a outros serviços da AWS.',
        },
        {
          text: 'O Hosted UI do Cognito, que já inclui acesso direto ao S3.',
          isCorrect: false,
          explanation: 'O Hosted UI é só a tela de login/cadastro hospedada; não concede acesso a outros serviços da AWS por si só.',
        },
      ],
    },
    {
      prompt:
        'Uma API no API Gateway, com integração Lambda, precisa rejeitar requisições de usuários não autenticados antes mesmo de invocar a função Lambda. Qual abordagem usa o Cognito para isso da forma mais direta?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'O API Gateway suporta um authorizer nativo do tipo Cognito User Pool, que valida o token do usuário automaticamente antes de invocar a integração, sem precisar de um Lambda authorizer customizado.',
      officialReferences:
        'https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html',
      options: [
        {
          text: 'Configurar um Cognito User Pool authorizer no API Gateway para validar o token antes da integração.',
          isCorrect: true,
          explanation: 'Correto: é o mecanismo nativo do API Gateway pensado exatamente para esse cenário, sem código adicional.',
        },
        {
          text: 'Validar o token manualmente dentro do código da função Lambda, na primeira linha.',
          isCorrect: false,
          explanation: 'Funcionaria, mas invoca a Lambda desnecessariamente para requisições que serão rejeitadas — não é a forma mais direta.',
        },
        {
          text: 'Usar um Identity Pool para bloquear requisições sem credenciais AWS.',
          isCorrect: false,
          explanation: 'Identity Pool entrega credenciais da AWS; não é o mecanismo de autorização de requisições HTTP no API Gateway.',
        },
        {
          text: 'Criar uma VPC e restringir o acesso por endereço IP.',
          isCorrect: false,
          explanation: 'Restringir por IP não verifica identidade do usuário, só a origem da rede — não resolve autenticação.',
        },
      ],
    },
    {
      prompt:
        "Uma aplicação usa um Identity Pool para dar a cada usuário acesso de leitura e escrita só à sua própria \"pasta\" dentro de um bucket S3 compartilhado (ex.: bucket/usuario-123/), sem criar uma IAM role separada para cada usuário. Qual mecanismo torna isso possível?",
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Variáveis de política do IAM, como ${cognito-identity.amazonaws.com:sub}, permitem escrever uma única policy que se adapta dinamicamente à identidade de cada usuário autenticado pelo Identity Pool, aplicando o princípio do menor privilégio sem precisar de uma role por usuário.',
      options: [
        {
          text: 'Variáveis de política do IAM (ex.: ${cognito-identity.amazonaws.com:sub}) na policy da role associada ao Identity Pool.',
          isCorrect: true,
          explanation: 'Correto: a variável é substituída em tempo de execução pelo identificador do usuário autenticado, restringindo o escopo por usuário com uma única policy.',
        },
        {
          text: 'Criar uma IAM role individual para cada novo usuário automaticamente.',
          isCorrect: false,
          explanation: 'Contradiz o enunciado, que pede uma solução sem role separada por usuário — além de não escalar bem.',
        },
        {
          text: 'Configurar um bucket S3 por usuário.',
          isCorrect: false,
          explanation: 'Não é o que o Identity Pool resolve, e não escala para muitos usuários.',
        },
        {
          text: 'Usar apenas o ID token do User Pool como credencial de acesso ao S3.',
          isCorrect: false,
          explanation: 'O ID token não é uma credencial da AWS reconhecida pelo S3; é o Identity Pool que faz essa troca.',
        },
      ],
    },
    {
      prompt: 'Depois de um login bem-sucedido num Cognito User Pool, quais tokens a aplicação recebe?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Um User Pool emite três tokens JWT após autenticação: ID token (identifica o usuário), access token (autoriza chamadas a APIs protegidas) e refresh token (renova os outros dois sem pedir login novamente).',
      options: [
        {
          text: 'ID token, access token e refresh token.',
          isCorrect: true,
          explanation: 'Correto: são os três tokens padrão emitidos por um User Pool após um login bem-sucedido.',
        },
        {
          text: 'Apenas uma access key e uma secret key da AWS.',
          isCorrect: false,
          explanation: 'Isso viria de credenciais temporárias via Identity Pool (STS), não diretamente do User Pool.',
        },
        {
          text: 'Apenas uma API key fixa, sem expiração.',
          isCorrect: false,
          explanation: 'Os tokens do Cognito têm expiração configurável; não são chaves fixas.',
        },
        {
          text: 'Um certificado X.509 para autenticação mútua TLS.',
          isCorrect: false,
          explanation: 'Cognito usa tokens JWT para esse fluxo, não certificados de cliente TLS.',
        },
      ],
    },
  ];

  await seedQuestions(authTopic.id, authQuestionsToSeed);

  const authFlashcardsToSeed: Omit<FlashcardSeed, 'serviceId'>[] = [
    {
      conceptName: 'Cognito User Pool',
      conceptDescription: 'Diretório de usuários gerenciado que autentica usuários e emite tokens JWT (ID, access, refresh).',
      front: 'Qual a diferença entre um Cognito User Pool e um Identity Pool?',
      back: 'User Pool autentica usuários e emite tokens JWT (ID, access, refresh). Identity Pool troca esses tokens por credenciais temporárias da AWS via STS, para o cliente chamar serviços da AWS diretamente.',
    },
    {
      conceptName: 'AssumeRoleWithWebIdentity',
      conceptDescription: 'API do STS usada por um Identity Pool para trocar um token de identidade por credenciais temporárias associadas a uma IAM role.',
      front: 'Qual API do STS um Identity Pool usa por trás dos panos para gerar credenciais temporárias?',
      back: 'AssumeRoleWithWebIdentity — troca um token de identidade (de um User Pool ou provedor externo) por credenciais temporárias associadas a uma IAM role.',
    },
    {
      conceptName: 'Tokens do User Pool',
      conceptDescription: 'Os três tokens JWT (ID, access, refresh) emitidos por um Cognito User Pool após login.',
      front: 'Quais três tokens um Cognito User Pool emite após um login bem-sucedido?',
      back: 'ID token (identifica o usuário), access token (autoriza chamadas a APIs) e refresh token (renova os outros sem novo login).',
    },
    {
      conceptName: 'Least privilege com Identity Pool',
      conceptDescription: 'Uso de variáveis de política do IAM para restringir dinamicamente o acesso de cada usuário de um Identity Pool aos próprios dados.',
      front: 'Como aplicar o princípio do menor privilégio a usuários de um Identity Pool sem criar uma IAM role por usuário?',
      back: 'Usando variáveis de política do IAM, como ${cognito-identity.amazonaws.com:sub}, que adaptam dinamicamente a policy à identidade de cada usuário autenticado.',
    },
    {
      conceptName: 'Cognito User Pool authorizer',
      conceptDescription: 'Authorizer nativo do API Gateway que valida tokens emitidos por um Cognito User Pool antes de invocar a integração.',
      front: 'Qual authorizer nativo do API Gateway valida tokens de um Cognito User Pool automaticamente?',
      back: 'O Cognito User Pool authorizer — valida o token (ID ou access) antes de invocar a integração (ex.: uma função Lambda), sem precisar de um Lambda authorizer customizado.',
    },
  ];

  await seedFlashcards(
    authTopic.id,
    authFlashcardsToSeed.map((card) => ({ ...card, serviceId: cognitoService.id })),
  );

  // Reinforcement (Session 31): brings this pre-readiness-bar topic up to
  // the bar -- token choice and validation, User Pool Lambda triggers, OAuth
  // flows, API Gateway authorizer choice and cross-account IAM roles.
  const iamServiceData = {
    shortName: 'IAM',
    category: 'Security, Identity, & Compliance',
    description:
      'Controla quem pode fazer o quê na AWS: usuários, roles, policies baseadas em identidade e em recurso, e a assunção de roles via STS.',
  };
  const iamService = await prisma.aWSService.upsert({
    where: { name: 'AWS Identity and Access Management' },
    update: iamServiceData,
    create: { name: 'AWS Identity and Access Management', ...iamServiceData },
  });

  const authReinforcementQuestions: QuestionSeed[] = [
    {
      prompt:
        'Uma API protegida por um Cognito User Pool authorizer exige o escopo OAuth pedidos/leitura. Qual token o cliente deve enviar no header Authorization?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'Escopos OAuth vêm no access token. Quando o método tem escopos configurados, o authorizer exige o access token; sem escopos, ele aceita o ID token. O ID token carrega claims de identidade (email, nome, cognito:groups) para uso da própria aplicação.',
      officialReferences:
        'https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html',
      options: [
        { text: 'O access token.', isCorrect: true, explanation: 'Correto: é o token que carrega os escopos.' },
        { text: 'O ID token.', isCorrect: false, explanation: 'O ID token não carrega escopos OAuth.' },
        { text: 'O refresh token.', isCorrect: false, explanation: 'O refresh token só serve para obter novos tokens no Cognito.' },
        {
          text: 'Credenciais temporárias obtidas de um Identity Pool.',
          isCorrect: false,
          explanation: 'Essas credenciais são para assinar chamadas a serviços da AWS (SigV4), não para um Cognito authorizer.',
        },
      ],
    },
    {
      prompt:
        'Assim que um usuário confirma o cadastro num Cognito User Pool, a aplicação precisa criar o perfil dele numa tabela DynamoDB. Qual é a forma mais direta?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'User Pools invocam funções Lambda em pontos do fluxo de autenticação. O gatilho Post confirmation roda depois que o usuário confirma a conta — o momento certo para criar o perfil. Pre sign-up roda antes do cadastro (validar ou auto-confirmar), e Pre token generation roda antes da emissão dos tokens (adicionar ou remover claims).',
      officialReferences:
        'https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html',
      options: [
        { text: 'Um Lambda trigger Post confirmation no User Pool.', isCorrect: true, explanation: 'Correto.' },
        {
          text: 'Um Lambda trigger Pre sign-up no User Pool.',
          isCorrect: false,
          explanation: 'Roda antes do cadastro, quando o usuário ainda não confirmou a conta.',
        },
        {
          text: 'Um Lambda trigger Pre token generation.',
          isCorrect: false,
          explanation: 'Roda a cada emissão de tokens, não uma vez na confirmação.',
        },
        {
          text: 'Uma regra do EventBridge que consulta o User Pool a cada minuto.',
          isCorrect: false,
          explanation: 'Polling adiciona atraso e complexidade para algo que um gatilho nativo resolve.',
        },
      ],
    },
    {
      prompt:
        'Uma empresa está migrando de um sistema de login próprio para um Cognito User Pool. Ela quer migrar cada usuário no primeiro login, sem obrigá-lo a redefinir a senha e sem exportar as senhas antigas. Qual recurso atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'O Lambda trigger Migrate user é chamado quando o usuário não existe no User Pool: a função valida a senha no sistema antigo e, se ela estiver correta, devolve os atributos para o Cognito criar o usuário com a mesma senha. Uma importação em lote por CSV não carrega senhas, então todos teriam que redefini-las.',
      officialReferences:
        'https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html',
      options: [
        { text: 'O Lambda trigger Migrate user do User Pool.', isCorrect: true, explanation: 'Correto.' },
        {
          text: 'Importação de usuários em lote por arquivo CSV.',
          isCorrect: false,
          explanation: 'Não importa senhas; os usuários teriam que redefini-las.',
        },
        {
          text: 'Um Identity Pool federado com o sistema antigo.',
          isCorrect: false,
          explanation: 'Um Identity Pool entrega credenciais da AWS; não migra usuários para um User Pool.',
        },
        {
          text: 'Um Lambda trigger Pre sign-up que auto-confirma os usuários.',
          isCorrect: false,
          explanation: 'Exigiria que os usuários se cadastrassem de novo.',
        },
      ],
    },
    {
      prompt:
        'Um app mobile quer permitir que visitantes sem login leiam um catálogo público num bucket S3 direto do app, com acesso só de leitura a esse prefixo. Qual configuração atende?',
      type: 'APPLICATION',
      difficulty: 'EASY',
      explanation:
        'Identity Pools suportam identidades não autenticadas (guest). O visitante recebe credenciais temporárias da role de não autenticados, que deve ter só s3:GetObject no prefixo do catálogo.',
      options: [
        {
          text: 'Habilitar identidades não autenticadas no Identity Pool, com uma role que só permite leitura no prefixo.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Embutir no app uma access key de um usuário IAM com leitura no bucket.',
          isCorrect: false,
          explanation: 'Credenciais de longo prazo no app podem ser extraídas e nunca expiram.',
        },
        {
          text: 'Criar um usuário genérico no User Pool e deixar a senha no app.',
          isCorrect: false,
          explanation: 'Expõe uma credencial fixa e ainda não gera credenciais da AWS sem um Identity Pool.',
        },
        {
          text: 'Tornar o bucket inteiro público.',
          isCorrect: false,
          explanation: 'Expõe mais do que o necessário e contraria o menor privilégio.',
        },
      ],
    },
    {
      prompt:
        'Uma single-page application (sem backend próprio) vai usar o login hospedado do Cognito. Qual fluxo OAuth 2.0 é o recomendado para ela obter os tokens?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Clientes públicos, que não conseguem guardar um client secret (SPAs e apps mobile), devem usar o authorization code grant com PKCE. O implicit grant devolve os tokens na URL e não é mais recomendado; client credentials é para comunicação máquina a máquina.',
      officialReferences:
        'https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html',
      options: [
        { text: 'Authorization code grant com PKCE.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Implicit grant.', isCorrect: false, explanation: 'Expõe os tokens na URL e não emite refresh token.' },
        {
          text: 'Client credentials grant.',
          isCorrect: false,
          explanation: 'É para máquina a máquina e exige um client secret, que uma SPA não pode guardar.',
        },
        {
          text: 'Authorization code grant com o client secret embutido no JavaScript.',
          isCorrect: false,
          explanation: 'Qualquer pessoa leria o secret no código do navegador.',
        },
      ],
    },
    {
      prompt:
        'Um microsserviço em contêiner recebe access tokens de um Cognito User Pool e precisa validá-los por conta própria, sem API Gateway. Qual validação é a correta?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'O token é um JWT assinado com RS256. O serviço baixa as chaves públicas do User Pool em /.well-known/jwks.json, verifica a assinatura com a chave do kid do header, e confere exp, iss (a URL do User Pool), client_id (access token; no ID token é aud) e token_use. Apenas decodificar o payload não prova nada, porque qualquer um pode montar um JWT.',
      officialReferences:
        'https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html',
      options: [
        {
          text: 'Verificar a assinatura com as chaves públicas do JWKS do User Pool e conferir exp, iss, client_id e token_use.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Decodificar o payload em Base64 e conferir se o campo sub existe.',
          isCorrect: false,
          explanation: 'Não verifica a assinatura: um token forjado passaria.',
        },
        {
          text: 'Verificar a assinatura com o client secret do app client.',
          isCorrect: false,
          explanation: 'Os tokens são assinados com a chave privada do User Pool (RS256), não com o client secret.',
        },
        {
          text: 'Chamar sts:GetCallerIdentity com o token.',
          isCorrect: false,
          explanation: 'O STS não aceita tokens do User Pool como credencial.',
        },
      ],
    },
    {
      prompt:
        'Uma API no API Gateway precisa aceitar tokens emitidos por um provedor OAuth de terceiros (não Cognito) e decidir o acesso com base num header customizado e no path. Qual tipo de autorização usar?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Um Lambda authorizer roda código próprio: valida o token de qualquer provedor e devolve uma IAM policy (Allow/Deny), que pode ser cacheada. O tipo REQUEST recebe headers, query strings, path e stage variables. O Cognito authorizer só valida tokens de User Pools, e a autorização IAM exige requisições assinadas com SigV4.',
      officialReferences:
        'https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html',
      options: [
        { text: 'Um Lambda authorizer do tipo REQUEST.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Um Cognito User Pool authorizer.', isCorrect: false, explanation: 'Só valida tokens emitidos por User Pools.' },
        {
          text: 'Autorização IAM (AWS_IAM).',
          isCorrect: false,
          explanation: 'Exige que o cliente assine as requisições com credenciais da AWS.',
        },
        {
          text: 'API keys com usage plan.',
          isCorrect: false,
          explanation: 'API keys servem para identificar clientes e aplicar cotas, não para autorização.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda na conta A precisa ler e gravar em vários serviços da conta B. Qual é a abordagem recomendada?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Cria-se uma role na conta B com as permissões necessárias e uma trust policy que confia na execution role da conta A. A execution role da conta A precisa de permissão sts:AssumeRole nessa role. A função chama AssumeRole e usa as credenciais temporárias para acessar a conta B. Os dois lados precisam permitir: a trust policy em B e a permissão de identidade em A.',
      officialReferences:
        'https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html',
      options: [
        {
          text: 'Criar na conta B uma role que confia na execution role da conta A, e a função chama sts:AssumeRole nela.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Criar um usuário IAM na conta B e guardar a access key numa variável de ambiente da função.',
          isCorrect: false,
          explanation: 'Credenciais de longo prazo são o que roles existem para evitar.',
        },
        {
          text: 'Adicionar à execution role da conta A as permissões sobre os recursos da conta B.',
          isCorrect: false,
          explanation: 'Uma policy da conta A sozinha não concede acesso a recursos de outra conta.',
        },
        {
          text: 'Usar o mesmo nome de role nas duas contas.',
          isCorrect: false,
          explanation: 'Nomes iguais não estabelecem nenhuma relação de confiança.',
        },
      ],
    },
    {
      prompt:
        'Num app com Cognito User Pool e Identity Pool, usuários do grupo "admin" devem receber credenciais da AWS com mais permissões que os demais usuários autenticados. Como configurar?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Cada grupo do User Pool pode ter uma IAM role associada, e os tokens trazem as claims cognito:groups e cognito:preferred_role. No Identity Pool, o provedor do User Pool é configurado para escolher a role a partir do token ("Choose role from token"). Assim cada usuário recebe credenciais da role do seu grupo, sem código adicional.',
      officialReferences: 'https://docs.aws.amazon.com/cognito/latest/developerguide/role-based-access-control.html',
      options: [
        {
          text: 'Associar uma IAM role ao grupo admin no User Pool e configurar o Identity Pool para escolher a role pelo token.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Criar um segundo Identity Pool só para administradores.',
          isCorrect: false,
          explanation: 'Duplica a configuração; role-based access control resolve num pool só.',
        },
        {
          text: 'Dar à role de autenticados as permissões de admin e checar o grupo no front-end.',
          isCorrect: false,
          explanation: 'Todo usuário autenticado teria as credenciais de admin; o front-end não é barreira de segurança.',
        },
        {
          text: 'Guardar a role desejada num atributo customizado editável pelo usuário.',
          isCorrect: false,
          explanation: 'O próprio usuário poderia se promover.',
        },
      ],
    },
  ];

  await seedQuestions(authTopic.id, authReinforcementQuestions);

  await seedFlashcards(authTopic.id, [
    {
      conceptName: 'Lambda triggers do User Pool',
      conceptDescription: 'Funções Lambda que o Cognito invoca em pontos do fluxo de cadastro, login e emissão de tokens.',
      serviceId: cognitoService.id,
      front: 'Cite 4 Lambda triggers de um Cognito User Pool e para que servem.',
      back: 'Pre sign-up (validar/auto-confirmar cadastro), Post confirmation (ex.: criar perfil no banco), Pre token generation (adicionar/remover claims) e Migrate user (migrar usuário de um sistema antigo no primeiro login).',
    },
    {
      conceptName: 'Authorization code com PKCE',
      conceptDescription: 'Fluxo OAuth 2.0 recomendado para clientes públicos, que não conseguem guardar um client secret.',
      serviceId: cognitoService.id,
      front: 'Qual fluxo OAuth uma SPA ou app mobile deve usar com o Cognito?',
      back: 'Authorization code grant com PKCE. O implicit grant expõe tokens na URL e não é mais recomendado; client credentials é para máquina a máquina.',
    },
    {
      conceptName: 'Validação de JWT do Cognito',
      conceptDescription: 'Verificação que um backend faz de um token do User Pool sem depender do API Gateway.',
      serviceId: cognitoService.id,
      front: 'Como um backend valida por conta própria um token de um Cognito User Pool?',
      back: 'Verifica a assinatura RS256 com as chaves públicas em /.well-known/jwks.json do User Pool e confere exp, iss, aud (ID token) ou client_id (access token) e token_use.',
    },
    {
      conceptName: 'Tipos de autorização no API Gateway',
      conceptDescription: 'As opções de autorização de um método: IAM, Cognito User Pool authorizer e Lambda authorizer.',
      serviceId: cognitoService.id,
      front: 'Quando usar IAM, Cognito authorizer ou Lambda authorizer no API Gateway?',
      back: 'IAM: chamadores com credenciais da AWS (SigV4). Cognito authorizer: tokens de um User Pool. Lambda authorizer: qualquer outra lógica, como tokens de terceiros ou headers customizados (TOKEN ou REQUEST).',
    },
    {
      conceptName: 'Acesso entre contas com AssumeRole',
      conceptDescription: 'Padrão em que uma role numa conta confia num principal de outra conta, que a assume via STS.',
      serviceId: iamService.id,
      front: 'O que é preciso para uma função na conta A assumir uma role na conta B?',
      back: 'Na conta B, uma trust policy na role permitindo o principal da conta A. Na conta A, permissão sts:AssumeRole para essa role na identidade da função. Os dois lados precisam permitir.',
    },
  ]);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 2 of 12: Domain 1 "Padrões de arquitetura
  // e tolerância a falhas" -- same shape as the Cognito topic above.
  // ---------------------------------------------------------------------

  const architectureTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: domain.id, name: 'Padrões de arquitetura e tolerância a falhas' },
  });

  const sqsServiceData = {
    shortName: 'SQS',
    category: 'Application Integration',
    description:
      'Fila de mensagens gerenciada que desacopla produtores e consumidores, com suporte a filas Standard e FIFO e dead-letter queues.',
  };
  const sqsService = await prisma.aWSService.upsert({
    where: { name: 'Amazon SQS' },
    update: sqsServiceData,
    create: { name: 'Amazon SQS', ...sqsServiceData },
  });

  const snsServiceData = {
    shortName: 'SNS',
    category: 'Application Integration',
    description:
      'Serviço de publicação/assinatura (pub/sub) que entrega cada mensagem publicada num tópico a todos os seus assinantes, base do padrão fanout.',
  };
  const snsService = await prisma.aWSService.upsert({
    where: { name: 'Amazon SNS' },
    update: snsServiceData,
    create: { name: 'Amazon SNS', ...snsServiceData },
  });

  const stepFunctionsServiceData = {
    shortName: 'Step Functions',
    category: 'Application Integration',
    description:
      'Orquestrador de workflows serverless que coordena etapas de uma aplicação como uma máquina de estados, com Retry e Catch declarativos.',
  };
  const stepFunctionsService = await prisma.aWSService.upsert({
    where: { name: 'AWS Step Functions' },
    update: stepFunctionsServiceData,
    create: { name: 'AWS Step Functions', ...stepFunctionsServiceData },
  });

  const architectureLessonContent = `## Objetivo

Ao final desta lição você vai conseguir escolher entre monolito, microsserviços e arquitetura orientada a eventos, diferenciar coreografia de orquestração, e aplicar as técnicas de tolerância a falhas que a prova DVA-C02 mais cobra: retry com backoff exponencial e jitter, dead-letter queues e idempotência.

## Monolito, microsserviços e orientação a eventos

Um monolito empacota toda a aplicação numa única unidade de deploy — simples de começar, mas qualquer mudança exige redeploy do todo e uma parte sobrecarregada escala junto com o resto. Microsserviços quebram a aplicação em serviços pequenos, cada um com seu próprio deploy e seus próprios dados, que se comunicam por APIs ou mensagens. Uma arquitetura orientada a eventos vai além no desacoplamento: um serviço publica um evento ("pedido criado") sem saber quem vai consumi-lo, e cada consumidor reage no seu ritmo. Na AWS, os blocos típicos são o Amazon SQS (filas), o Amazon SNS (pub/sub) e o Amazon EventBridge (barramento de eventos com regras de roteamento).

## Acoplamento síncrono vs. assíncrono

Numa chamada síncrona (ex.: API Gateway → Lambda → outro serviço via HTTP), se o serviço de destino cai, a falha se propaga até o usuário. Colocar uma fila SQS no meio torna a comunicação assíncrona: o produtor grava a mensagem e segue em frente; se o consumidor estiver fora do ar, as mensagens esperam na fila (retenção padrão de 4 dias, configurável até 14). A fila também absorve picos — o consumidor processa no ritmo que aguenta, em vez de ser derrubado pela carga.

## Fanout com SNS + SQS

Quando o mesmo evento precisa ser processado por vários consumidores independentes (ex.: um pedido criado dispara cobrança, e-mail e atualização de estoque), o padrão é o fanout: publica-se uma vez num tópico SNS, e cada consumidor tem sua própria fila SQS assinando o tópico. Cada fila recebe uma cópia da mensagem, e uma falha num consumidor não afeta os outros. Filter policies na assinatura permitem que cada fila receba só as mensagens que lhe interessam.

## Coreografia vs. orquestração

Na coreografia, não há um coordenador central: cada serviço reage a eventos e emite novos eventos (tipicamente com EventBridge ou SNS). É muito desacoplado, mas o fluxo completo fica espalhado e difícil de enxergar. Na orquestração, um coordenador central define a sequência de passos, trata erros e mantém o estado do fluxo — na AWS, o AWS Step Functions. Use orquestração quando o processo tem ordem definida, passos compensatórios ou precisa de visibilidade do estado de cada execução; use coreografia quando os consumidores são independentes entre si.

## Retry com backoff exponencial e jitter

Falhas transitórias (throttling, 5xx, timeouts) devem ser repetidas — mas repetir imediatamente, e todos os clientes ao mesmo tempo, piora a sobrecarga. Backoff exponencial aumenta o intervalo entre tentativas (ex.: 100 ms, 200 ms, 400 ms...), e o jitter adiciona aleatoriedade a esse intervalo para que os clientes não tentem de novo sincronizados. Os AWS SDKs já fazem isso automaticamente para erros repetíveis (como \`ThrottlingException\`); erros 4xx de validação (ex.: parâmetro inválido) não devem ser repetidos, porque vão falhar de novo. No Step Functions, o campo \`Retry\` de um estado aceita \`IntervalSeconds\`, \`MaxAttempts\`, \`BackoffRate\` e \`JitterStrategy\`.

## Dead-letter queues (DLQ)

Uma mensagem que falha repetidamente (uma "poison message") não pode ficar sendo reprocessada para sempre. Numa fila SQS, a redrive policy define um \`maxReceiveCount\`: depois de recebida esse número de vezes sem ser excluída, a mensagem é movida para a dead-letter queue, onde pode ser inspecionada e, depois de corrigido o problema, reenviada (redrive) para a fila original. A DLQ precisa ser do mesmo tipo da fila de origem (Standard ou FIFO), na mesma conta e região. Invocações assíncronas do Lambda têm um mecanismo próprio: por padrão, o Lambda tenta de novo duas vezes após a primeira falha, e depois pode enviar o evento para uma DLQ ou para um on-failure destination.

## Idempotência

Filas SQS Standard garantem entrega pelo menos uma vez (at-least-once), e qualquer retry pode reprocessar a mesma mensagem. Por isso, consumidores devem ser idempotentes: processar a mesma mensagem duas vezes precisa ter o mesmo efeito que processar uma vez (ex.: gravar com uma chave única e uma escrita condicional no DynamoDB, em vez de somar um valor cegamente).

## Relação com a prova DVA-C02

Espere questões de cenário pedindo para desacoplar componentes com SQS, escolher SNS + SQS para fanout, decidir entre Step Functions e coreografia por eventos, configurar uma DLQ com \`maxReceiveCount\`, e reconhecer backoff exponencial com jitter como a resposta certa para erros de throttling.`;

  const existingArchitectureLesson = await prisma.lesson.findFirst({
    where: { topicId: architectureTopic.id, title: 'Arquiteturas desacopladas e tolerantes a falhas' },
  });

  if (existingArchitectureLesson) {
    await prisma.lesson.update({
      where: { id: existingArchitectureLesson.id },
      data: { content: architectureLessonContent },
    });
  } else {
    await prisma.lesson.create({
      data: {
        topicId: architectureTopic.id,
        order: 1,
        estimatedMinutes: 10,
        title: 'Arquiteturas desacopladas e tolerantes a falhas',
        content: architectureLessonContent,
        resources: {
          create: [
            {
              title: 'Amazon SQS dead-letter queues — documentação oficial',
              url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html',
              type: 'documentation',
              order: 1,
            },
            {
              title: 'Retry behavior nos AWS SDKs — documentação oficial',
              url: 'https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html',
              type: 'documentation',
              order: 2,
            },
          ],
        },
      },
    });
  }

  const architectureLabData = {
    level: 1,
    order: 1,
    estimatedMinutes: 25,
    objective:
      'Ao final deste laboratório você terá montado um fanout SNS → duas filas SQS pelo Console, confirmado que cada fila recebe sua própria cópia de uma mensagem publicada, e visto uma mensagem não processada ser movida para uma dead-letter queue.',
    prerequisites:
      'Conta AWS com acesso ao Console (Free Tier é suficiente). Não é necessário conhecimento prévio de SQS ou SNS.',
    context:
      'Uma loja virtual quer que cada pedido criado dispare, de forma independente, a cobrança e o envio de e-mail de confirmação — sem que uma falha no serviço de e-mail atrase a cobrança. O time decidiu usar o padrão fanout com SNS + SQS e quer validar o comportamento, incluindo o que acontece com uma mensagem que nunca é processada com sucesso.',
    troubleshooting:
      'A fila não recebe a mensagem publicada no tópico: confira se a assinatura aparece como "Confirmed" no tópico SNS e se a access policy da fila permite `sqs:SendMessage` a partir do ARN do tópico (criar a assinatura pela tela da fila, via "Subscribe to Amazon SNS topic", já ajusta essa policy automaticamente). \n\nA mensagem chega "embrulhada" num JSON com campos como `Type`, `MessageId` e `Message`: é o envelope padrão do SNS — o texto publicado está no campo `Message`. Habilite "raw message delivery" na assinatura se quiser só o corpo original. \n\nA mensagem não vai para a DLQ: ela só é movida depois de ser recebida mais vezes que o `maxReceiveCount` sem ser excluída — espere o visibility timeout expirar entre cada "Poll for messages" e não clique em "Delete".',
    cleanup:
      'Exclua o tópico SNS `devlab-pedidos` e as três filas (`devlab-cobranca`, `devlab-email` e `devlab-email-dlq`) pelo Console. Excluir o tópico remove também as assinaturas.',
    costWarning:
      'O Free Tier inclui 1 milhão de requisições SQS e 1 milhão de publicações SNS por mês. Este laboratório faz algumas dezenas de requisições, então não deve gerar cobrança.',
  };

  const existingArchitectureLab = await prisma.lab.findFirst({
    where: { topicId: architectureTopic.id, title: 'Fanout com SNS e SQS e uma dead-letter queue' },
  });

  if (existingArchitectureLab) {
    await prisma.lab.update({ where: { id: existingArchitectureLab.id }, data: architectureLabData });
  } else {
    await prisma.lab.create({
      data: {
        topicId: architectureTopic.id,
        title: 'Fanout com SNS e SQS e uma dead-letter queue',
        ...architectureLabData,
        steps: {
          create: [
            {
              order: 1,
              title: 'Criar a dead-letter queue',
              instructions:
                'No Console da AWS, acesse o Amazon SQS e clique em "Create queue". Escolha o tipo Standard, dê o nome `devlab-email-dlq` e mantenha as demais configurações padrão.',
              validation: 'A fila `devlab-email-dlq` aparece na lista de filas do SQS.',
            },
            {
              order: 2,
              title: 'Criar as duas filas consumidoras',
              instructions:
                'Crie uma fila Standard chamada `devlab-cobranca` com as configurações padrão. Depois crie outra chamada `devlab-email`, alterando o "Visibility timeout" para 10 segundos e, na seção "Dead-letter queue", habilite a opção, escolha `devlab-email-dlq` e defina "Maximum receives" como 2.',
              validation:
                'As filas `devlab-cobranca` e `devlab-email` aparecem na lista, e os detalhes de `devlab-email` mostram `devlab-email-dlq` como dead-letter queue com maximum receives igual a 2.',
            },
            {
              order: 3,
              title: 'Criar o tópico SNS e assinar as filas',
              instructions:
                'Acesse o Amazon SNS, crie um tópico Standard chamado `devlab-pedidos`. Volte ao SQS, abra a fila `devlab-cobranca`, clique em "Subscribe to Amazon SNS topic" e escolha `devlab-pedidos`. Repita para a fila `devlab-email`.',
              validation:
                'Na página do tópico `devlab-pedidos`, a aba "Subscriptions" lista duas assinaturas do protocolo SQS, ambas com status "Confirmed".',
            },
            {
              order: 4,
              title: 'Publicar uma mensagem e verificar o fanout',
              instructions:
                'No tópico `devlab-pedidos`, clique em "Publish message" e publique o corpo `{"pedidoId": "123"}`. Em seguida, abra cada uma das duas filas no SQS e use "Send and receive messages" > "Poll for messages".',
              validation:
                'As duas filas mostram uma mensagem cada, contendo o envelope do SNS com `{"pedidoId": "123"}` no campo `Message` — cada consumidor recebeu sua própria cópia.',
            },
            {
              order: 5,
              title: 'Ver a mensagem ir para a DLQ',
              instructions:
                'Na fila `devlab-email`, faça "Poll for messages" repetidamente, sem excluir a mensagem, esperando cerca de 10 segundos (o visibility timeout) entre cada tentativa — isso simula um consumidor que falha sempre. Depois de mais de 2 recebimentos, consulte a fila `devlab-email-dlq`.',
              validation:
                'A mensagem deixa de aparecer em `devlab-email` e passa a aparecer em `devlab-email-dlq`, enquanto `devlab-cobranca` continua com sua cópia intacta — a falha de um consumidor não afetou o outro.',
            },
          ],
        },
      },
    });
  }

  const architectureQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'O que é uma dead-letter queue (DLQ) no Amazon SQS?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Uma DLQ é uma fila para onde o SQS move mensagens que foram recebidas mais vezes que o maxReceiveCount da redrive policy sem serem excluídas, isolando mensagens problemáticas para análise sem bloquear o processamento das demais.',
      officialReferences:
        'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html',
      options: [
        {
          text: 'Uma fila que recebe mensagens que falharam no processamento depois de um número máximo de recebimentos (maxReceiveCount).',
          isCorrect: true,
          explanation: 'Correto: é o mecanismo de isolar "poison messages" definido pela redrive policy da fila de origem.',
        },
        {
          text: 'Uma fila que armazena mensagens excluídas para permitir recuperá-las depois.',
          isCorrect: false,
          explanation: 'Mensagens excluídas com DeleteMessage são removidas de vez; a DLQ recebe mensagens que nunca foram excluídas com sucesso.',
        },
        {
          text: 'Uma fila FIFO usada para garantir a ordem das mensagens.',
          isCorrect: false,
          explanation: 'Ordenação é característica de filas FIFO, não o propósito de uma DLQ.',
        },
        {
          text: 'Uma fila que recebe mensagens que expiraram pelo período de retenção.',
          isCorrect: false,
          explanation: 'Mensagens que excedem o período de retenção são descartadas, não movidas para a DLQ.',
        },
      ],
    },
    {
      prompt:
        'Por que se adiciona jitter (aleatoriedade) ao backoff exponencial em uma estratégia de retry?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Sem jitter, clientes que falharam ao mesmo tempo tentam de novo nos mesmos instantes, gerando picos sincronizados de carga. O jitter espalha as novas tentativas no tempo, reduzindo a contenção no serviço que está se recuperando.',
      officialReferences: 'https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html',
      options: [
        {
          text: 'Para evitar que muitos clientes tentem de novo exatamente ao mesmo tempo, espalhando a carga das novas tentativas.',
          isCorrect: true,
          explanation: 'Correto: o jitter quebra a sincronização entre clientes que falharam juntos.',
        },
        {
          text: 'Para garantir que a requisição seja bem-sucedida na segunda tentativa.',
          isCorrect: false,
          explanation: 'Nenhuma estratégia de retry garante sucesso; o jitter só reduz a contenção.',
        },
        {
          text: 'Para reduzir o número total de tentativas feitas pelo SDK.',
          isCorrect: false,
          explanation: 'O número máximo de tentativas é configurado separadamente; o jitter afeta o intervalo entre elas.',
        },
        {
          text: 'Para criptografar o intervalo entre as tentativas.',
          isCorrect: false,
          explanation: 'Jitter não tem relação com criptografia.',
        },
      ],
    },
    {
      prompt:
        'Quando um pedido é criado, uma aplicação precisa acionar três processos independentes: cobrança, envio de e-mail e atualização de estoque. Uma falha em um deles não pode impedir os outros. Qual arquitetura atende isso de forma desacoplada?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'O padrão fanout — publicar o evento uma vez num tópico SNS com três filas SQS assinantes, uma por processo — entrega uma cópia independente a cada consumidor, e cada fila absorve falhas e picos do seu próprio consumidor.',
      options: [
        {
          text: 'Publicar o evento num tópico SNS com três filas SQS assinantes, uma por processo.',
          isCorrect: true,
          explanation: 'Correto: é o fanout SNS + SQS — cada consumidor recebe e processa sua cópia de forma independente.',
        },
        {
          text: 'Uma única fila SQS lida pelos três processos.',
          isCorrect: false,
          explanation: 'Numa única fila, cada mensagem é consumida por apenas um dos consumidores, não pelos três.',
        },
        {
          text: 'Uma função Lambda que chama os três processos em sequência, de forma síncrona.',
          isCorrect: false,
          explanation: 'Acopla os três processos: uma falha ou lentidão num deles afeta os outros.',
        },
        {
          text: 'Gravar o pedido num bucket S3 e fazer os três processos consultarem o bucket periodicamente.',
          isCorrect: false,
          explanation: 'Polling periódico de um bucket é ineficiente e não é o padrão de mensageria indicado para esse cenário.',
        },
      ],
    },
    {
      prompt:
        'Um processo de pedido tem etapas em ordem definida (reservar estoque, cobrar o cartão, emitir nota), e se a cobrança falhar a reserva de estoque precisa ser desfeita. O time quer visualizar o estado de cada execução. Qual abordagem é a mais adequada?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Um fluxo com ordem definida, passos compensatórios e necessidade de visibilidade do estado é o caso típico de orquestração. O AWS Step Functions modela o fluxo como uma máquina de estados, com Retry e Catch declarativos e histórico de cada execução.',
      officialReferences: 'https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html',
      options: [
        {
          text: 'Orquestração com AWS Step Functions, usando Catch para acionar a etapa de compensação.',
          isCorrect: true,
          explanation: 'Correto: o orquestrador central controla a ordem, trata falhas e expõe o estado de cada execução.',
        },
        {
          text: 'Coreografia pura com eventos no EventBridge, sem nenhum coordenador.',
          isCorrect: false,
          explanation: 'Coreografia funciona, mas espalha o fluxo e a compensação entre serviços e dificulta visualizar o estado de cada execução.',
        },
        {
          text: 'Uma única fila SQS FIFO com as três etapas como mensagens.',
          isCorrect: false,
          explanation: 'A FIFO garante ordem de entrega, mas não coordena compensação nem oferece visão do estado do fluxo.',
        },
        {
          text: 'Um tópico SNS enviando o pedido para as três etapas ao mesmo tempo.',
          isCorrect: false,
          explanation: 'Fanout executa as etapas em paralelo, sem respeitar a ordem exigida.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação que chama o DynamoDB começa a receber erros ProvisionedThroughputExceededException em horários de pico. Qual é a abordagem recomendada no código cliente?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Erros de throttling são transitórios e devem ser repetidos com backoff exponencial e jitter — que os AWS SDKs já aplicam automaticamente, podendo-se ajustar o número máximo de tentativas. Repetir imediatamente ou em loop agrava a sobrecarga.',
      options: [
        {
          text: 'Repetir as requisições com backoff exponencial e jitter (comportamento padrão dos AWS SDKs).',
          isCorrect: true,
          explanation: 'Correto: é a estratégia recomendada para erros de throttling.',
        },
        {
          text: 'Repetir a requisição imediatamente em loop até ter sucesso.',
          isCorrect: false,
          explanation: 'Retries imediatos e ilimitados aumentam a carga justamente quando o serviço está limitando requisições.',
        },
        {
          text: 'Tratar o erro como definitivo e descartar a requisição.',
          isCorrect: false,
          explanation: 'Throttling é transitório; descartar a requisição perde dados sem necessidade.',
        },
        {
          text: 'Trocar a região da tabela a cada erro recebido.',
          isCorrect: false,
          explanation: 'Não resolve a causa (capacidade insuficiente no pico) e não é uma estratégia de retry.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda consome mensagens de uma fila SQS Standard e grava um pagamento no banco a cada mensagem. Em raras ocasiões, o mesmo pagamento é gravado duas vezes. Qual é a causa mais provável e a correção adequada?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Filas SQS Standard garantem entrega pelo menos uma vez (at-least-once), então a mesma mensagem pode ser entregue mais de uma vez — por exemplo, após um retry. A correção é tornar o consumidor idempotente, por exemplo usando um identificador único do pagamento com uma escrita condicional.',
      options: [
        {
          text: 'A entrega at-least-once da fila Standard pode repetir mensagens; o consumidor deve ser idempotente (ex.: escrita condicional por um ID único do pagamento).',
          isCorrect: true,
          explanation: 'Correto: duplicatas ocasionais são esperadas numa fila Standard, e a defesa é a idempotência no consumidor.',
        },
        {
          text: 'O visibility timeout está alto demais; basta reduzi-lo para zero.',
          isCorrect: false,
          explanation: 'Um visibility timeout menor que o tempo de processamento aumenta as duplicatas, em vez de eliminá-las.',
        },
        {
          text: 'A fila deveria ter uma dead-letter queue, que impede entregas duplicadas.',
          isCorrect: false,
          explanation: 'A DLQ isola mensagens que falham repetidamente; ela não evita duplicatas.',
        },
        {
          text: 'O Lambda está com concorrência reservada baixa demais.',
          isCorrect: false,
          explanation: 'A concorrência afeta a vazão, não a semântica de entrega da fila.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda é invocada por uma fila SQS (event source mapping). Algumas mensagens falham sempre no processamento e ficam voltando para a fila indefinidamente. Como isolar essas mensagens para análise?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Num event source mapping com SQS, quem controla os retries é a própria fila: a mensagem volta a ficar visível depois do visibility timeout. Por isso a DLQ deve ser configurada na redrive policy da fila de origem (com um maxReceiveCount). A DLQ/on-failure destination da função só se aplica a invocações assíncronas, não a este caso.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html',
      options: [
        {
          text: 'Configurar uma redrive policy na fila SQS de origem, apontando para uma DLQ com um maxReceiveCount adequado.',
          isCorrect: true,
          explanation: 'Correto: no event source mapping com SQS, a DLQ é configurada na fila, não na função.',
        },
        {
          text: 'Configurar uma dead-letter queue nas configurações de invocação assíncrona da função Lambda.',
          isCorrect: false,
          explanation: 'Essa DLQ só vale para invocações assíncronas; mensagens lidas via event source mapping do SQS não passam por ela.',
        },
        {
          text: 'Aumentar o timeout da função Lambda para o máximo de 15 minutos.',
          isCorrect: false,
          explanation: 'Se a mensagem falha sempre por um erro de lógica ou de dados, mais tempo não resolve.',
        },
        {
          text: 'Converter a fila para FIFO, que descarta mensagens com falha automaticamente.',
          isCorrect: false,
          explanation: 'Filas FIFO não descartam mensagens com falha; elas também dependem de uma DLQ (do tipo FIFO).',
        },
      ],
    },
  ];

  await seedQuestions(architectureTopic.id, architectureQuestionsToSeed);

  const architectureFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Fanout SNS + SQS',
      conceptDescription: 'Padrão em que um tópico SNS entrega cada mensagem a várias filas SQS assinantes, uma por consumidor independente.',
      serviceId: snsService.id,
      front: 'Como entregar o mesmo evento a vários consumidores independentes, isolando falhas de cada um?',
      back: 'Fanout: publicar num tópico SNS com uma fila SQS assinante por consumidor. Cada fila recebe sua própria cópia, e a falha de um consumidor não afeta os outros.',
    },
    {
      conceptName: 'Dead-letter queue',
      conceptDescription: 'Fila para onde o SQS move mensagens recebidas mais vezes que o maxReceiveCount sem serem excluídas.',
      serviceId: sqsService.id,
      front: 'O que faz uma mensagem SQS ser movida para a dead-letter queue?',
      back: 'Ser recebida mais vezes que o maxReceiveCount da redrive policy sem ser excluída. A DLQ precisa ser do mesmo tipo (Standard/FIFO), na mesma conta e região.',
    },
    {
      conceptName: 'Backoff exponencial com jitter',
      conceptDescription: 'Estratégia de retry que aumenta exponencialmente o intervalo entre tentativas e adiciona aleatoriedade para evitar picos sincronizados.',
      serviceId: sqsService.id,
      front: 'Qual a estratégia recomendada para repetir chamadas que falharam por throttling?',
      back: 'Retry com backoff exponencial (intervalos crescentes) e jitter (aleatoriedade no intervalo). Os AWS SDKs já fazem isso por padrão para erros repetíveis.',
    },
    {
      conceptName: 'Coreografia vs. orquestração',
      conceptDescription: 'Duas formas de coordenar microsserviços: reação descentralizada a eventos vs. um coordenador central do fluxo.',
      serviceId: stepFunctionsService.id,
      front: 'Qual a diferença entre coreografia e orquestração de microsserviços?',
      back: 'Coreografia: cada serviço reage a eventos, sem coordenador central (ex.: EventBridge). Orquestração: um coordenador central define a ordem e trata erros (ex.: Step Functions).',
    },
    {
      conceptName: 'Idempotência de consumidores',
      conceptDescription: 'Propriedade de um consumidor que produz o mesmo efeito ao processar a mesma mensagem mais de uma vez.',
      serviceId: sqsService.id,
      front: 'Por que consumidores de uma fila SQS Standard devem ser idempotentes?',
      back: 'Porque a fila Standard garante entrega pelo menos uma vez (at-least-once): a mesma mensagem pode chegar mais de uma vez, e processá-la de novo não pode duplicar o efeito.',
    },
  ];

  await seedFlashcards(architectureTopic.id, architectureFlashcardsToSeed);

  // Reinforcement (Session 31): brings this pre-readiness-bar topic up to
  // the bar -- FIFO queues, visibility timeout, EventBridge vs. SNS, Step
  // Functions workflow types and error handling, Kinesis vs. SQS.
  const kinesisServiceData = {
    shortName: 'Kinesis Data Streams',
    category: 'Analytics',
    description:
      'Stream de dados em tempo real dividido em shards, com ordem por partition key, retenção configurável e vários consumidores lendo os mesmos registros.',
  };
  const kinesisService = await prisma.aWSService.upsert({
    where: { name: 'Amazon Kinesis Data Streams' },
    update: kinesisServiceData,
    create: { name: 'Amazon Kinesis Data Streams', ...kinesisServiceData },
  });

  const architectureReinforcementQuestions: QuestionSeed[] = [
    {
      prompt:
        'Uma fila SQS FIFO recebe eventos de pedidos de muitos clientes. Os eventos de um mesmo pedido precisam ser processados em ordem, mas pedidos diferentes podem ser processados em paralelo. Como enviar as mensagens?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Numa fila FIFO, a ordem é garantida dentro de cada message group. Usar o ID do pedido como MessageGroupId mantém a ordem por pedido e permite que grupos diferentes sejam consumidos em paralelo. Um MessageGroupId único para tudo serializaria a fila inteira.',
      officialReferences:
        'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-key-terms.html',
      options: [
        { text: 'Usar o ID do pedido como MessageGroupId.', isCorrect: true, explanation: 'Correto.' },
        {
          text: 'Usar o mesmo MessageGroupId em todas as mensagens.',
          isCorrect: false,
          explanation: 'Garante ordem, mas só um consumidor processa por vez: perde o paralelismo.',
        },
        {
          text: 'Usar o ID do pedido como MessageDeduplicationId.',
          isCorrect: false,
          explanation: 'Descartaria como duplicados todos os eventos seguintes do mesmo pedido (janela de 5 minutos).',
        },
        {
          text: 'Usar uma fila Standard com DelaySeconds.',
          isCorrect: false,
          explanation: 'Filas Standard não garantem ordem.',
        },
      ],
    },
    {
      prompt: 'Como uma fila SQS FIFO evita mensagens duplicadas enviadas pelo produtor?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Mensagens com o mesmo MessageDeduplicationId, enviadas dentro de uma janela de 5 minutos, são aceitas mas entregues só uma vez. Com content-based deduplication habilitada, o SQS usa um hash SHA-256 do corpo como ID.',
      options: [
        {
          text: 'Descarta mensagens com o mesmo MessageDeduplicationId dentro de uma janela de 5 minutos.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Compara cada mensagem com todas as já enviadas desde a criação da fila.',
          isCorrect: false,
          explanation: 'A janela de deduplicação é de 5 minutos.',
        },
        { text: 'Pelo MessageGroupId.', isCorrect: false, explanation: 'O MessageGroupId define a ordem, não a deduplicação.' },
        { text: 'Não evita; o consumidor precisa tratar.', isCorrect: false, explanation: 'Isso vale para filas Standard.' },
      ],
    },
    {
      prompt:
        'Uma função Lambda com timeout de 5 minutos consome uma fila SQS cujo visibility timeout é 30 segundos. Mensagens estão sendo processadas mais de uma vez, mesmo sem erros. Qual é a correção?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Se o processamento passa do visibility timeout, a mensagem volta a ficar visível e outro consumidor a recebe. A AWS recomenda que o visibility timeout da fila seja de pelo menos 6 vezes o timeout da função quando ela é consumida por um event source mapping.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html',
      options: [
        {
          text: 'Aumentar o visibility timeout da fila para pelo menos 6 vezes o timeout da função (30 minutos).',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Reduzir o visibility timeout para 5 segundos.',
          isCorrect: false,
          explanation: 'As mensagens voltariam a ficar visíveis ainda mais cedo.',
        },
        {
          text: 'Aumentar o maxReceiveCount da redrive policy.',
          isCorrect: false,
          explanation: 'Controla quando a mensagem vai para a DLQ, não a duplicação.',
        },
        {
          text: 'Habilitar long polling na fila.',
          isCorrect: false,
          explanation: 'Reduz respostas vazias, mas não impede que a mensagem reapareça.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação precisa reagir a eventos de mudança de estado de instâncias EC2 e a eventos de um parceiro SaaS, roteando para alvos diferentes conforme campos do conteúdo do evento, e poder reprocessar eventos antigos. Qual serviço atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'O Amazon EventBridge recebe eventos de serviços da AWS e de parceiros SaaS, roteia com regras que filtram qualquer campo do evento (event patterns) e oferece archive e replay. O SNS tem filter policies, mas não recebe eventos de parceiros SaaS nem tem replay de eventos arquivados.',
      officialReferences: 'https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html',
      options: [
        {
          text: 'Amazon EventBridge, com regras por event pattern e archive/replay.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Amazon SNS com filter policies.',
          isCorrect: false,
          explanation: 'Não recebe eventos de parceiros SaaS e não tem archive/replay.',
        },
        {
          text: 'Amazon SQS com várias filas.',
          isCorrect: false,
          explanation: 'Filas não roteiam por conteúdo nem recebem esses eventos diretamente.',
        },
        {
          text: 'AWS Step Functions.',
          isCorrect: false,
          explanation: 'Orquestra workflows; não é um roteador de eventos.',
        },
      ],
    },
    {
      prompt:
        'Um workflow do Step Functions processa milhares de eventos de IoT por segundo, cada execução dura menos de 1 minuto e pode ser repetida sem problema. Qual tipo de workflow é o mais adequado e barato?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'Express workflows são feitos para alto volume e execuções curtas (até 5 minutos), cobrados por número de requisições e duração, com semântica at-least-once (assíncrono). Standard workflows duram até 1 ano, têm execução exactly-once e histórico completo, e são cobrados por transição de estado — caros nesse volume.',
      officialReferences:
        'https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html',
      options: [
        { text: 'Express workflow.', isCorrect: true, explanation: 'Correto.' },
        {
          text: 'Standard workflow.',
          isCorrect: false,
          explanation: 'Cobrado por transição de estado; indicado para processos longos ou que exigem exactly-once.',
        },
        {
          text: 'Um Standard workflow com uma execução por hora processando todos os eventos.',
          isCorrect: false,
          explanation: 'Troca tempo real por lotes sem necessidade.',
        },
        {
          text: 'Step Functions não suporta esse volume; usar só Lambda.',
          isCorrect: false,
          explanation: 'Express workflows suportam taxas muito altas de início de execução.',
        },
      ],
    },
    {
      prompt:
        'Num estado Task do Step Functions, o time quer repetir falhas transitórias algumas vezes e, se ainda falhar, seguir para um estado de notificação levando o input original junto com os detalhes do erro. Qual configuração atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Retry é avaliado primeiro; só depois de esgotadas as tentativas o Catch direciona para o estado de fallback. Com ResultPath: "$.error" no Catch, o erro é adicionado ao input original em vez de substituí-lo (sem ResultPath, o output do Catch é só o objeto de erro).',
      officialReferences: 'https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html',
      options: [
        {
          text: 'Retry para os erros transitórios e Catch com Next para o estado de notificação e ResultPath "$.error".',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Só Catch com ResultPath "$".',
          isCorrect: false,
          explanation: 'Não repete, e "$" substitui o input original pelo erro.',
        },
        {
          text: 'Só Retry com MaxAttempts alto.',
          isCorrect: false,
          explanation: 'Sem Catch, depois das tentativas a execução inteira falha.',
        },
        {
          text: 'Catch antes do Retry, para notificar a cada falha.',
          isCorrect: false,
          explanation: 'A ordem de avaliação é sempre Retry primeiro; e notificar a cada tentativa não é o pedido.',
        },
      ],
    },
    {
      prompt:
        'Cliques de um site precisam ser consumidos por três aplicações independentes (analytics, detecção de fraude e arquivamento), cada uma lendo todos os eventos em ordem por usuário, com possibilidade de reprocessar os últimos dias. Qual serviço atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'O Kinesis Data Streams mantém os registros pelo período de retenção (24 horas por padrão, até 365 dias), preserva a ordem por partition key dentro de cada shard, e permite que vários consumidores leiam os mesmos dados de forma independente e reprocessem a partir de um ponto. No SQS, uma mensagem excluída por um consumidor some para todos.',
      officialReferences: 'https://docs.aws.amazon.com/streams/latest/dev/key-concepts.html',
      options: [
        {
          text: 'Amazon Kinesis Data Streams, usando o ID do usuário como partition key.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Uma fila SQS Standard compartilhada pelas três aplicações.',
          isCorrect: false,
          explanation: 'Cada mensagem seria processada por um só consumidor, sem ordem e sem replay.',
        },
        {
          text: 'Uma fila SQS FIFO compartilhada pelas três aplicações.',
          isCorrect: false,
          explanation: 'Tem ordem, mas cada mensagem ainda vai para um só consumidor e não há replay.',
        },
        {
          text: 'Um tópico SNS Standard com três assinantes.',
          isCorrect: false,
          explanation: 'Entrega a todos, mas sem ordem garantida e sem reter eventos para replay.',
        },
      ],
    },
  ];

  await seedQuestions(architectureTopic.id, architectureReinforcementQuestions);

  await seedFlashcards(architectureTopic.id, [
    {
      conceptName: 'SQS FIFO',
      conceptDescription: 'Fila com ordem garantida por message group e deduplicação de mensagens numa janela de 5 minutos.',
      serviceId: sqsService.id,
      front: 'Para que servem o MessageGroupId e o MessageDeduplicationId numa fila SQS FIFO?',
      back: 'MessageGroupId: define a ordem (garantida dentro de cada grupo; grupos diferentes são processados em paralelo). MessageDeduplicationId: descarta repetições dentro de 5 minutos (ou content-based deduplication, pelo hash do corpo).',
    },
    {
      conceptName: 'Visibility timeout',
      conceptDescription: 'Tempo em que uma mensagem recebida fica invisível para outros consumidores antes de voltar à fila.',
      serviceId: sqsService.id,
      front: 'Qual deve ser o visibility timeout de uma fila SQS consumida por uma função Lambda?',
      back: 'Pelo menos 6 vezes o timeout da função. Se o processamento passa do visibility timeout, a mensagem volta a ficar visível e é processada de novo.',
    },
    {
      conceptName: 'Standard vs. Express workflows',
      conceptDescription: 'Os dois tipos de workflow do Step Functions, com duração, semântica de execução e cobrança diferentes.',
      serviceId: stepFunctionsService.id,
      front: 'Qual a diferença entre workflows Standard e Express no Step Functions?',
      back: 'Standard: até 1 ano, exactly-once, cobrado por transição de estado. Express: até 5 minutos, at-least-once (assíncrono), alto volume, cobrado por requisição e duração.',
    },
    {
      conceptName: 'EventBridge vs. SNS',
      conceptDescription: 'Barramento de eventos com roteamento por conteúdo vs. pub/sub de alto throughput.',
      serviceId: snsService.id,
      front: 'Quando escolher EventBridge em vez de SNS?',
      back: 'Quando precisa de eventos de serviços da AWS ou parceiros SaaS, regras que filtram qualquer campo do evento, schema registry, agendamento ou archive/replay. SNS: fanout simples de alto throughput e notificações (e-mail, SMS, push).',
    },
    {
      conceptName: 'Kinesis Data Streams vs. SQS',
      conceptDescription: 'Stream com retenção e múltiplos consumidores vs. fila em que cada mensagem é processada e excluída.',
      serviceId: kinesisService.id,
      front: 'Quando usar Kinesis Data Streams em vez de SQS?',
      back: 'Quando vários consumidores precisam ler os mesmos dados, em ordem por partition key, com possibilidade de replay (retenção de 24 h a 365 dias). No SQS cada mensagem é processada por um consumidor e some ao ser excluída.',
    },
  ]);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 3 of 12: Domain 1 "Armazenamento de dados
  // em aplicações". Its objective spans DynamoDB design, caching and S3
  // lifecycle, so it gets 2 lessons + 2 labs and a larger question bank
  // than the 1+1 baseline (see docs/Conteudo-DVA-C02.md).
  // ---------------------------------------------------------------------

  const storageTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: domain.id, name: 'Armazenamento de dados em aplicações' },
  });

  const dynamoServiceData = {
    shortName: 'DynamoDB',
    category: 'Database',
    description:
      'Banco NoSQL chave-valor e de documentos, totalmente gerenciado, com latência de milissegundos em qualquer escala.',
  };
  const dynamoService = await prisma.aWSService.upsert({
    where: { name: 'Amazon DynamoDB' },
    update: dynamoServiceData,
    create: { name: 'Amazon DynamoDB', ...dynamoServiceData },
  });

  const elastiCacheServiceData = {
    shortName: 'ElastiCache',
    category: 'Database',
    description: 'Cache em memória gerenciado, compatível com Redis/Valkey e Memcached.',
  };
  const elastiCacheService = await prisma.aWSService.upsert({
    where: { name: 'Amazon ElastiCache' },
    update: elastiCacheServiceData,
    create: { name: 'Amazon ElastiCache', ...elastiCacheServiceData },
  });

  const s3ServiceData = {
    shortName: 'S3',
    category: 'Storage',
    description:
      'Armazenamento de objetos com várias classes de armazenamento e regras de ciclo de vida para otimizar custo.',
  };
  const s3Service = await prisma.aWSService.upsert({
    where: { name: 'Amazon S3' },
    update: s3ServiceData,
    create: { name: 'Amazon S3', ...s3ServiceData },
  });

  const dynamoLessonContent = `## Objetivo

Ao final desta lição você vai conseguir decidir entre um banco relacional e o DynamoDB, projetar chaves e índices a partir dos padrões de acesso, calcular capacidade de leitura/escrita e usar as operações do DynamoDB do jeito que a prova DVA-C02 espera.

## Relacional ou NoSQL?

Bancos relacionais (Amazon RDS, Amazon Aurora) são a escolha quando os dados têm relacionamentos ricos, consultas ad hoc com joins e transações complexas entre muitas tabelas. O Amazon DynamoDB é a escolha quando os padrões de acesso são conhecidos de antemão (buscar por uma chave, listar itens de um cliente), a escala é alta ou imprevisível e se quer latência de milissegundos sem gerenciar servidores. No DynamoDB, você modela a tabela a partir das consultas que vai fazer — não o contrário.

## Chaves primárias e partições

Toda tabela tem uma chave primária: só a partition key (chave simples) ou partition key + sort key (chave composta). O DynamoDB usa o hash da partition key para distribuir os itens entre partições físicas, então ela precisa ter alta cardinalidade e acessos bem distribuídos (ex.: \`clienteId\`, não \`status\`). Uma partition key com poucos valores concentra tráfego numa partição ("hot partition") e causa throttling mesmo com capacidade sobrando na tabela. A sort key ordena os itens de uma mesma partition key e permite consultas por intervalo (ex.: pedidos de um cliente entre duas datas).

## Query, Scan e operações de escrita

\`GetItem\` busca um item pela chave primária completa. \`Query\` busca todos os itens de uma partition key, opcionalmente filtrando pela sort key — é eficiente porque lê só aquela partição. \`Scan\` lê a tabela inteira; um \`FilterExpression\` é aplicado depois da leitura, então consome a mesma capacidade que ler tudo. Prefira sempre \`Query\` (numa tabela ou num índice) a \`Scan\`. Cada chamada de \`Query\`/\`Scan\` retorna no máximo 1 MB de dados; se houver mais, a resposta traz \`LastEvaluatedKey\`, que você envia como \`ExclusiveStartKey\` na próxima chamada para paginar. \`ProjectionExpression\` reduz os atributos retornados, mas não o consumo de capacidade.

Para escrita: \`PutItem\` cria ou substitui um item inteiro, \`UpdateItem\` altera atributos específicos (incluindo contadores atômicos) e \`DeleteItem\` remove. Uma \`ConditionExpression\` faz a escrita só acontecer se uma condição for verdadeira — a base do optimistic locking: guarde um atributo \`versao\` e só atualize se ele ainda tiver o valor que você leu. \`BatchWriteItem\`/\`BatchGetItem\` agrupam operações (podem devolver \`UnprocessedItems\`/\`UnprocessedKeys\`, que você deve reenviar com backoff), e \`TransactWriteItems\`/\`TransactGetItems\` dão atomicidade tudo-ou-nada, consumindo o dobro de capacidade.

## Índices secundários: LSI e GSI

Um Local Secondary Index (LSI) usa a mesma partition key da tabela com outra sort key; só pode ser criado junto com a tabela e permite leituras fortemente consistentes. Um Global Secondary Index (GSI) usa uma partition key (e sort key) totalmente diferentes; pode ser criado a qualquer momento, tem capacidade própria e só suporta leituras eventualmente consistentes. Na prática, GSI é a ferramenta do dia a dia para "consultar por outro atributo" sem recorrer a \`Scan\`.

## Consistência e capacidade

Leituras são eventualmente consistentes por padrão; com \`ConsistentRead: true\` ficam fortemente consistentes (só na tabela e em LSIs) e custam o dobro. No modo provisionado: 1 RCU = 1 leitura fortemente consistente por segundo de até 4 KB (ou 2 eventualmente consistentes); 1 WCU = 1 escrita por segundo de até 1 KB. Tamanhos arredondam para cima: ler um item de 6 KB com consistência forte custa 2 RCU; escrever um item de 2,5 KB custa 3 WCU. No modo on-demand você paga por requisição, sem planejar capacidade — bom para tráfego imprevisível. Ao exceder a capacidade, o DynamoDB devolve \`ProvisionedThroughputExceededException\`, que os SDKs repetem com backoff exponencial.

## TTL e Streams

O TTL apaga automaticamente itens cujo atributo de expiração (um timestamp em epoch, em segundos) já passou, sem consumir WCU — ideal para sessões e dados temporários. A exclusão não é imediata (normalmente acontece em alguns dias), então filtre itens expirados nas consultas se isso importar. O DynamoDB Streams registra as mudanças nos itens e pode acionar uma função Lambda para reagir a elas.

## Relação com a prova DVA-C02

Espere cálculos de RCU/WCU, escolha de partition key para evitar hot partitions, Query vs. Scan, LSI vs. GSI (e qual pode ser criado depois), paginação com \`LastEvaluatedKey\`, optimistic locking com \`ConditionExpression\`, e TTL para expirar dados.`;

  const cacheLessonContent = `## Objetivo

Ao final desta lição você vai conseguir escolher uma estratégia de cache (lazy loading, write-through, read-through, TTL), decidir entre ElastiCache e DAX, e definir classes de armazenamento e regras de ciclo de vida no Amazon S3.

## Por que cache

Um cache em memória guarda o resultado de leituras caras (consultas ao banco, chamadas a APIs lentas) para servir as próximas em microssegundos ou poucos milissegundos, reduzindo latência e carga no banco. O custo é lidar com dados que podem ficar desatualizados em relação à fonte.

## Lazy loading (cache-aside)

A aplicação consulta o cache primeiro; num cache miss, lê do banco, grava no cache e devolve. Vantagens: só fica em cache o que é realmente lido, e uma falha no cache não derruba a aplicação (ela só fica mais lenta). Desvantagens: todo miss custa três viagens (cache, banco, gravação no cache), e o dado pode ficar desatualizado se o banco mudar depois.

## Write-through

A cada escrita no banco, a aplicação também atualiza o cache. Vantagem: o dado em cache nunca fica desatualizado. Desvantagens: toda escrita fica mais lenta (write penalty), dados que nunca serão lidos ocupam o cache (cache churn), e um nó de cache novo começa vazio até as escritas o preencherem — por isso write-through costuma ser combinado com lazy loading.

## Read-through e TTL

No read-through, é o próprio cache que busca o dado na fonte num miss, e não a aplicação — o Amazon DynamoDB Accelerator (DAX) funciona assim para o DynamoDB, e também faz write-through. Qualquer que seja a estratégia, um TTL em cada chave limita por quanto tempo um dado desatualizado pode ser servido e evita que o cache cresça indefinidamente.

## ElastiCache e DAX

O Amazon ElastiCache oferece Redis/Valkey e Memcached gerenciados. Redis/Valkey suporta replicação, failover Multi-AZ, persistência, backups e estruturas de dados ricas (sorted sets para rankings, pub/sub) — a escolha para armazenar sessões ou quando o cache precisa de alta disponibilidade. Memcached é mais simples: multithread, sem persistência nem replicação, bom para cache puro e descartável. O DAX é um cache específico para o DynamoDB, compatível com a API dele (troca-se o cliente do SDK, quase sem mudar código), com latência de microssegundos para leituras; leituras fortemente consistentes passam direto para a tabela, sem cache.

## Classes de armazenamento do S3

O S3 Standard é para dados acessados com frequência. S3 Standard-IA e One Zone-IA custam menos por GB, mas cobram por recuperação e têm duração mínima de 30 dias (One Zone-IA guarda os dados numa única AZ). S3 Intelligent-Tiering move objetos entre camadas automaticamente conforme o padrão de acesso — bom quando esse padrão é desconhecido. As classes Glacier são para arquivamento: Glacier Instant Retrieval (acesso em milissegundos, mínimo de 90 dias), Glacier Flexible Retrieval (minutos a horas, mínimo de 90 dias) e Glacier Deep Archive (a mais barata, recuperação padrão em até 12 horas, mínimo de 180 dias).

## Regras de ciclo de vida

Uma lifecycle rule automatiza ações sobre objetos (de um bucket inteiro ou filtrados por prefixo/tag): transition move objetos para uma classe mais barata depois de N dias, e expiration os exclui. Com versionamento habilitado, há ações separadas para versões não atuais (ex.: expirar versões antigas 30 dias depois de serem substituídas), e uma regra também pode abortar multipart uploads incompletos, que de outra forma ocupam espaço cobrado sem aparecer na listagem de objetos. Desde 2020, o S3 tem consistência forte de leitura após escrita para todas as operações.

## Relação com a prova DVA-C02

Espere cenários pedindo a estratégia de cache certa para um requisito ("dados nunca desatualizados" → write-through; "só cachear o que é lido" → lazy loading), DAX vs. ElastiCache, Redis vs. Memcached, e desenhar uma lifecycle rule a partir de um padrão de acesso e de um prazo de retenção.`;

  const storageLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 13,
      title: 'Modelagem e operações no Amazon DynamoDB',
      content: dynamoLessonContent,
      resources: [
        {
          title: 'Boas práticas de design no DynamoDB — documentação oficial',
          url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html',
        },
        {
          title: 'Índices secundários no DynamoDB — documentação oficial',
          url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SecondaryIndexes.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 11,
      title: 'Estratégias de cache e ciclo de vida de dados no S3',
      content: cacheLessonContent,
      resources: [
        {
          title: 'Estratégias de cache no ElastiCache — documentação oficial',
          url: 'https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html',
        },
        {
          title: 'Ciclo de vida de objetos no S3 — documentação oficial',
          url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html',
        },
      ],
    },
  ];

  await seedLessons(storageTopic.id, storageLessons);

  const storageLabs: LabSeed[] = [
    {
      title: 'Modelar uma tabela DynamoDB: Query, Scan e um GSI',
      data: {
        level: 1,
        order: 1,
        estimatedMinutes: 30,
        objective:
          'Ao final deste laboratório você terá criado uma tabela DynamoDB com chave composta, comparado Query e Scan na prática, e criado um Global Secondary Index para consultar por um atributo que não faz parte da chave primária.',
        prerequisites:
          'Conta AWS com acesso ao Console (Free Tier é suficiente). Ter lido a lição "Modelagem e operações no Amazon DynamoDB" ajuda.',
        context:
          'Uma loja virtual guarda pedidos no DynamoDB. O padrão de acesso principal é "listar os pedidos de um cliente, do mais recente para o mais antigo", mas o time de operações também precisa listar todos os pedidos pendentes — e alguém sugeriu resolver isso com um Scan. Você vai modelar a tabela e mostrar a alternativa correta.',
        troubleshooting:
          'A consulta não retorna nada: partition key e sort key diferenciam maiúsculas de minúsculas e tipos — confira se o valor digitado (ex.: `cliente-1`) é idêntico ao gravado e se o atributo foi criado como String. \n\nNão aparece a opção de consultar o índice: o GSI ainda está sendo criado — espere o status dele ficar "Active" na aba "Indexes". \n\nUm pedido não aparece no GSI: itens sem o atributo `status` não entram no índice (índices esparsos) — confira se o item tem `status` gravado exatamente com esse nome.',
        cleanup:
          'Exclua a tabela `devlab-pedidos` pelo Console (Actions > Delete table). Isso remove também o GSI e todos os itens.',
        costWarning:
          'Com as configurações padrão do Console a tabela usa capacidade provisionada baixa, coberta pelo Free Tier do DynamoDB (25 GB de armazenamento e 25 RCU/25 WCU provisionadas por mês). Exclua a tabela ao final para não deixar capacidade provisionada ativa.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar a tabela',
          instructions:
            'No Console da AWS, acesse o DynamoDB e clique em "Create table". Nome: `devlab-pedidos`; partition key `clienteId` (String); sort key `dataPedido` (String). Mantenha "Default settings" e crie a tabela.',
          validation: 'A tabela `devlab-pedidos` aparece com status "Active".',
        },
        {
          order: 2,
          title: 'Inserir pedidos',
          instructions:
            'Em "Explore table items", use "Create item" para criar 4 itens, adicionando também os atributos `status` (String) e `valor` (Number): (`cliente-1`, `2026-09-01`, `ENTREGUE`, 120), (`cliente-1`, `2026-09-15`, `PENDENTE`, 80), (`cliente-2`, `2026-09-10`, `PENDENTE`, 45) e (`cliente-3`, `2026-09-12`, `ENTREGUE`, 200).',
          validation: 'Um Scan sem filtros em "Explore table items" lista os 4 itens.',
        },
        {
          order: 3,
          title: 'Consultar com Query',
          instructions:
            'Ainda em "Explore table items", escolha "Query". Informe `clienteId` = `cliente-1` e, na sort key, a condição "Greater than" com o valor `2026-09-10`. Execute.',
          validation:
            'Só o pedido de `2026-09-15` do `cliente-1` é retornado — a Query leu apenas a partição do `cliente-1` e usou a sort key para filtrar o intervalo de datas.',
        },
        {
          order: 4,
          title: 'Buscar pendentes com Scan',
          instructions:
            'Escolha "Scan" e adicione um filtro: atributo `status`, tipo String, condição "Equal to", valor `PENDENTE`. Execute e observe que o Scan precisa ler a tabela inteira e só depois aplicar o filtro.',
          validation:
            'Dois itens são retornados (`cliente-1`/`2026-09-15` e `cliente-2`/`2026-09-10`), mas os 4 itens da tabela foram lidos para chegar neles — numa tabela grande, isso consome capacidade proporcional à tabela inteira.',
        },
        {
          order: 5,
          title: 'Criar um GSI e consultá-lo',
          instructions:
            'Na aba "Indexes", clique em "Create index": partition key `status` (String), sort key `dataPedido` (String), nome `status-dataPedido-index`. Quando o índice estiver "Active", volte a "Explore table items", escolha "Query", selecione o índice `status-dataPedido-index` e consulte `status` = `PENDENTE`.',
          validation:
            'Os mesmos dois pedidos pendentes são retornados, agora por uma Query no índice — lendo só os itens pendentes, sem varrer a tabela.',
        },
      ],
    },
    {
      title: 'Versionamento e regras de ciclo de vida no S3',
      data: {
        level: 1,
        order: 2,
        estimatedMinutes: 20,
        objective:
          'Ao final deste laboratório você terá habilitado o versionamento num bucket S3, visto como o S3 guarda versões antigas de um objeto, e criado uma lifecycle rule que move objetos para classes mais baratas e expira versões antigas automaticamente.',
        prerequisites:
          'Conta AWS com acesso ao Console (Free Tier é suficiente). Ter lido a lição "Estratégias de cache e ciclo de vida de dados no S3" ajuda.',
        context:
          'Uma aplicação grava relatórios diários num bucket S3. Os relatórios são consultados com frequência no primeiro mês, raramente até o terceiro, e depois só precisam ser guardados por exigência de auditoria. Relatórios às vezes são regerados, e as versões antigas só precisam ficar disponíveis por 30 dias. Você vai configurar o bucket para que isso aconteça sozinho.',
        troubleshooting:
          'O nome do bucket é recusado: nomes de bucket são globais em toda a AWS — acrescente um sufixo único (ex.: suas iniciais e a data). \n\nNão aparecem versões antigas: o versionamento precisa estar habilitado antes do segundo upload; use o botão "Show versions" na listagem de objetos. \n\nA lifecycle rule não aparece aplicada aos objetos: as ações rodam de forma assíncrona (uma vez por dia) e contam os dias a partir da criação do objeto — o resultado imediato a verificar é a própria regra e o resumo de ações que o Console mostra.',
        cleanup:
          'Selecione o bucket, use "Empty" (que remove todas as versões dos objetos) e depois "Delete".',
        costWarning:
          'O Free Tier do S3 inclui 5 GB no S3 Standard. Este laboratório grava dois arquivos de texto pequenos, então não deve gerar cobrança.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar o bucket com versionamento',
          instructions:
            'No Console do S3, clique em "Create bucket" e dê um nome único, como `devlab-relatorios-<suas-iniciais>-<data>`. Mantenha o bloqueio de acesso público ligado e, em "Bucket Versioning", escolha "Enable". Crie o bucket.',
          validation: 'O bucket aparece na lista e a aba "Properties" mostra "Bucket Versioning: Enabled".',
        },
        {
          order: 2,
          title: 'Gerar duas versões de um objeto',
          instructions:
            'Crie localmente um arquivo `relatorio.txt` com o texto "versão 1" e faça upload no bucket, dentro de um prefixo `relatorios/`. Depois altere o conteúdo do arquivo para "versão 2" e faça upload de novo com o mesmo nome e prefixo.',
          validation:
            'Com "Show versions" ativado, `relatorios/relatorio.txt` aparece com duas versões, cada uma com seu próprio Version ID — a mais recente é a versão atual.',
        },
        {
          order: 3,
          title: 'Criar a lifecycle rule',
          instructions:
            'Na aba "Management", clique em "Create lifecycle rule". Nome: `relatorios-ciclo-de-vida`; escopo limitado ao prefixo `relatorios/`. Marque as ações: mover versões atuais para Standard-IA após 30 dias e para Glacier Deep Archive após 90 dias; excluir versões não atuais 30 dias depois de deixarem de ser atuais; e excluir multipart uploads incompletos após 7 dias.',
          validation:
            'Antes de salvar, o Console mostra uma linha do tempo com as transições (dia 30 → Standard-IA, dia 90 → Glacier Deep Archive) e as expirações configuradas.',
        },
        {
          order: 4,
          title: 'Revisar a regra criada',
          instructions:
            'Salve a regra e volte à aba "Management". Relacione cada ação com o requisito do contexto: acesso frequente no primeiro mês, raro até o terceiro, arquivamento depois, e versões antigas guardadas por 30 dias.',
          validation:
            'A regra `relatorios-ciclo-de-vida` aparece como "Enabled", com escopo `relatorios/` e as quatro ações configuradas.',
        },
      ],
    },
  ];

  await seedLabs(storageTopic.id, storageLabs);

  const storageQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Qual é a principal diferença entre as operações Query e Scan no DynamoDB?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Query lê apenas os itens de uma partition key (opcionalmente filtrando pela sort key). Scan lê a tabela ou o índice inteiro, e qualquer FilterExpression é aplicado depois da leitura — por isso consome capacidade proporcional ao tamanho da tabela.',
      options: [
        {
          text: 'Query lê só os itens de uma partition key; Scan lê a tabela inteira e filtra depois da leitura.',
          isCorrect: true,
          explanation: 'Correto: por isso Query é a operação preferida sempre que o padrão de acesso permite.',
        },
        {
          text: 'Scan é mais eficiente que Query quando se usa um FilterExpression.',
          isCorrect: false,
          explanation: 'O filtro do Scan é aplicado depois da leitura; a capacidade consumida é a mesma de ler tudo.',
        },
        {
          text: 'Query só funciona em índices secundários; Scan só na tabela base.',
          isCorrect: false,
          explanation: 'As duas operações funcionam tanto na tabela quanto em índices.',
        },
        {
          text: 'Não há diferença de custo: as duas cobram só pelos itens retornados.',
          isCorrect: false,
          explanation: 'O custo é pelos dados lidos, não pelos retornados — e Scan lê tudo.',
        },
      ],
    },
    {
      prompt: 'Uma tabela DynamoDB já está em produção. Que tipo de índice pode ser adicionado a ela agora?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'GSIs podem ser criados (e removidos) a qualquer momento. LSIs só podem ser definidos na criação da tabela.',
      officialReferences:
        'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SecondaryIndexes.html',
      options: [
        {
          text: 'Um Global Secondary Index (GSI).',
          isCorrect: true,
          explanation: 'Correto: GSIs podem ser adicionados a uma tabela existente.',
        },
        {
          text: 'Um Local Secondary Index (LSI).',
          isCorrect: false,
          explanation: 'LSIs precisam ser definidos quando a tabela é criada.',
        },
        {
          text: 'Nenhum: índices só podem ser criados junto com a tabela.',
          isCorrect: false,
          explanation: 'Isso vale só para LSIs.',
        },
        {
          text: 'Qualquer um dos dois, desde que a tabela esteja em modo on-demand.',
          isCorrect: false,
          explanation: 'O modo de capacidade não muda a regra: LSI continua só na criação.',
        },
      ],
    },
    {
      prompt: 'Qual tipo de nó do Amazon ElastiCache atende a um cache que precisa de replicação, failover Multi-AZ e sorted sets para um ranking de jogadores?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Redis (ou Valkey, compatível com ele) suporta replicação, failover automático, persistência e estruturas de dados como sorted sets. Memcached é mais simples: multithread, sem replicação nem persistência.',
      options: [
        {
          text: 'ElastiCache para Redis/Valkey.',
          isCorrect: true,
          explanation: 'Correto: replicação, Multi-AZ e sorted sets são recursos do Redis/Valkey.',
        },
        {
          text: 'ElastiCache para Memcached.',
          isCorrect: false,
          explanation: 'Memcached não oferece replicação, persistência nem sorted sets.',
        },
        {
          text: 'DynamoDB Accelerator (DAX).',
          isCorrect: false,
          explanation: 'DAX é um cache específico para leituras do DynamoDB, não um armazenamento de estruturas como sorted sets.',
        },
        {
          text: 'Qualquer um: os dois motores têm os mesmos recursos.',
          isCorrect: false,
          explanation: 'Os motores têm capacidades bem diferentes — é exatamente o que a prova cobra.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação faz 10 leituras fortemente consistentes por segundo de itens de 6 KB numa tabela DynamoDB provisionada. Quantas RCUs são necessárias?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        '1 RCU = 1 leitura fortemente consistente por segundo de até 4 KB. 6 KB arredonda para 8 KB = 2 RCU por leitura; 10 leituras/s × 2 = 20 RCU. Com leituras eventualmente consistentes seriam 10 RCU.',
      options: [
        { text: '20 RCU', isCorrect: true, explanation: 'Correto: 6 KB → 8 KB (2 blocos de 4 KB) × 10 leituras/s.' },
        { text: '10 RCU', isCorrect: false, explanation: 'Seria o valor com leituras eventualmente consistentes, que custam metade.' },
        { text: '15 RCU', isCorrect: false, explanation: 'O tamanho arredonda para o próximo múltiplo de 4 KB (8 KB), não para 6 KB.' },
        { text: '60 RCU', isCorrect: false, explanation: 'O cálculo usa blocos de 4 KB para leitura, não de 1 KB.' },
      ],
    },
    {
      prompt: 'Uma aplicação grava 5 itens de 2,5 KB por segundo numa tabela DynamoDB provisionada. Quantas WCUs são necessárias?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        '1 WCU = 1 escrita por segundo de até 1 KB. 2,5 KB arredonda para 3 KB = 3 WCU por escrita; 5 escritas/s × 3 = 15 WCU.',
      options: [
        { text: '15 WCU', isCorrect: true, explanation: 'Correto: 2,5 KB → 3 KB × 5 escritas/s.' },
        { text: '12,5 WCU', isCorrect: false, explanation: 'Não existe WCU fracionada: o tamanho arredonda para cima, para 3 KB.' },
        { text: '5 WCU', isCorrect: false, explanation: 'Seria verdade só para itens de até 1 KB.' },
        { text: '10 WCU', isCorrect: false, explanation: 'Arredondou 2,5 KB para 2 KB; o arredondamento é sempre para cima.' },
      ],
    },
    {
      prompt:
        'Uma aplicação faz muitas leituras de uma tabela DynamoDB e precisa reduzir a latência de milissegundos para microssegundos, com o mínimo de mudança no código. Qual solução é a mais adequada?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'O DAX é um cache em memória específico para o DynamoDB, compatível com a API dele: basta trocar o cliente do SDK pelo cliente do DAX. ElastiCache também reduziria latência, mas exige implementar a lógica de cache na aplicação.',
      options: [
        {
          text: 'Colocar um cluster DynamoDB Accelerator (DAX) na frente da tabela.',
          isCorrect: true,
          explanation: 'Correto: latência de microssegundos com mudança mínima de código.',
        },
        {
          text: 'Implementar lazy loading com ElastiCache para Redis.',
          isCorrect: false,
          explanation: 'Funciona, mas exige escrever a lógica de cache — não é a menor mudança de código.',
        },
        {
          text: 'Trocar a tabela para o modo on-demand.',
          isCorrect: false,
          explanation: 'Muda o modelo de cobrança e capacidade, não a latência de leitura.',
        },
        {
          text: 'Usar leituras fortemente consistentes.',
          isCorrect: false,
          explanation: 'Leituras fortemente consistentes custam mais e não ficam mais rápidas.',
        },
      ],
    },
    {
      prompt:
        'Uma tabela DynamoDB de pedidos usa o atributo status (com 3 valores possíveis) como partition key. Mesmo com capacidade provisionada sobrando no total, a aplicação recebe erros de throttling. Qual é a causa mais provável e a correção?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Uma partition key de baixa cardinalidade concentra o tráfego em poucas partições (hot partitions), que atingem seu limite individual mesmo com capacidade sobrando na tabela. A correção é usar uma chave de alta cardinalidade e bem distribuída, como o ID do pedido ou do cliente — e, para consultar por status, um GSI.',
      options: [
        {
          text: 'Hot partition por baixa cardinalidade da chave; usar uma partition key de alta cardinalidade (ex.: pedidoId) e um GSI para consultar por status.',
          isCorrect: true,
          explanation: 'Correto: distribuir a chave resolve o gargalo, e o GSI preserva a consulta por status.',
        },
        {
          text: 'A tabela precisa de mais RCU/WCU no total.',
          isCorrect: false,
          explanation: 'O enunciado diz que há capacidade sobrando; o problema é a distribuição, não o total.',
        },
        {
          text: 'Trocar Query por Scan para distribuir as leituras.',
          isCorrect: false,
          explanation: 'Scan consome ainda mais capacidade e não resolve escritas concentradas.',
        },
        {
          text: 'Habilitar TTL na tabela.',
          isCorrect: false,
          explanation: 'TTL expira itens; não muda a distribuição do tráfego entre partições.',
        },
      ],
    },
    {
      prompt:
        'Duas instâncias de uma aplicação leem o mesmo item do DynamoDB, alteram e gravam de volta ao mesmo tempo, e uma alteração sobrescreve a outra. Como evitar isso sem bloquear o item?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Optimistic locking: o item guarda um atributo de versão, e cada atualização usa uma ConditionExpression exigindo que a versão ainda seja a que foi lida (e a incrementa). Se outra instância gravou antes, a condição falha com ConditionalCheckFailedException e a aplicação relê e tenta de novo.',
      officialReferences:
        'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html',
      options: [
        {
          text: 'Usar um atributo de versão e uma ConditionExpression na atualização (optimistic locking).',
          isCorrect: true,
          explanation: 'Correto: a escrita só acontece se ninguém alterou o item desde a leitura.',
        },
        {
          text: 'Usar leituras fortemente consistentes.',
          isCorrect: false,
          explanation: 'Garante ler o valor mais recente, mas não impede que outra escrita aconteça entre a leitura e a gravação.',
        },
        {
          text: 'Usar BatchWriteItem em vez de PutItem.',
          isCorrect: false,
          explanation: 'BatchWriteItem não suporta condições e não resolve a concorrência.',
        },
        {
          text: 'Aumentar a WCU da tabela.',
          isCorrect: false,
          explanation: 'Capacidade não tem relação com escritas concorrentes no mesmo item.',
        },
      ],
    },
    {
      prompt:
        'Um catálogo de produtos é lido com muita frequência e atualizado raramente. A aplicação tolera dados alguns minutos desatualizados, e o cache deve conter só os produtos que realmente são consultados. Qual estratégia de cache atende melhor?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Lazy loading só coloca em cache o que é lido (num miss), e um TTL de alguns minutos limita por quanto tempo um dado desatualizado pode ser servido.',
      officialReferences: 'https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html',
      options: [
        {
          text: 'Lazy loading com TTL.',
          isCorrect: true,
          explanation: 'Correto: cacheia só o que é lido e o TTL controla o quanto os dados podem ficar desatualizados.',
        },
        {
          text: 'Write-through sem TTL.',
          isCorrect: false,
          explanation: 'Cachearia todos os produtos escritos, inclusive os nunca consultados (cache churn).',
        },
        {
          text: 'Nenhum cache: ler sempre do banco.',
          isCorrect: false,
          explanation: 'Ignora o requisito de leituras muito frequentes, que é justamente o caso de uso de cache.',
        },
        {
          text: 'Cachear o catálogo inteiro na inicialização da aplicação, sem expiração.',
          isCorrect: false,
          explanation: 'Cacheia produtos não consultados e nunca atualiza o cache.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação exige que o dado em cache nunca fique desatualizado em relação ao banco depois de uma escrita. Qual estratégia atende isso, e qual é sua principal desvantagem?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'Write-through atualiza o cache a cada escrita no banco, então o cache nunca fica desatualizado. O custo é uma escrita mais lenta (write penalty) e dados que nunca serão lidos ocupando o cache (cache churn) — por isso costuma ser combinado com TTL.',
      options: [
        {
          text: 'Write-through; toda escrita fica mais lenta e dados nunca lidos ocupam o cache.',
          isCorrect: true,
          explanation: 'Correto: frescor garantido em troca de write penalty e cache churn.',
        },
        {
          text: 'Lazy loading; todo cache miss custa três viagens.',
          isCorrect: false,
          explanation: 'A desvantagem descrita é real, mas lazy loading pode servir dados desatualizados — não atende o requisito.',
        },
        {
          text: 'Lazy loading com TTL longo; o cache ocupa pouca memória.',
          isCorrect: false,
          explanation: 'Um TTL longo aumenta a janela de dados desatualizados.',
        },
        {
          text: 'Write-through; o cache não pode ser usado junto com lazy loading.',
          isCorrect: false,
          explanation: 'As duas estratégias são frequentemente combinadas.',
        },
      ],
    },
    {
      prompt:
        'Logs de aplicação num bucket S3 são acessados com frequência nos primeiros 30 dias, raramente até 90 dias, e depois precisam ser guardados por 7 anos para auditoria, com recuperação em até 12 horas quando solicitados. Qual lifecycle rule tem o menor custo atendendo aos requisitos?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'S3 Standard nos primeiros 30 dias, Standard-IA até 90 dias (acesso raro, mas imediato), e Glacier Deep Archive depois — a classe mais barata, com recuperação padrão em até 12 horas. Uma expiração em 7 anos remove os logs ao fim da retenção.',
      officialReferences: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html',
      options: [
        {
          text: 'Standard → Standard-IA aos 30 dias → Glacier Deep Archive aos 90 dias → expirar após 7 anos.',
          isCorrect: true,
          explanation: 'Correto: cada fase usa a classe mais barata que atende ao padrão de acesso e ao prazo de recuperação.',
        },
        {
          text: 'Manter tudo em S3 Standard e expirar após 7 anos.',
          isCorrect: false,
          explanation: 'Atende, mas é a opção mais cara para dados raramente acessados.',
        },
        {
          text: 'Mover para Glacier Deep Archive no dia 1.',
          isCorrect: false,
          explanation: 'Os logs precisam de acesso frequente e imediato nos primeiros 30 dias.',
        },
        {
          text: 'Standard → S3 One Zone-IA aos 30 dias e manter lá por 7 anos.',
          isCorrect: false,
          explanation: 'Mais caro que Deep Archive para 7 anos de arquivamento, e guarda dados de auditoria numa única AZ.',
        },
      ],
    },
    {
      prompt:
        'Uma Query no DynamoDB deveria retornar todos os pedidos de um cliente, mas retorna só parte deles, e a resposta inclui o campo LastEvaluatedKey. O que está acontecendo e como corrigir?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Query e Scan retornam no máximo 1 MB de dados por chamada. Quando há mais resultados, a resposta traz LastEvaluatedKey, que deve ser enviado como ExclusiveStartKey na próxima chamada, repetindo até a resposta não trazer mais LastEvaluatedKey (os SDKs oferecem paginadores para isso).',
      officialReferences:
        'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html',
      options: [
        {
          text: 'A resposta atingiu o limite de 1 MB; paginar enviando LastEvaluatedKey como ExclusiveStartKey até ele não vir mais.',
          isCorrect: true,
          explanation: 'Correto: é o mecanismo padrão de paginação do DynamoDB.',
        },
        {
          text: 'A tabela está sofrendo throttling; aumentar a RCU.',
          isCorrect: false,
          explanation: 'Throttling gera erro (ProvisionedThroughputExceededException), não uma resposta parcial com LastEvaluatedKey.',
        },
        {
          text: 'A Query precisa de ConsistentRead: true para retornar tudo.',
          isCorrect: false,
          explanation: 'A consistência não altera o limite de 1 MB por resposta.',
        },
        {
          text: 'Trocar a Query por um Scan, que não tem limite de tamanho.',
          isCorrect: false,
          explanation: 'Scan tem o mesmo limite de 1 MB por chamada — e é menos eficiente.',
        },
      ],
    },
    {
      prompt:
        'Uma tabela DynamoDB existente tem partition key clienteId. Um novo requisito pede consultar os pedidos de um cliente por valor total, com leitura fortemente consistente. Qual é a solução correta?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Consultar a mesma partition key com outra sort key e consistência forte é o caso de um LSI — mas LSIs só podem ser criados junto com a tabela. Como GSIs não suportam leitura fortemente consistente, é preciso criar uma nova tabela com o LSI e migrar os dados.',
      officialReferences:
        'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SecondaryIndexes.html',
      options: [
        {
          text: 'Criar uma nova tabela com um LSI (clienteId + valorTotal) e migrar os dados.',
          isCorrect: true,
          explanation: 'Correto: só o LSI atende a consistência forte, e ele não pode ser adicionado à tabela existente.',
        },
        {
          text: 'Adicionar um LSI à tabela existente.',
          isCorrect: false,
          explanation: 'LSIs só podem ser definidos na criação da tabela.',
        },
        {
          text: 'Criar um GSI (clienteId + valorTotal) e usar ConsistentRead: true.',
          isCorrect: false,
          explanation: 'GSIs só suportam leituras eventualmente consistentes.',
        },
        {
          text: 'Fazer um Scan com ConsistentRead: true e filtrar por cliente.',
          isCorrect: false,
          explanation: 'Funciona tecnicamente, mas lê a tabela inteira a cada consulta — não é uma solução adequada.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação guarda sessões de usuário no DynamoDB e quer que sessões expiradas sejam removidas automaticamente, sem custo de escrita. Qual solução atende, e qual cuidado é necessário?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'O TTL do DynamoDB exclui itens cujo atributo de expiração (timestamp epoch em segundos) já passou, sem consumir WCU. A exclusão não é imediata — normalmente ocorre em alguns dias —, então a aplicação deve ignorar sessões expiradas ao ler (ex.: filtrando pelo atributo de expiração).',
      officialReferences: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html',
      options: [
        {
          text: 'Habilitar TTL com um atributo de expiração em epoch (segundos) e filtrar itens expirados nas leituras, pois a exclusão não é imediata.',
          isCorrect: true,
          explanation: 'Correto: TTL não consome WCU, mas itens expirados podem continuar visíveis por um tempo.',
        },
        {
          text: 'Habilitar TTL; os itens são excluídos exatamente no segundo em que expiram.',
          isCorrect: false,
          explanation: 'A exclusão pelo TTL é assíncrona e pode levar dias.',
        },
        {
          text: 'Agendar uma função Lambda que faz Scan e DeleteItem a cada hora.',
          isCorrect: false,
          explanation: 'Funciona, mas consome RCU/WCU — o contrário do requisito de não ter custo de escrita.',
        },
        {
          text: 'Usar um atributo de expiração no formato de data ISO 8601 (ex.: 2026-09-30T12:00:00Z).',
          isCorrect: false,
          explanation: 'O TTL exige um número com o timestamp epoch em segundos; outros formatos são ignorados.',
        },
      ],
    },
  ];

  await seedQuestions(storageTopic.id, storageQuestionsToSeed);

  const storageFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Query vs. Scan',
      conceptDescription: 'As duas formas de ler múltiplos itens no DynamoDB, com custos muito diferentes.',
      serviceId: dynamoService.id,
      front: 'Por que preferir Query a Scan no DynamoDB?',
      back: 'Query lê só a partição de uma partition key. Scan lê a tabela inteira e aplica o filtro depois, consumindo capacidade proporcional à tabela toda.',
    },
    {
      conceptName: 'LSI vs. GSI',
      conceptDescription: 'Os dois tipos de índice secundário do DynamoDB.',
      serviceId: dynamoService.id,
      front: 'Quais as diferenças entre um LSI e um GSI no DynamoDB?',
      back: 'LSI: mesma partition key, outra sort key, só na criação da tabela, permite leitura fortemente consistente. GSI: chaves diferentes, criado a qualquer momento, capacidade própria, só eventualmente consistente.',
    },
    {
      conceptName: 'Cálculo de RCU e WCU',
      conceptDescription: 'Unidades de capacidade provisionada de leitura e escrita do DynamoDB.',
      serviceId: dynamoService.id,
      front: 'Quanto vale 1 RCU e 1 WCU no DynamoDB?',
      back: '1 RCU = 1 leitura fortemente consistente/s de até 4 KB (ou 2 eventualmente consistentes). 1 WCU = 1 escrita/s de até 1 KB. Tamanhos arredondam para cima.',
    },
    {
      conceptName: 'Hot partition',
      conceptDescription: 'Partição física que concentra tráfego por causa de uma partition key de baixa cardinalidade.',
      serviceId: dynamoService.id,
      front: 'O que causa uma hot partition no DynamoDB e como evitar?',
      back: 'Uma partition key com poucos valores ou acessos concentrados. Evite com uma chave de alta cardinalidade e acessos bem distribuídos (ex.: clienteId em vez de status).',
    },
    {
      conceptName: 'Optimistic locking',
      conceptDescription: 'Controle de concorrência com atributo de versão e escrita condicional.',
      serviceId: dynamoService.id,
      front: 'Como evitar que escritas concorrentes no DynamoDB se sobrescrevam sem bloquear o item?',
      back: 'Optimistic locking: guardar um atributo de versão e atualizar com uma ConditionExpression exigindo a versão lida. Se falhar (ConditionalCheckFailedException), reler e tentar de novo.',
    },
    {
      conceptName: 'DynamoDB TTL',
      conceptDescription: 'Expiração automática de itens do DynamoDB sem consumo de WCU.',
      serviceId: dynamoService.id,
      front: 'Como o TTL do DynamoDB funciona e qual o cuidado ao usá-lo?',
      back: 'Exclui itens cujo atributo de expiração (epoch em segundos) já passou, sem consumir WCU. A exclusão não é imediata (pode levar dias), então filtre itens expirados nas leituras.',
    },
    {
      conceptName: 'Lazy loading vs. write-through',
      conceptDescription: 'As duas estratégias principais de preenchimento de cache.',
      serviceId: elastiCacheService.id,
      front: 'Qual a diferença entre lazy loading e write-through?',
      back: 'Lazy loading: grava no cache só num miss (cacheia só o que é lido, mas pode ficar desatualizado). Write-through: atualiza o cache a cada escrita (nunca desatualizado, mas write penalty e cache churn).',
    },
    {
      conceptName: 'DAX',
      conceptDescription: 'DynamoDB Accelerator: cache em memória read-through/write-through específico para o DynamoDB.',
      serviceId: dynamoService.id,
      front: 'Quando usar o DAX em vez do ElastiCache?',
      back: 'Quando o cache é para leituras do DynamoDB: DAX é compatível com a API dele (mudança mínima de código) e dá latência de microssegundos. Leituras fortemente consistentes não são cacheadas.',
    },
    {
      conceptName: 'Lifecycle rules do S3',
      conceptDescription: 'Regras que movem objetos entre classes de armazenamento e os expiram automaticamente.',
      serviceId: s3Service.id,
      front: 'Quais ações uma lifecycle rule do S3 pode executar?',
      back: 'Transition (mover para uma classe mais barata após N dias), expiration (excluir), ações para versões não atuais e abortar multipart uploads incompletos.',
    },
  ];

  await seedFlashcards(storageTopic.id, storageFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 4 of 12: Domain 2 "Criptografia com
  // serviços AWS", to the exam-readiness bar (2 lessons + 2 labs).
  // ---------------------------------------------------------------------

  const encryptionTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: securityDomain.id, name: 'Criptografia com serviços AWS' },
  });

  const kmsServiceData = {
    shortName: 'KMS',
    category: 'Security, Identity, & Compliance',
    description:
      'Cria e gerencia chaves criptográficas e controla seu uso nos serviços da AWS e nas aplicações, com auditoria no CloudTrail.',
  };
  const kmsService = await prisma.aWSService.upsert({
    where: { name: 'AWS Key Management Service' },
    update: kmsServiceData,
    create: { name: 'AWS Key Management Service', ...kmsServiceData },
  });

  const acmServiceData = {
    shortName: 'ACM',
    category: 'Security, Identity, & Compliance',
    description:
      'Emite, gerencia e renova certificados SSL/TLS públicos e privados para uso em serviços da AWS.',
  };
  const acmService = await prisma.aWSService.upsert({
    where: { name: 'AWS Certificate Manager' },
    update: acmServiceData,
    create: { name: 'AWS Certificate Manager', ...acmServiceData },
  });

  const kmsLessonContent = `## Objetivo

Ao final desta lição você vai conseguir explicar os tipos de chave do AWS KMS, aplicar criptografia envelope, controlar o acesso a chaves com key policies e grants, e reconhecer os limites do KMS que a prova DVA-C02 costuma cobrar.

## O que o KMS faz

O AWS Key Management Service guarda chaves criptográficas em HSMs gerenciados pela AWS — a chave (no caso das chaves simétricas) nunca sai do KMS em texto claro. Você não recebe a chave: você pede ao KMS para criptografar, descriptografar ou gerar chaves de dados com ela, e cada uma dessas chamadas passa por controle de acesso e fica registrada no AWS CloudTrail.

## Tipos de chave

- **AWS owned keys**: usadas internamente por serviços, invisíveis na sua conta, sem custo (ex.: o padrão de criptografia do DynamoDB).
- **AWS managed keys**: criadas por um serviço na sua conta (alias \`aws/s3\`, \`aws/lambda\` etc.), sem custo mensal; você vê e audita o uso, mas não altera a key policy, e a rotação é automática (anual).
- **Customer managed keys**: você cria e controla tudo — key policy, grants, rotação, habilitar/desabilitar, agendar exclusão. Custam US$ 1/mês cada. São a resposta quando a questão pede controle sobre quem usa a chave, rotação sob demanda ou acesso entre contas.

Chaves simétricas (AES-256) são o padrão e servem para a maioria dos casos. Chaves assimétricas (RSA, ECC) servem para assinatura/verificação ou para quando quem criptografa está fora da AWS e só tem a chave pública.

## Rotação

Customer managed keys podem ter rotação automática habilitada (período configurável, padrão de 365 dias) e também rotação sob demanda. Na rotação, o KMS gera novo material criptográfico mas mantém o antigo: o ID e o ARN da chave não mudam, dados antigos continuam descriptografáveis e dados novos usam o material novo — nenhuma recriptografia é necessária. Chaves com material importado (BYOK) não têm rotação automática; para "rotacionar", cria-se uma chave nova e troca-se o alias.

## Criptografia envelope

A API \`Encrypt\` aceita no máximo 4 KB de dados — ela foi feita para criptografar pequenos segredos, não arquivos. Para dados maiores, usa-se criptografia envelope: a aplicação chama \`GenerateDataKey\`, que devolve uma chave de dados em duas formas — em texto claro e criptografada pela chave do KMS. A aplicação criptografa os dados localmente com a versão em texto claro, descarta essa versão da memória e guarda a versão criptografada junto com os dados. Para ler, chama \`Decrypt\` na chave de dados criptografada e usa o resultado para descriptografar localmente. \`GenerateDataKeyWithoutPlaintext\` devolve só a versão criptografada, para quando a chave só vai ser usada depois. O AWS Encryption SDK implementa esse padrão pronto, incluindo cache de chaves de dados.

## Controle de acesso: key policies e grants

Toda chave do KMS tem exatamente uma key policy, e ela é a fonte primária de permissão: uma policy do IAM só tem efeito se a key policy permitir que a conta use IAM para aquela chave (a key policy padrão faz isso, dando acesso à conta). Para acesso entre contas, são necessárias as duas pontas: a key policy da conta dona da chave permitindo a outra conta, e uma policy do IAM na outra conta permitindo o uso. Grants dão permissões temporárias e específicas a um principal sem editar a key policy — muitos serviços da AWS os usam por baixo dos panos.

## Cotas e throttling

As operações criptográficas do KMS têm uma cota de requisições por segundo compartilhada por conta e região. Uma aplicação que chama o KMS para cada objeto pode receber \`ThrottlingException\`. As saídas: repetir com backoff exponencial, reutilizar chaves de dados com o cache do Encryption SDK, habilitar S3 Bucket Keys (que reduzem drasticamente as chamadas ao KMS feitas pelo SSE-KMS) ou pedir aumento de cota.

## Relação com a prova DVA-C02

Espere cenários sobre o limite de 4 KB do \`Encrypt\` e criptografia envelope com \`GenerateDataKey\`, escolha entre AWS managed e customer managed keys, rotação sem recriptografia, key policy vs. IAM em acesso entre contas, e \`ThrottlingException\` do KMS.`;

  const encryptionServicesLessonContent = `## Objetivo

Ao final desta lição você vai conseguir escolher o tipo de criptografia em repouso certo para o S3 e outros serviços, exigir criptografia em trânsito, e usar o AWS Certificate Manager para certificados TLS.

## Criptografia em repouso no S3

- **SSE-S3**: chaves gerenciadas pelo próprio S3 (AES-256). É o padrão para todo objeto novo desde 2023 — nada precisa ser configurado.
- **SSE-KMS**: o S3 usa uma chave do KMS (AWS managed \`aws/s3\` ou customer managed). Ganha-se controle de acesso pela key policy (quem não tem permissão na chave não lê o objeto, mesmo com permissão no bucket) e auditoria de cada uso no CloudTrail. O cabeçalho de upload é \`x-amz-server-side-encryption: aws:kms\`, e requisições de GET/PUT de objetos SSE-KMS só funcionam com TLS. S3 Bucket Keys reduzem o custo e o volume de chamadas ao KMS.
- **DSSE-KMS**: duas camadas de criptografia com KMS, para exigências de compliance.
- **SSE-C**: o cliente envia a própria chave em cada requisição; o S3 criptografa e descarta a chave. Exige HTTPS, e se a chave for perdida o objeto é irrecuperável.
- **Criptografia no lado do cliente**: a aplicação criptografa antes de enviar (ex.: com o Encryption SDK); a AWS nunca vê os dados em claro.

A criptografia padrão do bucket define o que vale quando o upload não especifica nada. Para obrigar um tipo específico (ex.: só SSE-KMS), usa-se uma bucket policy que nega \`s3:PutObject\` quando o cabeçalho de criptografia não é o exigido.

## Outros serviços

O DynamoDB criptografa todas as tabelas em repouso, sempre — a escolha é só qual chave usar (AWS owned, AWS managed ou customer managed). No EBS e no RDS, a criptografia é definida na criação: não dá para criptografar uma instância RDS existente diretamente; o caminho é tirar um snapshot, copiar o snapshot habilitando criptografia e restaurar uma nova instância a partir dele. Réplicas de leitura e snapshots de um banco criptografado também são criptografados.

## Criptografia em trânsito

Os endpoints da AWS aceitam HTTPS (TLS), e os SDKs o usam por padrão. Para exigir TLS num bucket S3, uma bucket policy nega qualquer requisição com a condição \`aws:SecureTransport\` igual a \`false\`. Bancos como o RDS aceitam conexões TLS e podem ser configurados para exigi-las.

## Certificados com o ACM

O AWS Certificate Manager emite certificados TLS públicos gratuitos para uso em serviços integrados — Elastic Load Balancing, Amazon CloudFront, Amazon API Gateway — e os renova automaticamente quando o domínio é validado por DNS (a validação por e-mail exige ação manual a cada renovação). Um detalhe muito cobrado: certificados usados pelo CloudFront precisam estar na região us-east-1 (N. Virginia). Para certificados internos (serviços privados, TLS mútuo entre microsserviços), o AWS Private CA cria uma autoridade certificadora privada gerenciada, cobrada à parte.

## Relação com a prova DVA-C02

Espere cenários pedindo SSE-KMS quando o requisito é auditoria ou controle de acesso à chave, SSE-C quando o cliente precisa manter a chave, bucket policies com \`aws:SecureTransport\` ou com o cabeçalho de criptografia, criptografar um RDS existente via snapshot, e certificados do ACM (inclusive a região us-east-1 para o CloudFront).`;

  const encryptionLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 12,
      title: 'AWS KMS e criptografia envelope',
      content: kmsLessonContent,
      resources: [
        {
          title: 'Conceitos do AWS KMS — documentação oficial',
          url: 'https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html',
        },
        {
          title: 'Rotação de chaves do KMS — documentação oficial',
          url: 'https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 10,
      title: 'Criptografia em repouso, em trânsito e certificados',
      content: encryptionServicesLessonContent,
      resources: [
        {
          title: 'Proteção de dados com criptografia no S3 — documentação oficial',
          url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html',
        },
        {
          title: 'AWS Certificate Manager — documentação oficial',
          url: 'https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html',
        },
      ],
    },
  ];

  await seedLessons(encryptionTopic.id, encryptionLessons);

  const encryptionLabs: LabSeed[] = [
    {
      title: 'Criptografar e descriptografar com o KMS pelo CloudShell',
      data: {
        level: 1,
        order: 1,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá criado uma customer managed key no KMS, criptografado e descriptografado um segredo pela AWS CLI, gerado uma chave de dados para criptografia envelope e habilitado a rotação automática da chave.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell (que já vem com a AWS CLI configurada). Ter lido a lição "AWS KMS e criptografia envelope" ajuda.',
        context:
          'Uma aplicação precisa proteger pequenos segredos e, no futuro, arquivos maiores. Antes de escrever código, o time quer ver na prática como o KMS criptografa dados, por que descriptografar não exige informar a chave, e o que a API GenerateDataKey devolve.',
        troubleshooting:
          'AccessDeniedException ao criptografar: o usuário ou role do CloudShell precisa estar entre os "key users" da chave — confira a key policy na aba "Key policy". \n\nErro "Invalid base64" ou arquivo vazio: o parâmetro `--plaintext fileb://` lê bytes do arquivo; confira se usou `fileb://` (e não `file://`) e se o arquivo existe no diretório atual do CloudShell. \n\nNotFoundException com o alias: aliases começam com `alias/` — use `alias/devlab-key`, e confira se o CloudShell está na mesma região em que a chave foi criada.',
        cleanup:
          'No KMS, selecione a chave `devlab-key` e use "Key actions" > "Schedule key deletion" com o período mínimo de 7 dias. A chave fica desabilitada até ser excluída de vez.',
        costWarning:
          'Uma customer managed key custa US$ 1 por mês, cobrado proporcionalmente por hora; as requisições deste laboratório ficam dentro das 20.000 gratuitas por mês. Agende a exclusão ao final para o custo ficar em centavos.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar a customer managed key',
          instructions:
            'No Console, acesse o KMS e clique em "Create key". Escolha "Symmetric" e "Encrypt and decrypt", alias `devlab-key`. Em "Key administrators" e "Key users", selecione o usuário ou role com que você está logado no Console. Conclua a criação.',
          validation: 'A chave aparece em "Customer managed keys" com o alias `devlab-key` e status "Enabled".',
        },
        {
          order: 2,
          title: 'Criptografar um segredo',
          instructions:
            'Abra o AWS CloudShell (ícone de terminal no topo do Console, na mesma região da chave) e rode: `echo -n "segredo do devlab" > segredo.txt` e depois `aws kms encrypt --key-id alias/devlab-key --plaintext fileb://segredo.txt --output text --query CiphertextBlob | base64 --decode > segredo.enc`.',
          validation:
            'O arquivo `segredo.enc` é criado; `cat segredo.enc` mostra bytes ilegíveis — o texto original não aparece.',
        },
        {
          order: 3,
          title: 'Descriptografar sem informar a chave',
          instructions:
            'Rode: `aws kms decrypt --ciphertext-blob fileb://segredo.enc --output text --query Plaintext | base64 --decode`. Repare que o comando não recebe `--key-id`.',
          validation:
            'O terminal mostra "segredo do devlab". Com chaves simétricas, o texto cifrado carrega a referência da chave usada, então o KMS sabe qual chave aplicar.',
        },
        {
          order: 4,
          title: 'Gerar uma chave de dados',
          instructions:
            'Rode: `aws kms generate-data-key --key-id alias/devlab-key --key-spec AES_256`.',
          validation:
            'A resposta traz `Plaintext` (a chave de dados em claro, para criptografar localmente e descartar) e `CiphertextBlob` (a mesma chave criptografada pela `devlab-key`, para guardar junto com os dados) — as duas metades da criptografia envelope.',
        },
        {
          order: 5,
          title: 'Habilitar a rotação automática',
          instructions:
            'De volta ao Console do KMS, abra a chave `devlab-key`, vá até a aba "Key rotation", habilite a rotação automática e mantenha o período padrão.',
          validation:
            'A aba "Key rotation" mostra a rotação automática habilitada com período de 365 dias. O ID e o ARN da chave continuam os mesmos — a rotação troca só o material criptográfico.',
        },
      ],
    },
    {
      title: 'S3 com SSE-KMS e TLS obrigatório',
      data: {
        level: 1,
        order: 2,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá configurado um bucket S3 com criptografia padrão SSE-KMS e Bucket Key, verificado a criptografia de um objeto, e bloqueado qualquer acesso ao bucket que não use HTTPS.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido a lição "Criptografia em repouso, em trânsito e certificados" ajuda.',
        context:
          'Uma auditoria exige que os documentos de um bucket fiquem criptografados com chaves do KMS (para que cada acesso fique registrado no CloudTrail) e que nenhum acesso aconteça sem TLS. Você vai configurar e provar as duas coisas.',
        troubleshooting:
          'O nome do bucket é recusado: nomes são globais — acrescente um sufixo único. \n\nA listagem via HTTP falha já no passo 3: confira se o CloudShell está na mesma região do bucket (a variável `$AWS_REGION` do CloudShell é usada no endpoint). \n\nA bucket policy é rejeitada com "Invalid principal" ou "Invalid resource": confira se trocou `NOME-DO-BUCKET` pelo nome real nas duas linhas de `Resource`. \n\nA listagem via HTTP não é negada no passo 5: confira se a policy foi salva e se o comando usa `--endpoint-url http://...` (sem o "s" de https).',
        cleanup:
          'Selecione o bucket, use "Empty" e depois "Delete". A chave `aws/s3` é gerenciada pela AWS e não precisa ser excluída.',
        costWarning:
          'A chave AWS managed `aws/s3` não tem custo mensal, e as poucas requisições ao KMS e ao S3 deste laboratório ficam dentro do Free Tier.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar o bucket com SSE-KMS',
          instructions:
            'No Console do S3, crie um bucket com nome único (ex.: `devlab-cripto-<suas-iniciais>-<data>`). Em "Default encryption", escolha "Server-side encryption with AWS Key Management Service keys (SSE-KMS)", selecione a chave AWS managed `aws/s3` e mantenha "Bucket Key" habilitado.',
          validation:
            'Na aba "Properties" do bucket, "Default encryption" mostra SSE-KMS com a chave `aws/s3` e Bucket Key habilitado.',
        },
        {
          order: 2,
          title: 'Enviar um objeto e verificar a criptografia',
          instructions:
            'Faça upload de um arquivo de texto qualquer chamado `documento.txt`, sem alterar nenhuma opção de criptografia no upload. Depois abra o objeto e veja a seção "Server-side encryption settings".',
          validation:
            'O objeto mostra criptografia SSE-KMS com o ARN da chave `aws/s3` — a criptografia padrão do bucket foi aplicada sem o upload pedir nada.',
        },
        {
          order: 3,
          title: 'Listar o bucket via HTTP, antes da policy',
          instructions:
            'Abra o AWS CloudShell na mesma região do bucket e rode `aws s3 ls s3://NOME-DO-BUCKET --endpoint-url http://s3.$AWS_REGION.amazonaws.com`, trocando `NOME-DO-BUCKET` pelo nome real. O `--endpoint-url http://` força a CLI a usar HTTP, sem TLS.',
          validation:
            'O comando lista `documento.txt` — por enquanto nada impede uma listagem sem TLS. (Um GET do próprio objeto via HTTP já falharia, porque objetos SSE-KMS exigem TLS; a listagem não tem essa proteção.)',
        },
        {
          order: 4,
          title: 'Exigir TLS com uma bucket policy',
          instructions:
            'Na aba "Permissions", edite a "Bucket policy" e cole a policy abaixo, trocando `NOME-DO-BUCKET` pelo nome do seu bucket: `{"Version":"2012-10-17","Statement":[{"Sid":"DenyInsecureTransport","Effect":"Deny","Principal":"*","Action":"s3:*","Resource":["arn:aws:s3:::NOME-DO-BUCKET","arn:aws:s3:::NOME-DO-BUCKET/*"],"Condition":{"Bool":{"aws:SecureTransport":"false"}}}]}`.',
          validation: 'A policy é salva sem erros e aparece na aba "Permissions".',
        },
        {
          order: 5,
          title: 'Provar que HTTP é negado e HTTPS funciona',
          instructions:
            'No CloudShell, repita o comando de listagem com `--endpoint-url http://...`. Depois rode `aws s3 cp s3://NOME-DO-BUCKET/documento.txt -` (sem `--endpoint-url`: a CLI usa HTTPS por padrão).',
          validation:
            'A listagem via HTTP agora falha com "AccessDenied" por causa da condição `aws:SecureTransport`; o `cp` via HTTPS imprime o conteúdo do arquivo — descriptografado de forma transparente, porque você tem permissão no bucket e na chave.',
        },
      ],
    },
  ];

  await seedLabs(encryptionTopic.id, encryptionLabs);

  const encryptionQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Qual é o tamanho máximo de dados que a API Encrypt do AWS KMS aceita diretamente?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'A API Encrypt aceita até 4 KB de texto claro. Para dados maiores, o padrão é a criptografia envelope com GenerateDataKey.',
      options: [
        { text: '4 KB', isCorrect: true, explanation: 'Correto: Encrypt é para pequenos segredos; acima disso, criptografia envelope.' },
        { text: '1 MB', isCorrect: false, explanation: 'O limite é bem menor: 4 KB.' },
        { text: '5 GB', isCorrect: false, explanation: '5 GB é o limite de um PUT único no S3, não do KMS.' },
        { text: 'Não há limite; o KMS processa arquivos de qualquer tamanho.', isCorrect: false, explanation: 'O KMS não foi feito para criptografar dados grandes diretamente.' },
      ],
    },
    {
      prompt: 'O que acontece com os dados já criptografados quando a rotação automática de uma customer managed key do KMS acontece?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Na rotação, o KMS gera novo material criptográfico mas mantém o material antigo. O ID/ARN da chave não muda, dados antigos continuam sendo descriptografados com o material antigo e dados novos usam o material novo — nenhuma recriptografia é necessária.',
      officialReferences: 'https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html',
      options: [
        {
          text: 'Continuam descriptografáveis normalmente; o KMS guarda o material antigo e não é preciso recriptografar nada.',
          isCorrect: true,
          explanation: 'Correto: a rotação é transparente para a aplicação.',
        },
        {
          text: 'Precisam ser recriptografados pela aplicação antes da rotação.',
          isCorrect: false,
          explanation: 'O KMS mantém o material antigo justamente para evitar isso.',
        },
        {
          text: 'Ficam inacessíveis até que a rotação seja revertida.',
          isCorrect: false,
          explanation: 'A rotação não afeta a leitura de dados antigos.',
        },
        {
          text: 'A chave ganha um novo ARN, e a aplicação precisa ser atualizada.',
          isCorrect: false,
          explanation: 'ID e ARN permanecem os mesmos na rotação.',
        },
      ],
    },
    {
      prompt: 'Uma aplicação precisa servir um site pelo Amazon CloudFront com HTTPS num domínio próprio, usando um certificado do ACM. Em qual região o certificado deve ser emitido?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation: 'O CloudFront só usa certificados do ACM emitidos (ou importados) na região us-east-1 (N. Virginia), independentemente de onde está a origem.',
      options: [
        { text: 'us-east-1 (N. Virginia)', isCorrect: true, explanation: 'Correto: é um requisito do CloudFront.' },
        { text: 'Na mesma região da origem (ex.: o bucket S3).', isCorrect: false, explanation: 'Vale para um load balancer regional, não para o CloudFront.' },
        { text: 'Em qualquer região; o certificado é replicado automaticamente.', isCorrect: false, explanation: 'Certificados do ACM são regionais e não são replicados.' },
        { text: 'Na região mais próxima dos usuários.', isCorrect: false, explanation: 'O CloudFront exige us-east-1.' },
      ],
    },
    {
      prompt:
        'Uma aplicação precisa criptografar arquivos de 50 MB com uma chave do KMS antes de gravá-los no disco. Qual é a abordagem correta?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Criptografia envelope: GenerateDataKey devolve uma chave de dados em claro e criptografada; o arquivo é criptografado localmente com a versão em claro (descartada em seguida) e a versão criptografada é guardada junto do arquivo.',
      officialReferences: 'https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html',
      options: [
        {
          text: 'Chamar GenerateDataKey, criptografar o arquivo localmente com a chave em claro, descartá-la e guardar a chave criptografada junto do arquivo.',
          isCorrect: true,
          explanation: 'Correto: é a criptografia envelope.',
        },
        {
          text: 'Chamar a API Encrypt enviando o arquivo inteiro.',
          isCorrect: false,
          explanation: 'Encrypt aceita no máximo 4 KB.',
        },
        {
          text: 'Dividir o arquivo em pedaços de 4 KB e chamar Encrypt para cada um.',
          isCorrect: false,
          explanation: 'Funcionaria de forma lenta e cara, e esbarraria nas cotas de requisição do KMS — não é o padrão recomendado.',
        },
        {
          text: 'Exportar a chave do KMS e usá-la localmente.',
          isCorrect: false,
          explanation: 'Chaves simétricas do KMS não podem ser exportadas.',
        },
      ],
    },
    {
      prompt:
        'Uma empresa precisa que o acesso aos objetos de um bucket S3 dependa também de permissão numa chave de criptografia, e que cada uso dessa chave fique registrado para auditoria. Qual criptografia do lado do servidor atende?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Com SSE-KMS, ler um objeto exige permissão de kms:Decrypt na chave (além da permissão no bucket), e cada uso da chave fica registrado no CloudTrail. SSE-S3 não oferece nem uma coisa nem outra.',
      options: [
        { text: 'SSE-KMS', isCorrect: true, explanation: 'Correto: controle de acesso pela key policy e auditoria no CloudTrail.' },
        { text: 'SSE-S3', isCorrect: false, explanation: 'As chaves são gerenciadas pelo S3, sem controle de acesso separado nem auditoria por uso.' },
        { text: 'SSE-C', isCorrect: false, explanation: 'Com SSE-C a chave fica com o cliente; não há registro de uso de chave na AWS.' },
        { text: 'Nenhuma: basta habilitar o versionamento.', isCorrect: false, explanation: 'Versionamento não tem relação com criptografia.' },
      ],
    },
    {
      prompt:
        'Uma política de segurança exige que o bucket S3 de uma aplicação recuse qualquer requisição feita sem TLS. Como implementar isso?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Uma bucket policy com Effect Deny para todas as ações quando a condição aws:SecureTransport é false bloqueia qualquer requisição HTTP sem TLS.',
      options: [
        {
          text: 'Bucket policy negando todas as ações quando aws:SecureTransport for false.',
          isCorrect: true,
          explanation: 'Correto: é a forma padrão de exigir TLS num bucket.',
        },
        {
          text: 'Habilitar a criptografia padrão SSE-KMS no bucket.',
          isCorrect: false,
          explanation: 'SSE-KMS é criptografia em repouso; não impede requisições sem TLS.',
        },
        {
          text: 'Habilitar o Block Public Access.',
          isCorrect: false,
          explanation: 'Bloqueia acesso público, mas não exige TLS de quem tem permissão.',
        },
        {
          text: 'Usar SSE-C em todos os uploads.',
          isCorrect: false,
          explanation: 'SSE-C exige HTTPS nas requisições que o usam, mas não impede outras requisições sem TLS no bucket.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação que processa milhares de objetos por segundo num bucket com SSE-KMS começa a receber ThrottlingException do KMS. Qual mudança reduz as chamadas ao KMS com o menor esforço?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'S3 Bucket Keys fazem o S3 gerar uma chave de nível de bucket a partir do KMS e usá-la para derivar as chaves dos objetos, reduzindo drasticamente as requisições ao KMS — é uma configuração do bucket, sem mudança de código.',
      options: [
        {
          text: 'Habilitar S3 Bucket Keys no bucket.',
          isCorrect: true,
          explanation: 'Correto: reduz muito as chamadas ao KMS sem mudar a aplicação.',
        },
        {
          text: 'Trocar a customer managed key por outra customer managed key.',
          isCorrect: false,
          explanation: 'A cota é por conta e região, não por chave; trocar de chave não resolve.',
        },
        {
          text: 'Desabilitar o CloudTrail.',
          isCorrect: false,
          explanation: 'O CloudTrail não influencia as cotas do KMS.',
        },
        {
          text: 'Habilitar a rotação automática da chave.',
          isCorrect: false,
          explanation: 'Rotação não altera o volume de requisições.',
        },
      ],
    },
    {
      prompt: 'Uma instância do Amazon RDS foi criada sem criptografia e agora precisa ser criptografada em repouso. Qual é o procedimento?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Não é possível habilitar criptografia numa instância RDS existente. O caminho é criar um snapshot, copiá-lo com criptografia habilitada (escolhendo a chave do KMS) e restaurar uma nova instância a partir da cópia criptografada.',
      options: [
        {
          text: 'Criar um snapshot, copiá-lo habilitando criptografia e restaurar uma nova instância a partir da cópia.',
          isCorrect: true,
          explanation: 'Correto: é o procedimento documentado.',
        },
        {
          text: 'Modificar a instância e marcar a opção de criptografia.',
          isCorrect: false,
          explanation: 'A criptografia só pode ser definida na criação da instância.',
        },
        {
          text: 'Criar uma réplica de leitura criptografada a partir da instância não criptografada.',
          isCorrect: false,
          explanation: 'Uma réplica de uma instância não criptografada também não é criptografada.',
        },
        {
          text: 'Habilitar SSL nas conexões com o banco.',
          isCorrect: false,
          explanation: 'SSL/TLS é criptografia em trânsito, não em repouso.',
        },
      ],
    },
    {
      prompt:
        'Um cliente exige manter e gerenciar as próprias chaves de criptografia fora da AWS, mas quer que o S3 faça a criptografia e a descriptografia dos objetos no lado do servidor. Qual opção atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Com SSE-C, o cliente envia a chave em cada requisição (via HTTPS); o S3 criptografa/descriptografa e descarta a chave, sem armazená-la. Se o cliente perder a chave, o objeto não pode mais ser lido.',
      options: [
        { text: 'SSE-C', isCorrect: true, explanation: 'Correto: a chave é do cliente, e o trabalho criptográfico é do S3.' },
        { text: 'SSE-S3', isCorrect: false, explanation: 'As chaves são do S3, não do cliente.' },
        { text: 'SSE-KMS com AWS managed key', isCorrect: false, explanation: 'A chave fica no KMS, gerenciada pela AWS.' },
        { text: 'Criptografia no lado do cliente', isCorrect: false, explanation: 'A chave fica com o cliente, mas o trabalho criptográfico sai do S3 — o requisito pedia criptografia no servidor.' },
      ],
    },
    {
      prompt:
        'A conta A tem uma customer managed key do KMS. Uma role da conta B precisa usá-la para descriptografar dados. O que é necessário?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Acesso entre contas ao KMS exige as duas pontas: a key policy na conta A deve permitir a conta B (ou a role) usar a chave, e uma policy do IAM na conta B deve permitir à role chamar kms:Decrypt nessa chave.',
      officialReferences:
        'https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-modifying-external-accounts.html',
      options: [
        {
          text: 'Permitir a conta B na key policy da chave (conta A) e dar à role, por uma policy do IAM na conta B, permissão de kms:Decrypt na chave.',
          isCorrect: true,
          explanation: 'Correto: key policy e IAM precisam permitir, cada um na sua conta.',
        },
        {
          text: 'Só uma policy do IAM na conta B permitindo kms:Decrypt.',
          isCorrect: false,
          explanation: 'Sem a key policy permitindo a conta B, a policy do IAM não tem efeito.',
        },
        {
          text: 'Só alterar a key policy na conta A.',
          isCorrect: false,
          explanation: 'Se a key policy delega à conta B, a role ainda precisa de uma policy do IAM na própria conta.',
        },
        {
          text: 'Exportar a chave e importá-la na conta B.',
          isCorrect: false,
          explanation: 'Chaves simétricas do KMS não podem ser exportadas.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação criptografa dados com uma chave de dados gerada pelo KMS e quer gerar, no momento do cadastro, uma chave de dados que só será usada dias depois por outro componente. Qual API é a mais adequada para gerá-la?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'GenerateDataKeyWithoutPlaintext devolve só a chave de dados criptografada — a versão em claro não precisa existir até ser usada, quando o componente chama Decrypt. Isso evita manter uma chave em claro sem necessidade.',
      options: [
        {
          text: 'GenerateDataKeyWithoutPlaintext',
          isCorrect: true,
          explanation: 'Correto: a chave em claro só aparece quando o componente chamar Decrypt.',
        },
        {
          text: 'GenerateDataKey',
          isCorrect: false,
          explanation: 'Devolveria também a chave em claro, que não é necessária agora.',
        },
        {
          text: 'Encrypt',
          isCorrect: false,
          explanation: 'Encrypt criptografa dados de até 4 KB; não gera chaves de dados.',
        },
        {
          text: 'CreateKey',
          isCorrect: false,
          explanation: 'Cria uma nova chave do KMS (com custo mensal), não uma chave de dados.',
        },
      ],
    },
    {
      prompt:
        'Um time quer controlar a key policy, usar a chave em outra conta e rotacionar a chave sob demanda. Um desenvolvedor sugere usar a chave AWS managed aws/s3. Por que essa sugestão não atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'Chaves AWS managed têm key policy controlada pela AWS (não editável), não podem ser usadas por outras contas e têm rotação automática anual fixa. Os requisitos exigem uma customer managed key.',
      options: [
        {
          text: 'Chaves AWS managed não permitem editar a key policy, uso entre contas nem rotação sob demanda; é preciso uma customer managed key.',
          isCorrect: true,
          explanation: 'Correto: controle total só com customer managed keys.',
        },
        {
          text: 'Chaves AWS managed não podem ser usadas pelo S3.',
          isCorrect: false,
          explanation: 'A aws/s3 é justamente a chave AWS managed do S3.',
        },
        {
          text: 'Chaves AWS managed custam mais que customer managed keys.',
          isCorrect: false,
          explanation: 'Chaves AWS managed não têm custo mensal.',
        },
        {
          text: 'Chaves AWS managed não são auditadas no CloudTrail.',
          isCorrect: false,
          explanation: 'O uso de chaves AWS managed também aparece no CloudTrail.',
        },
      ],
    },
    {
      prompt:
        'Um certificado público do ACM usado num Application Load Balancer não foi renovado automaticamente e expirou. Qual é a causa mais provável?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'A renovação gerenciada do ACM é automática quando o domínio foi validado por DNS e o registro CNAME de validação continua no lugar. Com validação por e-mail, a renovação exige que alguém aprove o e-mail enviado; se ninguém aprovar (ou o registro DNS foi removido), o certificado expira.',
      officialReferences: 'https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html',
      options: [
        {
          text: 'O domínio foi validado por e-mail (ou o CNAME de validação DNS foi removido), e a renovação não pôde ser concluída automaticamente.',
          isCorrect: true,
          explanation: 'Correto: renovação totalmente automática depende da validação por DNS mantida.',
        },
        {
          text: 'Certificados do ACM nunca são renovados automaticamente.',
          isCorrect: false,
          explanation: 'Certificados emitidos pelo ACM têm renovação gerenciada.',
        },
        {
          text: 'O ALB estava numa região diferente de us-east-1.',
          isCorrect: false,
          explanation: 'A exigência de us-east-1 é do CloudFront; ALBs usam certificados da própria região.',
        },
        {
          text: 'A chave do KMS do certificado foi rotacionada.',
          isCorrect: false,
          explanation: 'A renovação de certificados do ACM não depende de chaves do KMS da conta.',
        },
      ],
    },
  ];

  await seedQuestions(encryptionTopic.id, encryptionQuestionsToSeed);

  const encryptionFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Criptografia envelope',
      conceptDescription: 'Padrão de criptografar dados localmente com uma chave de dados protegida por uma chave do KMS.',
      serviceId: kmsService.id,
      front: 'Como funciona a criptografia envelope com o KMS?',
      back: 'GenerateDataKey devolve uma chave de dados em claro e criptografada. Criptografa-se os dados localmente com a versão em claro (descartada) e guarda-se a versão criptografada junto dos dados. Para ler, Decrypt na chave criptografada.',
    },
    {
      conceptName: 'Limite da API Encrypt',
      conceptDescription: 'Tamanho máximo de dados que o KMS criptografa diretamente.',
      serviceId: kmsService.id,
      front: 'Qual o tamanho máximo que a API Encrypt do KMS aceita?',
      back: '4 KB. Para dados maiores, usa-se criptografia envelope (GenerateDataKey).',
    },
    {
      conceptName: 'Tipos de chave do KMS',
      conceptDescription: 'AWS owned, AWS managed e customer managed keys.',
      serviceId: kmsService.id,
      front: 'Qual a diferença entre AWS managed keys e customer managed keys no KMS?',
      back: 'AWS managed (aws/s3 etc.): sem custo mensal, key policy não editável, rotação anual automática, sem uso entre contas. Customer managed: US$ 1/mês, controle total de key policy, grants, rotação e acesso entre contas.',
    },
    {
      conceptName: 'Rotação de chaves do KMS',
      conceptDescription: 'Troca do material criptográfico de uma chave mantendo o material antigo.',
      serviceId: kmsService.id,
      front: 'O que muda quando uma chave do KMS é rotacionada?',
      back: 'Só o material criptográfico usado para novos dados. ID e ARN não mudam, o material antigo é mantido e dados antigos continuam descriptografáveis sem recriptografar.',
    },
    {
      conceptName: 'Key policy e acesso entre contas',
      conceptDescription: 'Relação entre key policy e policies do IAM no controle de acesso a chaves do KMS.',
      serviceId: kmsService.id,
      front: 'O que é necessário para uma role de outra conta usar uma chave do KMS?',
      back: 'A key policy (na conta dona da chave) permitindo a outra conta, e uma policy do IAM na outra conta permitindo a ação (ex.: kms:Decrypt) na chave.',
    },
    {
      conceptName: 'Tipos de SSE no S3',
      conceptDescription: 'SSE-S3, SSE-KMS, DSSE-KMS e SSE-C.',
      serviceId: s3Service.id,
      front: 'Quando usar SSE-S3, SSE-KMS e SSE-C no S3?',
      back: 'SSE-S3: padrão, sem configuração. SSE-KMS: controle de acesso pela key policy e auditoria no CloudTrail. SSE-C: o cliente mantém a chave e a envia em cada requisição (HTTPS obrigatório).',
    },
    {
      conceptName: 'aws:SecureTransport',
      conceptDescription: 'Chave de condição usada para exigir TLS em bucket policies.',
      serviceId: s3Service.id,
      front: 'Como exigir que todo acesso a um bucket S3 use TLS?',
      back: 'Bucket policy com Deny em s3:* quando a condição aws:SecureTransport for false.',
    },
    {
      conceptName: 'S3 Bucket Keys',
      conceptDescription: 'Chave de nível de bucket que reduz as chamadas do SSE-KMS ao KMS.',
      serviceId: s3Service.id,
      front: 'Como reduzir o custo e o throttling do KMS num bucket com SSE-KMS?',
      back: 'Habilitando S3 Bucket Keys: o S3 usa uma chave de nível de bucket para derivar as chaves dos objetos, reduzindo drasticamente as chamadas ao KMS.',
    },
    {
      conceptName: 'ACM e CloudFront',
      conceptDescription: 'Regras de região e renovação dos certificados do AWS Certificate Manager.',
      serviceId: acmService.id,
      front: 'Quais são as duas regras do ACM mais cobradas na prova?',
      back: 'Certificados para o CloudFront precisam estar em us-east-1. A renovação automática depende da validação por DNS (por e-mail exige aprovação manual).',
    },
  ];

  await seedFlashcards(encryptionTopic.id, encryptionFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 5 of 12: Domain 2 "Dados sensíveis no
  // código da aplicação", to the exam-readiness bar.
  // ---------------------------------------------------------------------

  const sensitiveDataTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: securityDomain.id, name: 'Dados sensíveis no código da aplicação' },
  });

  const secretsManagerServiceData = {
    shortName: 'Secrets Manager',
    category: 'Security, Identity, & Compliance',
    description:
      'Armazena, recupera e rotaciona automaticamente segredos como credenciais de banco de dados e chaves de API.',
  };
  const secretsManagerService = await prisma.aWSService.upsert({
    where: { name: 'AWS Secrets Manager' },
    update: secretsManagerServiceData,
    create: { name: 'AWS Secrets Manager', ...secretsManagerServiceData },
  });

  const systemsManagerServiceData = {
    shortName: 'Systems Manager',
    category: 'Management & Governance',
    description:
      'Conjunto de ferramentas de operação; inclui o Parameter Store, que guarda configurações e segredos (SecureString) em hierarquias.',
  };
  const systemsManagerService = await prisma.aWSService.upsert({
    where: { name: 'AWS Systems Manager' },
    update: systemsManagerServiceData,
    create: { name: 'AWS Systems Manager', ...systemsManagerServiceData },
  });

  const macieServiceData = {
    shortName: 'Macie',
    category: 'Security, Identity, & Compliance',
    description: 'Descobre e classifica dados sensíveis (como PII) armazenados no Amazon S3 usando machine learning.',
  };
  const macieService = await prisma.aWSService.upsert({
    where: { name: 'Amazon Macie' },
    update: macieServiceData,
    create: { name: 'Amazon Macie', ...macieServiceData },
  });

  const cloudWatchServiceData = {
    shortName: 'CloudWatch',
    category: 'Management & Governance',
    description: 'Coleta métricas, logs e alarmes das aplicações e dos serviços da AWS.',
  };
  const cloudWatchService = await prisma.aWSService.upsert({
    where: { name: 'Amazon CloudWatch' },
    update: cloudWatchServiceData,
    create: { name: 'Amazon CloudWatch', ...cloudWatchServiceData },
  });

  const secretsLessonContent = `## Objetivo

Ao final desta lição você vai conseguir escolher entre o AWS Secrets Manager e o Parameter Store do AWS Systems Manager, organizar parâmetros em hierarquias, entender a rotação de segredos e injetar segredos em infraestrutura como código sem expô-los.

## O problema: segredos no código

Senhas de banco, chaves de API e tokens escritos no código-fonte (ou em arquivos de configuração versionados) acabam no histórico do Git, em logs de build e nas máquinas de todos que clonam o repositório — e trocar um segredo passa a exigir um novo deploy. A regra é: o código guarda só o **nome** do segredo, e o valor é buscado em tempo de execução num serviço feito para isso, com acesso controlado pelo IAM. E, para acessar serviços da AWS, nem segredo deve existir: a aplicação usa a IAM role do ambiente (role de execução do Lambda, instance profile do EC2, task role do ECS), e o SDK obtém credenciais temporárias sozinho — nunca access keys no código.

## Parameter Store

O Parameter Store guarda valores de configuração e segredos em três tipos: \`String\`, \`StringList\` e \`SecureString\` — este último criptografado com uma chave do KMS (a AWS managed \`aws/ssm\` ou uma customer managed). Ler um \`SecureString\` em claro exige \`--with-decryption\` e permissão de \`kms:Decrypt\` na chave, além de \`ssm:GetParameter\`.

Parâmetros são organizados em hierarquias por caminho, como \`/minha-app/prod/db/senha\`, e \`GetParametersByPath\` (com \`Recursive\`) lê uma árvore inteira numa chamada — e as policies do IAM podem restringir o acesso por caminho. Cada alteração gera uma nova versão, e versões podem receber labels.

Há dois níveis: **Standard** (gratuito, até 10.000 parâmetros por conta e região, valores de até 4 KB, sem parameter policies) e **Advanced** (pago por parâmetro, até 100.000, valores de até 8 KB, e parameter policies como expiração e notificações).

## Secrets Manager

O Secrets Manager é feito especificamente para segredos: guarda valores de até 64 KB (normalmente um JSON com usuário e senha), sempre criptografados com o KMS, e cobra por segredo por mês e por chamadas de API. O que o diferencia é a **rotação automática**: para Amazon RDS, Aurora, Redshift e DocumentDB há rotação pronta, executada por uma função Lambda num agendamento (para outros tipos de segredo, você escreve a função de rotação). Ele também replica segredos entre regiões e aceita resource-based policies (inclusive para acesso entre contas).

Cada versão de um segredo carrega staging labels: \`AWSCURRENT\` (a versão atual — é a que \`GetSecretValue\` devolve por padrão), \`AWSPENDING\` (a versão sendo criada durante uma rotação) e \`AWSPREVIOUS\` (a versão anterior, útil para rollback). Excluir um segredo agenda a exclusão com uma janela de recuperação de 7 a 30 dias.

## Qual escolher

- Precisa de **rotação automática** (sobretudo de credenciais de banco) ou de replicação entre regiões → **Secrets Manager**.
- Configurações e segredos sem rotação, com foco em **custo** e organização hierárquica → **Parameter Store** (\`SecureString\` no nível Standard é gratuito).

## Segredos em infraestrutura como código

No CloudFormation, dynamic references resolvem o valor no momento do deploy sem que ele apareça no template: \`{{resolve:secretsmanager:nome-do-segredo:SecretString:senha}}\` para o Secrets Manager e \`{{resolve:ssm-secure:/caminho/do/parametro}}\` para um \`SecureString\` (este último só em propriedades que o suportam). Para o RDS, a opção de o próprio serviço gerenciar a senha mestre no Secrets Manager dispensa até isso.

## Relação com a prova DVA-C02

Espere cenários de Secrets Manager vs. Parameter Store (rotação vs. custo), \`SecureString\` e a permissão de \`kms:Decrypt\`, \`GetParametersByPath\`, níveis Standard vs. Advanced, staging labels da rotação, e dynamic references no CloudFormation.`;

  const sensitiveDataLessonContent = `## Objetivo

Ao final desta lição você vai conseguir classificar dados sensíveis, proteger variáveis de ambiente do Lambda, buscar segredos em tempo de execução com eficiência e evitar que dados sensíveis vazem em logs.

## Classificando dados sensíveis

Antes de proteger, é preciso saber o que é sensível. As categorias mais comuns: **PII** (informação pessoal identificável — nome, CPF, e-mail, endereço), **PHI** (informação de saúde protegida, sob regras como a HIPAA) e **dados de cartão** (sob o PCI DSS), além de credenciais e segredos da própria aplicação. A classificação define onde o dado pode ser armazenado, quem acessa, por quanto tempo é retido e se pode aparecer em logs. Para descobrir dados sensíveis já espalhados em buckets S3, o **Amazon Macie** usa machine learning e padrões para identificar PII e gera findings por bucket e objeto.

## Variáveis de ambiente do Lambda

Variáveis de ambiente do Lambda (até 4 KB no total por função) são criptografadas em repouso com a chave AWS managed \`aws/lambda\` por padrão, ou com uma customer managed key que você escolher. Mas quem tem permissão de ver a configuração da função vê os valores em claro no Console e na API. Os **encryption helpers** do Console criptografam o valor no lado do cliente antes de salvá-lo, de modo que a configuração guarda só o texto cifrado — e o código precisa chamar \`kms:Decrypt\` para usá-lo.

Na prática, a abordagem preferida é outra: guardar na variável de ambiente só o **nome** do segredo (ex.: \`SECRET_ID=minha-app/prod/db\`) e buscar o valor no Secrets Manager ou no Parameter Store, com a permissão dada à role de execução da função.

## Buscando segredos com eficiência

Buscar o segredo a cada invocação adiciona latência, custo por chamada de API e risco de throttling. O padrão é buscar uma vez e manter em cache: no Lambda, uma variável fora do handler sobrevive entre invocações do mesmo ambiente de execução (warm start). A **AWS Parameters and Secrets Lambda Extension** faz isso pronto: roda como layer, expõe um endpoint HTTP local (porta 2773) e mantém um cache com TTL configurável para parâmetros e segredos. Para linguagens fora do Lambda, os clientes de cache do Secrets Manager cumprem o mesmo papel. Com rotação habilitada, o TTL do cache define por quanto tempo a aplicação pode usar um valor antigo — trate erros de autenticação relendo o segredo.

## Dados sensíveis em logs

Um \`console.log(event)\` inocente pode gravar CPF, e-mail ou tokens no CloudWatch Logs, onde muito mais gente tem acesso do que ao banco. Boas práticas: logar só identificadores necessários, mascarar valores (\`abc***\`) antes de logar, e nunca logar segredos. Como rede de proteção, as **data protection policies do CloudWatch Logs** detectam e mascaram dados sensíveis (e-mails, números de cartão, credenciais etc.) nos log groups — só principais com a permissão \`logs:Unmask\` veem os valores originais.

## Relação com a prova DVA-C02

Espere cenários sobre remover credenciais do código (IAM role + Secrets Manager), permissões necessárias para ler um segredo ou um \`SecureString\` (incluindo \`kms:Decrypt\` com customer managed key), cache de segredos no Lambda, encryption helpers, Macie para encontrar PII no S3, e mascaramento de dados sensíveis em logs.`;

  const sensitiveDataLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 12,
      title: 'Secrets Manager e Parameter Store',
      content: secretsLessonContent,
      resources: [
        {
          title: 'AWS Secrets Manager — documentação oficial',
          url: 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html',
        },
        {
          title: 'AWS Systems Manager Parameter Store — documentação oficial',
          url: 'https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 9,
      title: 'Dados sensíveis na aplicação: Lambda, cache e logs',
      content: sensitiveDataLessonContent,
      resources: [
        {
          title: 'Usar segredos do Secrets Manager em funções Lambda — documentação oficial',
          url: 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html',
        },
        {
          title: 'Mascarar dados sensíveis no CloudWatch Logs — documentação oficial',
          url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/mask-sensitive-log-data.html',
        },
      ],
    },
  ];

  await seedLessons(sensitiveDataTopic.id, sensitiveDataLessons);

  const lambdaSecretCode = `Em "Code", substitua o conteúdo de \`lambda_function.py\` pelo código abaixo e clique em "Deploy":

\`\`\`python
import json
import os

import boto3

client = boto3.client("secretsmanager")
_cache = {}


def get_secret(secret_id):
    # Fora do handler: o cache sobrevive entre invocações do mesmo ambiente (warm start).
    if secret_id not in _cache:
        response = client.get_secret_value(SecretId=secret_id)
        _cache[secret_id] = json.loads(response["SecretString"])
    return _cache[secret_id]


def lambda_handler(event, context):
    secret = get_secret(os.environ["SECRET_ID"])
    # Nunca devolva nem logue o segredo inteiro: só uma versão mascarada.
    return {"apiKeyMascarada": secret["apiKey"][:3] + "***"}
\`\`\``;

  const sensitiveDataLabs: LabSeed[] = [
    {
      title: 'Parameter Store e Secrets Manager pela AWS CLI',
      data: {
        level: 1,
        order: 1,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá criado parâmetros String e SecureString numa hierarquia do Parameter Store, lido a hierarquia inteira numa chamada, e criado um segredo no Secrets Manager cuja atualização gera as versões AWSCURRENT e AWSPREVIOUS.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido a lição "Secrets Manager e Parameter Store" ajuda.',
        context:
          'Uma aplicação guarda a senha do banco e o nível de log num arquivo de configuração versionado no Git. O time decidiu tirar isso do código: configurações e a senha vão para o Parameter Store, e uma chave de API de um parceiro, que será rotacionada, vai para o Secrets Manager.',
        troubleshooting:
          'ParameterAlreadyExists: o parâmetro já existe (talvez de uma tentativa anterior) — acrescente `--overwrite` ao `put-parameter`. \n\nO valor do SecureString aparece como um texto longo e ilegível: é o valor criptografado — faltou `--with-decryption`. \n\nResourceExistsException ao criar o segredo: um segredo com esse nome existe ou está agendado para exclusão — use outro nome ou restaure-o com `aws secretsmanager restore-secret`. \n\nErro de sintaxe no JSON do segredo: no CloudShell, mantenha o JSON entre aspas simples, como no exemplo.',
        cleanup:
          'No CloudShell, rode `aws ssm delete-parameters --names /devlab/prod/app/log-level /devlab/prod/db/senha` e `aws secretsmanager delete-secret --secret-id devlab/prod/parceiro --force-delete-without-recovery` (sem a flag, o segredo fica agendado para exclusão por 30 dias).',
        costWarning:
          'Parâmetros Standard do Parameter Store são gratuitos. No Secrets Manager, segredos novos têm um período de teste gratuito de 30 dias; fora dele, custam US$ 0,40 por mês (proporcional) mais US$ 0,05 por 10.000 chamadas. Exclua o segredo ao final.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar os parâmetros',
          instructions:
            'Abra o AWS CloudShell e crie um parâmetro comum e um SecureString (criptografado com a chave `aws/ssm`):\n\n```bash\naws ssm put-parameter --name /devlab/prod/app/log-level --type String --value INFO\naws ssm put-parameter --name /devlab/prod/db/senha --type SecureString --value \'SenhaDeTeste123!\'\n```',
          validation:
            'No Console do Systems Manager, em "Parameter Store", aparecem os dois parâmetros; `/devlab/prod/db/senha` tem tipo `SecureString` e a chave `alias/aws/ssm`.',
        },
        {
          order: 2,
          title: 'Ler o SecureString com e sem descriptografia',
          instructions:
            'Rode `aws ssm get-parameter --name /devlab/prod/db/senha --query Parameter.Value` e depois o mesmo comando com `--with-decryption`.',
          validation:
            'Sem a flag, o valor volta criptografado (texto longo e ilegível); com `--with-decryption`, volta `SenhaDeTeste123!` — o KMS descriptografou porque você tem `kms:Decrypt` na chave.',
        },
        {
          order: 3,
          title: 'Ler a hierarquia inteira',
          instructions:
            'Rode:\n\n```bash\naws ssm get-parameters-by-path --path /devlab/prod --recursive --with-decryption --query "Parameters[].{Nome:Name,Valor:Value}"\n```',
          validation:
            'Os dois parâmetros voltam numa única chamada, com nome e valor — é assim que uma aplicação carrega toda a sua configuração de um ambiente (`/devlab/prod`) de uma vez.',
        },
        {
          order: 4,
          title: 'Criar um segredo no Secrets Manager',
          instructions:
            'Rode:\n\n```bash\naws secretsmanager create-secret --name devlab/prod/parceiro --secret-string \'{"apiKey":"chave-inicial","usuario":"devlab"}\'\n```\n\nDepois leia o segredo com `aws secretsmanager get-secret-value --secret-id devlab/prod/parceiro`.',
          validation:
            'A leitura devolve `SecretString` com o JSON e `VersionStages` igual a `["AWSCURRENT"]`.',
        },
        {
          order: 5,
          title: 'Atualizar o segredo e ver as versões',
          instructions:
            'Grave um novo valor e liste as versões:\n\n```bash\naws secretsmanager put-secret-value --secret-id devlab/prod/parceiro --secret-string \'{"apiKey":"chave-nova","usuario":"devlab"}\'\naws secretsmanager list-secret-version-ids --secret-id devlab/prod/parceiro\n```',
          validation:
            'Aparecem duas versões: a nova com `AWSCURRENT` e a anterior com `AWSPREVIOUS`. Um `get-secret-value` sem opções agora devolve `chave-nova`; com `--version-stage AWSPREVIOUS`, devolve `chave-inicial` — o mesmo mecanismo que a rotação automática usa.',
        },
      ],
    },
    {
      title: 'Função Lambda lendo um segredo com cache e menor privilégio',
      data: {
        level: 2,
        order: 2,
        estimatedMinutes: 30,
        objective:
          'Ao final deste laboratório você terá uma função Lambda que busca uma chave de API no Secrets Manager em tempo de execução, com o nome do segredo numa variável de ambiente, permissão restrita a esse único segredo e cache entre invocações.',
        prerequisites:
          'Conta AWS com acesso ao Console. Ter feito o laboratório de Lambda do tópico "Fundamentos do AWS Lambda" e lido a lição "Dados sensíveis na aplicação: Lambda, cache e logs" ajuda.',
        context:
          'Uma função Lambda chama a API de um parceiro e, hoje, a chave está escrita no código. Você vai movê-la para o Secrets Manager, dar à função permissão só para ler aquele segredo, e evitar uma chamada ao Secrets Manager a cada invocação.',
        troubleshooting:
          'AccessDeniedException no passo 4: é o esperado — a role ainda não tem permissão. Se o erro continuar depois do passo 5, confira se o `Resource` da policy é o ARN completo do segredo (termina com um sufixo de 6 caracteres aleatórios, ex.: `devlab/prod/lambda-api-AbC123`). \n\nKeyError: \'SECRET_ID\': a variável de ambiente não foi salva ou tem outro nome — confira em "Configuration" > "Environment variables". \n\nTask timed out: aumente o timeout da função em "Configuration" > "General configuration" (ex.: 10 segundos) — a primeira chamada inclui a inicialização do SDK.',
        cleanup:
          'Exclua a função `devlab-le-segredo`, o log group `/aws/lambda/devlab-le-segredo` no CloudWatch Logs e a role de execução criada para ela (no IAM). Exclua o segredo com `aws secretsmanager delete-secret --secret-id devlab/prod/lambda-api --force-delete-without-recovery`.',
        costWarning:
          'As invocações ficam dentro do Free Tier do Lambda. O segredo novo tem período de teste gratuito de 30 dias no Secrets Manager (depois, US$ 0,40 por mês, proporcional) — exclua-o ao final.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar o segredo',
          instructions:
            'No CloudShell, rode:\n\n```bash\naws secretsmanager create-secret --name devlab/prod/lambda-api --secret-string \'{"apiKey":"abc123-chave-secreta"}\'\n```\n\nCopie o `ARN` da resposta.',
          validation: 'A resposta traz o `ARN` do segredo, terminando em `devlab/prod/lambda-api-` seguido de 6 caracteres.',
        },
        {
          order: 2,
          title: 'Criar a função e a variável de ambiente',
          instructions:
            'No Console do Lambda, crie a função `devlab-le-segredo` com a versão mais recente de Python e a opção padrão de criar uma nova role de execução. Em "Configuration" > "Environment variables", adicione `SECRET_ID` com o valor `devlab/prod/lambda-api` — o **nome** do segredo, não o valor.',
          validation: 'A função aparece criada, e a variável `SECRET_ID` está listada com o nome do segredo.',
        },
        {
          order: 3,
          title: 'Escrever o código',
          instructions: lambdaSecretCode,
          validation: 'O Console mostra que o deploy foi concluído ("Successfully updated the function").',
        },
        {
          order: 4,
          title: 'Testar sem permissão',
          instructions:
            'Na aba "Test", crie um evento de teste qualquer (o conteúdo padrão serve) e execute.',
          validation:
            'A execução falha com `AccessDeniedException` citando `secretsmanager:GetSecretValue` — a role de execução só tem permissão para gravar logs, e o menor privilégio está funcionando.',
        },
        {
          order: 5,
          title: 'Dar permissão só para este segredo',
          instructions:
            'Em "Configuration" > "Permissions", abra a role de execução no IAM, clique em "Add permissions" > "Create inline policy", escolha o editor JSON e cole a policy abaixo, trocando `ARN-DO-SEGREDO` pelo ARN copiado no passo 1:\n\n```json\n{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": "secretsmanager:GetSecretValue",\n      "Resource": "ARN-DO-SEGREDO"\n    }\n  ]\n}\n```\n\nSalve com o nome `devlab-le-segredo-policy`.',
          validation: 'A role passa a listar a policy inline `devlab-le-segredo-policy`.',
        },
        {
          order: 6,
          title: 'Testar de novo e observar o cache',
          instructions:
            'Volte à função e execute o teste duas vezes seguidas. Compare a duração ("Duration") mostrada em cada execução.',
          validation:
            'As duas execuções devolvem `{"apiKeyMascarada": "abc***"}`. A segunda é bem mais rápida: o segredo veio do cache fora do handler, sem nova chamada ao Secrets Manager. Como o segredo usa a chave AWS managed `aws/secretsmanager`, não foi preciso dar `kms:Decrypt` explicitamente à role.',
        },
      ],
    },
  ];

  await seedLabs(sensitiveDataTopic.id, sensitiveDataLabs);

  const sensitiveDataQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Qual serviço oferece rotação automática nativa de credenciais de um banco Amazon RDS?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'O AWS Secrets Manager tem rotação automática pronta para RDS, Aurora, Redshift e DocumentDB, executada por uma função Lambda num agendamento. O Parameter Store não tem rotação nativa.',
      officialReferences: 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html',
      options: [
        { text: 'AWS Secrets Manager', isCorrect: true, explanation: 'Correto: rotação nativa é o principal diferencial dele.' },
        { text: 'Parameter Store do AWS Systems Manager', isCorrect: false, explanation: 'O Parameter Store não rotaciona valores automaticamente.' },
        { text: 'AWS KMS', isCorrect: false, explanation: 'O KMS rotaciona chaves criptográficas, não senhas de banco.' },
        { text: 'Amazon Macie', isCorrect: false, explanation: 'O Macie descobre dados sensíveis no S3; não gerencia credenciais.' },
      ],
    },
    {
      prompt: 'Qual tipo de parâmetro do Parameter Store armazena o valor criptografado com uma chave do KMS?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation: 'SecureString criptografa o valor com uma chave do KMS (aws/ssm ou customer managed). String e StringList são armazenados em texto claro.',
      options: [
        { text: 'SecureString', isCorrect: true, explanation: 'Correto.' },
        { text: 'String', isCorrect: false, explanation: 'Armazenado em texto claro.' },
        { text: 'StringList', isCorrect: false, explanation: 'Lista de valores separados por vírgula, em texto claro.' },
        { text: 'EncryptedString', isCorrect: false, explanation: 'Esse tipo não existe no Parameter Store.' },
      ],
    },
    {
      prompt: 'Por padrão, como as variáveis de ambiente de uma função Lambda são protegidas em repouso?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'O Lambda criptografa as variáveis de ambiente em repouso com a chave AWS managed aws/lambda por padrão (ou com uma customer managed key, se configurada). Quem pode ver a configuração da função, porém, vê os valores em claro — por isso segredos devem ficar no Secrets Manager ou no Parameter Store.',
      options: [
        {
          text: 'São criptografadas com a chave AWS managed aws/lambda do KMS.',
          isCorrect: true,
          explanation: 'Correto: criptografia em repouso padrão, sem configuração.',
        },
        {
          text: 'Não são criptografadas; ficam em texto claro.',
          isCorrect: false,
          explanation: 'Elas são criptografadas em repouso por padrão.',
        },
        {
          text: 'São armazenadas automaticamente no Secrets Manager.',
          isCorrect: false,
          explanation: 'O Lambda não move variáveis de ambiente para o Secrets Manager.',
        },
        {
          text: 'São criptografadas só se os encryption helpers forem usados.',
          isCorrect: false,
          explanation: 'Os encryption helpers adicionam criptografia no lado do cliente; a criptografia em repouso existe sempre.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação precisa guardar 30 valores de configuração e 3 senhas que nunca são rotacionadas, com o menor custo possível e criptografia para as senhas. Qual solução atende?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'O Parameter Store no nível Standard é gratuito: os valores de configuração vão como String e as senhas como SecureString (criptografadas com o KMS). O Secrets Manager cobraria por segredo sem que a rotação, seu diferencial, seja necessária.',
      options: [
        {
          text: 'Parameter Store (nível Standard), com as senhas como SecureString.',
          isCorrect: true,
          explanation: 'Correto: gratuito e com criptografia para as senhas.',
        },
        {
          text: 'Secrets Manager para os 33 valores.',
          isCorrect: false,
          explanation: 'Cobraria por segredo sem necessidade de rotação.',
        },
        {
          text: 'Variáveis de ambiente em texto claro no código.',
          isCorrect: false,
          explanation: 'Senhas no código ficam expostas no repositório.',
        },
        {
          text: 'Parameter Store no nível Advanced.',
          isCorrect: false,
          explanation: 'Advanced é cobrado e só é necessário para valores acima de 4 KB, muitos parâmetros ou parameter policies.',
        },
      ],
    },
    {
      prompt:
        'Uma aplicação guarda sua configuração em parâmetros como /loja/prod/db/host, /loja/prod/db/senha e /loja/prod/api/url. Como carregar todos os parâmetros do ambiente prod numa única chamada, já descriptografados?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'GetParametersByPath com Path=/loja/prod, Recursive=true e WithDecryption=true lê toda a hierarquia numa chamada (paginada, se houver muitos parâmetros), descriptografando os SecureString.',
      options: [
        {
          text: 'GetParametersByPath com Path /loja/prod, Recursive e WithDecryption.',
          isCorrect: true,
          explanation: 'Correto: é o propósito das hierarquias do Parameter Store.',
        },
        {
          text: 'GetParameter com o nome /loja/prod/*.',
          isCorrect: false,
          explanation: 'GetParameter não aceita curingas; lê um parâmetro por nome.',
        },
        {
          text: 'DescribeParameters com WithDecryption.',
          isCorrect: false,
          explanation: 'DescribeParameters lista metadados, não valores.',
        },
        {
          text: 'GetSecretValue com o prefixo /loja/prod.',
          isCorrect: false,
          explanation: 'GetSecretValue é do Secrets Manager e lê um segredo por vez.',
        },
      ],
    },
    {
      prompt:
        'Durante uma revisão, descobre-se que a senha do banco de produção está escrita no código-fonte de uma função Lambda e já foi enviada ao repositório Git. Qual é a resposta mais adequada?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'A senha já vazou para o histórico do Git, então precisa ser trocada. Em seguida, ela vai para o Secrets Manager (com rotação, se possível) e a função passa a buscá-la em tempo de execução, com permissão dada pela role de execução.',
      options: [
        {
          text: 'Trocar a senha, guardá-la no Secrets Manager e fazer a função buscá-la em tempo de execução usando a role de execução.',
          isCorrect: true,
          explanation: 'Correto: remediar o vazamento e eliminar o segredo do código.',
        },
        {
          text: 'Apagar a linha do código e fazer um novo commit.',
          isCorrect: false,
          explanation: 'A senha continua no histórico do Git e continua válida.',
        },
        {
          text: 'Mover a senha para uma variável de ambiente da função.',
          isCorrect: false,
          explanation: 'Melhora pouco (fica visível na configuração) e não resolve a senha que já vazou.',
        },
        {
          text: 'Tornar o repositório privado.',
          isCorrect: false,
          explanation: 'Quem já teve acesso ainda tem a senha, e ela continua no histórico.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda chama GetSecretValue a cada invocação. Com o aumento do tráfego, a latência subiu e o custo de chamadas ao Secrets Manager cresceu. Qual é a melhor correção?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Manter o segredo em cache entre invocações — numa variável fora do handler ou com a AWS Parameters and Secrets Lambda Extension, que tem cache com TTL — elimina a maior parte das chamadas.',
      officialReferences: 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html',
      options: [
        {
          text: 'Fazer cache do segredo entre invocações (fora do handler ou com a Parameters and Secrets Lambda Extension).',
          isCorrect: true,
          explanation: 'Correto: menos chamadas, menos latência e menos custo.',
        },
        {
          text: 'Copiar o valor do segredo para uma variável de ambiente.',
          isCorrect: false,
          explanation: 'Expõe o segredo na configuração da função e quebra com a rotação.',
        },
        {
          text: 'Aumentar a memória da função.',
          isCorrect: false,
          explanation: 'Não reduz o número de chamadas ao Secrets Manager.',
        },
        {
          text: 'Trocar o Secrets Manager por um arquivo no pacote de deploy.',
          isCorrect: false,
          explanation: 'Volta a colocar o segredo junto do código.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda lê um parâmetro SecureString criptografado com uma customer managed key e recebe AccessDeniedException, embora sua role tenha ssm:GetParameter no parâmetro. Qual é a causa mais provável?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'Para descriptografar um SecureString, a role precisa também de kms:Decrypt na chave usada (e a key policy precisa permitir). Com uma customer managed key, isso não vem por padrão.',
      options: [
        {
          text: 'Falta a permissão kms:Decrypt na customer managed key.',
          isCorrect: true,
          explanation: 'Correto: ler em claro exige acesso ao parâmetro e à chave.',
        },
        {
          text: 'SecureString não pode ser lido por funções Lambda.',
          isCorrect: false,
          explanation: 'Pode, com as permissões certas.',
        },
        {
          text: 'O parâmetro precisa estar no nível Advanced.',
          isCorrect: false,
          explanation: 'SecureString existe nos dois níveis.',
        },
        {
          text: 'Falta a permissão secretsmanager:GetSecretValue.',
          isCorrect: false,
          explanation: 'O parâmetro está no Parameter Store, não no Secrets Manager.',
        },
      ],
    },
    {
      prompt:
        'Uma empresa precisa descobrir quais buckets S3, entre centenas, contêm arquivos com dados pessoais (PII) como CPF e e-mail. Qual serviço atende com menos esforço?',
      type: 'SCENARIO',
      difficulty: 'EASY',
      explanation:
        'O Amazon Macie analisa objetos no S3 com machine learning e identificadores de dados para encontrar PII, gerando findings por bucket e objeto.',
      options: [
        { text: 'Amazon Macie', isCorrect: true, explanation: 'Correto: é o serviço de descoberta de dados sensíveis no S3.' },
        { text: 'AWS Secrets Manager', isCorrect: false, explanation: 'Guarda segredos; não varre buckets.' },
        { text: 'AWS KMS', isCorrect: false, explanation: 'Criptografa dados; não os classifica.' },
        { text: 'S3 Inventory', isCorrect: false, explanation: 'Lista objetos e metadados, sem analisar o conteúdo.' },
      ],
    },
    {
      prompt:
        'Após uma rotação automática no Secrets Manager, um sistema legado precisa temporariamente ler o valor anterior do segredo para concluir um rollback. Qual staging label ele deve pedir?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'AWSPREVIOUS marca a versão anterior depois de uma rotação. AWSCURRENT é a versão atual (o padrão de GetSecretValue) e AWSPENDING é a versão em criação durante a rotação.',
      options: [
        { text: 'AWSPREVIOUS', isCorrect: true, explanation: 'Correto: é a versão que era atual antes da rotação.' },
        { text: 'AWSCURRENT', isCorrect: false, explanation: 'É o valor novo, após a rotação.' },
        { text: 'AWSPENDING', isCorrect: false, explanation: 'Marca a versão em criação durante a rotação.' },
        { text: 'AWSLATEST', isCorrect: false, explanation: 'Esse staging label não existe.' },
      ],
    },
    {
      prompt:
        'Um template do CloudFormation cria uma instância RDS e hoje recebe a senha mestre como um parâmetro em texto claro. Como passar a senha guardada no Secrets Manager sem que ela apareça no template?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Uma dynamic reference como {{resolve:secretsmanager:nome-do-segredo:SecretString:password}} faz o CloudFormation buscar o valor no momento do deploy, sem que ele apareça no template nem na saída da stack.',
      officialReferences:
        'https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references.html',
      options: [
        {
          text: 'Usar uma dynamic reference {{resolve:secretsmanager:...}} na propriedade da senha.',
          isCorrect: true,
          explanation: 'Correto: o valor é resolvido no deploy, sem ficar no template.',
        },
        {
          text: 'Usar um parâmetro do template com NoEcho e digitar a senha em cada deploy.',
          isCorrect: false,
          explanation: 'Esconde o valor na saída, mas a senha continua sendo digitada e não vem do Secrets Manager.',
        },
        {
          text: 'Colocar a senha num Output da stack.',
          isCorrect: false,
          explanation: 'Outputs expõem valores.',
        },
        {
          text: 'Usar Fn::GetAtt no segredo.',
          isCorrect: false,
          explanation: 'GetAtt não devolve o valor do segredo.',
        },
      ],
    },
    {
      prompt:
        'Os logs de uma aplicação no CloudWatch Logs estão registrando e-mails e números de cartão dos clientes. Enquanto o código é corrigido, como evitar que quem consulta os logs veja esses valores?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Uma data protection policy no log group detecta e mascara dados sensíveis (e-mails, números de cartão etc.) nos eventos de log. Só principais com a permissão logs:Unmask veem os valores originais.',
      officialReferences: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/mask-sensitive-log-data.html',
      options: [
        {
          text: 'Aplicar uma data protection policy no log group, que mascara os dados sensíveis (só quem tem logs:Unmask vê os originais).',
          isCorrect: true,
          explanation: 'Correto: é a proteção nativa do CloudWatch Logs para esse caso.',
        },
        {
          text: 'Criptografar o log group com uma chave do KMS.',
          isCorrect: false,
          explanation: 'Protege em repouso, mas quem pode ler os logs continua vendo os valores.',
        },
        {
          text: 'Reduzir a retenção do log group para 1 dia.',
          isCorrect: false,
          explanation: 'Diminui a exposição no tempo, mas os valores continuam visíveis.',
        },
        {
          text: 'Habilitar o Amazon Macie no log group.',
          isCorrect: false,
          explanation: 'O Macie analisa objetos no S3, não log groups do CloudWatch Logs.',
        },
      ],
    },
    {
      prompt: 'Em qual situação um parâmetro do Parameter Store precisa usar o nível Advanced em vez do Standard?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'O nível Advanced é necessário para valores acima de 4 KB (até 8 KB), para mais de 10.000 parâmetros por conta e região, ou para usar parameter policies (como expiração).',
      options: [
        {
          text: 'Quando o valor passa de 4 KB ou quando se quer uma parameter policy de expiração.',
          isCorrect: true,
          explanation: 'Correto: são limitações do nível Standard.',
        },
        {
          text: 'Sempre que o parâmetro for do tipo SecureString.',
          isCorrect: false,
          explanation: 'SecureString funciona no nível Standard.',
        },
        {
          text: 'Quando o parâmetro é lido por uma função Lambda.',
          isCorrect: false,
          explanation: 'O nível não tem relação com quem lê o parâmetro.',
        },
        {
          text: 'Quando o parâmetro faz parte de uma hierarquia.',
          isCorrect: false,
          explanation: 'Hierarquias funcionam nos dois níveis.',
        },
      ],
    },
  ];

  await seedQuestions(sensitiveDataTopic.id, sensitiveDataQuestionsToSeed);

  const sensitiveDataFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Secrets Manager vs. Parameter Store',
      conceptDescription: 'Critérios de escolha entre os dois serviços para guardar segredos.',
      serviceId: secretsManagerService.id,
      front: 'Quando usar o Secrets Manager e quando usar o Parameter Store?',
      back: 'Secrets Manager: rotação automática (ex.: senhas de RDS), replicação entre regiões, até 64 KB, pago. Parameter Store: configurações e segredos sem rotação, hierarquias, nível Standard gratuito.',
    },
    {
      conceptName: 'SecureString',
      conceptDescription: 'Tipo de parâmetro do Parameter Store criptografado com o KMS.',
      serviceId: systemsManagerService.id,
      front: 'O que é preciso para ler um SecureString em claro?',
      back: 'Chamar com --with-decryption (WithDecryption=true) e ter ssm:GetParameter no parâmetro e kms:Decrypt na chave usada.',
    },
    {
      conceptName: 'Níveis do Parameter Store',
      conceptDescription: 'Diferenças entre os níveis Standard e Advanced.',
      serviceId: systemsManagerService.id,
      front: 'Quais as diferenças entre os níveis Standard e Advanced do Parameter Store?',
      back: 'Standard: gratuito, até 10.000 parâmetros, 4 KB, sem parameter policies. Advanced: pago, até 100.000 parâmetros, 8 KB, com parameter policies (ex.: expiração).',
    },
    {
      conceptName: 'GetParametersByPath',
      conceptDescription: 'Leitura de uma hierarquia de parâmetros numa chamada.',
      serviceId: systemsManagerService.id,
      front: 'Como ler toda a configuração de /app/prod do Parameter Store numa chamada?',
      back: 'GetParametersByPath com Path=/app/prod, Recursive=true e WithDecryption=true (paginando, se houver muitos parâmetros).',
    },
    {
      conceptName: 'Staging labels do Secrets Manager',
      conceptDescription: 'Rótulos que marcam as versões de um segredo durante a rotação.',
      serviceId: secretsManagerService.id,
      front: 'O que significam AWSCURRENT, AWSPENDING e AWSPREVIOUS?',
      back: 'AWSCURRENT: versão atual (padrão do GetSecretValue). AWSPENDING: versão em criação durante a rotação. AWSPREVIOUS: versão anterior, útil para rollback.',
    },
    {
      conceptName: 'Variáveis de ambiente do Lambda e segredos',
      conceptDescription: 'Proteção das variáveis de ambiente do Lambda e seus limites para segredos.',
      serviceId: lambdaService.id,
      front: 'Por que não guardar segredos diretamente em variáveis de ambiente do Lambda?',
      back: 'Elas são criptografadas em repouso (aws/lambda), mas quem vê a configuração da função vê os valores. Guarde na variável só o nome do segredo e busque o valor no Secrets Manager/Parameter Store.',
    },
    {
      conceptName: 'Cache de segredos no Lambda',
      conceptDescription: 'Reutilização de segredos entre invocações para reduzir latência e custo.',
      serviceId: lambdaService.id,
      front: 'Como evitar chamar o Secrets Manager a cada invocação de uma função Lambda?',
      back: 'Cache fora do handler (sobrevive entre invocações warm) ou a AWS Parameters and Secrets Lambda Extension, que expõe um endpoint local (porta 2773) com cache e TTL.',
    },
    {
      conceptName: 'Dynamic references do CloudFormation',
      conceptDescription: 'Resolução de segredos e parâmetros no momento do deploy.',
      serviceId: secretsManagerService.id,
      front: 'Como usar um segredo do Secrets Manager num template do CloudFormation sem expô-lo?',
      back: 'Com uma dynamic reference: {{resolve:secretsmanager:nome:SecretString:chave}} (ou {{resolve:ssm-secure:/caminho}} para SecureString).',
    },
    {
      conceptName: 'Amazon Macie',
      conceptDescription: 'Serviço de descoberta de dados sensíveis no S3.',
      serviceId: macieService.id,
      front: 'Qual serviço encontra PII armazenada em buckets S3?',
      back: 'O Amazon Macie, que analisa objetos com machine learning e identificadores de dados e gera findings por bucket e objeto.',
    },
    {
      conceptName: 'Data protection policies do CloudWatch Logs',
      conceptDescription: 'Mascaramento de dados sensíveis em log groups.',
      serviceId: cloudWatchService.id,
      front: 'Como mascarar e-mails e números de cartão que aparecem no CloudWatch Logs?',
      back: 'Com uma data protection policy no log group: os valores sensíveis são mascarados, e só principais com logs:Unmask veem os originais.',
    },
  ];

  await seedFlashcards(sensitiveDataTopic.id, sensitiveDataFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 6 of 12: Domain 3 "Preparação de
  // artefatos de deploy", to the exam-readiness bar.
  // ---------------------------------------------------------------------

  const deploymentDomain = await prisma.domain.findUniqueOrThrow({
    where: { examVersionId_code: { examVersionId: examVersion.id, code: 'domain-3' } },
  });
  const artifactsTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: deploymentDomain.id, name: 'Preparação de artefatos de deploy' },
  });

  const cloudFormationServiceData = {
    shortName: 'CloudFormation',
    category: 'Management & Governance',
    description:
      'Provisiona infraestrutura como código a partir de templates; o AWS SAM é uma extensão dele para aplicações serverless.',
  };
  const cloudFormationService = await prisma.aWSService.upsert({
    where: { name: 'AWS CloudFormation' },
    update: cloudFormationServiceData,
    create: { name: 'AWS CloudFormation', ...cloudFormationServiceData },
  });

  const ecrServiceData = {
    shortName: 'ECR',
    category: 'Containers',
    description: 'Registro gerenciado de imagens de container, usado por ECS, EKS e funções Lambda empacotadas como imagem.',
  };
  const ecrService = await prisma.aWSService.upsert({
    where: { name: 'Amazon Elastic Container Registry' },
    update: ecrServiceData,
    create: { name: 'Amazon Elastic Container Registry', ...ecrServiceData },
  });

  const beanstalkServiceData = {
    shortName: 'Elastic Beanstalk',
    category: 'Compute',
    description:
      'Plataforma que faz deploy e gerencia a infraestrutura de aplicações web a partir de um pacote de código (source bundle).',
  };
  const beanstalkService = await prisma.aWSService.upsert({
    where: { name: 'AWS Elastic Beanstalk' },
    update: beanstalkServiceData,
    create: { name: 'AWS Elastic Beanstalk', ...beanstalkServiceData },
  });

  const appConfigServiceData = {
    shortName: 'AppConfig',
    category: 'Management & Governance',
    description:
      'Gerencia e publica configurações e feature flags com validação, deploy gradual e rollback automático, sem redeploy do código.',
  };
  const appConfigService = await prisma.aWSService.upsert({
    where: { name: 'AWS AppConfig' },
    update: appConfigServiceData,
    create: { name: 'AWS AppConfig', ...appConfigServiceData },
  });

  const lambdaPackagingLessonContent = `## Objetivo

Ao final desta lição você vai conseguir montar um pacote de deploy do Lambda corretamente, decidir entre pacote .zip, layers e imagem de container, e evitar os erros clássicos de dependências e limites que a prova DVA-C02 cobra.

## O pacote .zip

Um pacote .zip contém o código da função e as dependências que não vêm no runtime. O handler precisa estar no caminho que a configuração aponta (ex.: \`lambda_function.lambda_handler\` → arquivo \`lambda_function.py\` na raiz do zip). Em Python, as bibliotecas são instaladas ao lado do código (\`pip install -r requirements.txt -t .\`); em Node.js, a pasta \`node_modules\` vai junto. O SDK da AWS já vem nos runtimes gerenciados, mas fixar a sua própria versão dentro do pacote evita surpresas quando o runtime é atualizado.

Os limites que mais aparecem na prova:

- **50 MB** para um .zip enviado diretamente pela API/Console; acima disso (até o limite descompactado), o pacote é enviado via S3.
- **250 MB descompactados**, somando o código da função e todas as suas layers.
- **4 KB** no total de variáveis de ambiente.
- Memória de **128 MB a 10.240 MB** — e a CPU é alocada proporcionalmente à memória (por volta de 1.769 MB a função recebe o equivalente a 1 vCPU), então aumentar a memória também acelera código limitado por CPU.
- \`/tmp\` (armazenamento efêmero) de **512 MB a 10.240 MB**.

## Dependências nativas

Bibliotecas com partes compiladas (ex.: bibliotecas de criptografia, processamento de imagem, drivers de banco) precisam ser compiladas para o sistema do Lambda — Amazon Linux — e para a arquitetura da função (\`x86_64\` ou \`arm64\`), e para a versão exata do runtime. Um pacote montado no Windows ou no macOS costuma falhar com erros de import ou "invalid ELF header". As saídas: construir o pacote num ambiente Amazon Linux (ou num container, como faz \`sam build --use-container\`), ou pedir ao pip as wheels certas com \`--platform manylinux2014_x86_64 --python-version 3.13 --only-binary=:all:\`.

## Layers

Uma layer é um .zip com bibliotecas, runtimes customizados ou arquivos de configuração que várias funções podem compartilhar. Ela é extraída em \`/opt\` no ambiente de execução, e cada runtime procura bibliotecas num subcaminho específico — para Python, o zip precisa ter a pasta \`python/\` na raiz (vira \`/opt/python\`); para Node.js, \`nodejs/node_modules/\`. Pontos importantes:

- Uma função pode usar **até 5 layers**, e o limite de 250 MB descompactados inclui todas elas.
- Cada publicação cria uma **versão imutável** (\`...:layer:minha-layer:3\`). A função referencia uma versão específica; publicar uma versão nova não altera nenhuma função até que a configuração dela seja atualizada.
- Layers diminuem o pacote de cada função (deploys mais rápidos, e o código continua editável no Console) e centralizam dependências comuns.

## Imagens de container

Funções também podem ser empacotadas como imagens de container de **até 10 GB**, guardadas no Amazon ECR. É a escolha para dependências grandes (ex.: bibliotecas de machine learning) que estouram os 250 MB, ou para times que já padronizaram o build em containers. A imagem parte de uma imagem base da AWS para o runtime (ou de uma imagem própria com o runtime interface client) e é construída com um Dockerfile. Funções empacotadas como imagem **não usam layers** — as dependências vão dentro da própria imagem. Boas práticas no ECR: tags imutáveis e versionadas (em vez de sempre \`latest\`) e varredura de vulnerabilidades das imagens.

## Relação com a prova DVA-C02

Espere cenários sobre os limites de 50 MB/250 MB/10 GB, quando usar layers vs. imagem de container, a estrutura de pastas de uma layer, versões imutáveis de layers, erros de dependências nativas, e a relação entre memória e CPU no Lambda.`;

  const packagingConfigLessonContent = `## Objetivo

Ao final desta lição você vai conseguir organizar um projeto serverless com o AWS SAM, entender o que \`package\` e \`deploy\` fazem com os artefatos, preparar um source bundle do Elastic Beanstalk e separar configuração de código.

## Configuração separada do código

O mesmo artefato deve ser promovido entre ambientes (dev, homologação, produção) sem ser reconstruído — o que muda entre eles é a configuração. As opções, da mais simples à mais controlada:

- **Variáveis de ambiente** — valores simples por função, definidos no template ou na configuração.
- **Parameter Store / Secrets Manager** — configurações compartilhadas e segredos, lidos em tempo de execução (ver o tópico de dados sensíveis).
- **AWS AppConfig** — configurações e feature flags que mudam com frequência sem redeploy do código: valida a configuração antes de publicar (JSON Schema ou uma função Lambda), faz o deploy gradual segundo uma estratégia (ex.: 10% a cada minuto) e faz rollback automático se um alarme do CloudWatch disparar.

## Estrutura de um projeto SAM

Um projeto do AWS SAM costuma ter um \`template.yaml\` na raiz, uma pasta por função (ex.: \`hello_world/\` com \`app.py\` e \`requirements.txt\`), \`events/\` com eventos de teste e \`tests/\`. O template começa com \`Transform: AWS::Serverless-2016-10-31\`, que faz o CloudFormation expandir recursos simplificados (\`AWS::Serverless::Function\`, \`AWS::Serverless::Api\`, \`AWS::Serverless::SimpleTable\`, \`AWS::Serverless::LayerVersion\`) em recursos completos. A seção \`Globals\` define propriedades comuns a todas as funções (runtime, timeout, memória, variáveis de ambiente). \`CodeUri\` aponta para a pasta local do código de cada função.

## Do código local ao artefato no S3

O CloudFormation não lê arquivos do seu computador: todo código referenciado precisa estar no S3 (ou no ECR, para imagens). Por isso existe o passo de empacotamento:

- \`aws cloudformation package\` (ou \`sam package\`) compacta cada caminho local (\`CodeUri\`, \`ContentUri\` etc.), envia para um bucket S3 e gera um novo template com esses caminhos trocados por URIs \`s3://\`.
- \`aws cloudformation deploy\` cria um change set com o template empacotado e o executa. Templates que criam roles do IAM exigem \`--capabilities CAPABILITY_IAM\` (ou \`CAPABILITY_NAMED_IAM\`, com nomes fixos), e templates com transforms usam \`CAPABILITY_AUTO_EXPAND\`.
- Com o SAM CLI, \`sam build\` instala as dependências de cada função (opcionalmente dentro de um container compatível com o Lambda, com \`--use-container\`) e \`sam deploy\` faz o package e o deploy juntos (\`--guided\` salva as escolhas em \`samconfig.toml\`).

## Source bundle do Elastic Beanstalk

No Elastic Beanstalk, o artefato é um source bundle: um único arquivo .zip (ou .war) de **até 500 MB**, **sem uma pasta-pai** envolvendo o conteúdo — os arquivos da aplicação ficam na raiz do zip. Junto do código podem ir: arquivos \`.config\` (YAML ou JSON) em \`.ebextensions/\` para instalar pacotes, criar arquivos, rodar comandos e definir opções do ambiente; um \`Procfile\` com o comando que inicia a aplicação; e hooks em \`.platform/\` para plataformas baseadas em Amazon Linux 2 ou mais recentes. Cada deploy cria uma application version guardada no S3.

## Relação com a prova DVA-C02

Espere cenários sobre o que \`cloudformation package\` faz, a estrutura de um template SAM (\`Transform\`, \`Globals\`, \`CodeUri\`), capabilities exigidas no deploy, \`.ebextensions\` e as regras do source bundle, e AppConfig para feature flags com deploy gradual e rollback.`;

  const artifactsLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 12,
      title: 'Pacotes de deploy do Lambda: zip, layers e imagens de container',
      content: lambdaPackagingLessonContent,
      resources: [
        {
          title: 'Pacotes de deploy do Lambda (.zip) — documentação oficial',
          url: 'https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-zip.html',
        },
        {
          title: 'Layers do Lambda — documentação oficial',
          url: 'https://docs.aws.amazon.com/lambda/latest/dg/chapter-layers.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 11,
      title: 'Empacotamento e configuração: SAM, CloudFormation, Elastic Beanstalk e AppConfig',
      content: packagingConfigLessonContent,
      resources: [
        {
          title: 'AWS SAM — documentação oficial',
          url: 'https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html',
        },
        {
          title: 'Source bundle do Elastic Beanstalk — documentação oficial',
          url: 'https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/applications-sourcebundle.html',
        },
      ],
    },
  ];

  await seedLessons(artifactsTopic.id, artifactsLessons);

  const layerBuildInstructions = `No AWS CloudShell, instale a biblioteca \`requests\` numa pasta \`python/\` (o caminho que o runtime Python procura dentro de \`/opt\`), pedindo ao pip as wheels do Lambda — Linux x86_64, Python 3.13 — e não as do próprio CloudShell:

\`\`\`bash
mkdir -p camada/python
pip3 install requests -t camada/python --platform manylinux2014_x86_64 --python-version 3.13 --implementation cp --only-binary=:all:
cd camada && zip -r ../camada.zip python && cd ..
unzip -l camada.zip | head
\`\`\``;

  const layerFunctionCode = `No Console do Lambda, crie a função \`devlab-com-camada\` com o runtime **Python 3.13** e arquitetura **x86_64** (os mesmos da layer). Em "Code", substitua \`lambda_function.py\` por:

\`\`\`python
import requests


def lambda_handler(event, context):
    resposta = requests.get("https://checkip.amazonaws.com", timeout=5)
    return {"status": resposta.status_code, "ip": resposta.text.strip()}
\`\`\`

Clique em "Deploy" e execute um teste com o evento padrão.`;

  const samProjectInstructions = `Crie a estrutura do projeto: uma pasta de código e um template SAM na raiz.

\`\`\`bash
mkdir -p devlab-sam/src && cd devlab-sam
cat > src/app.py <<'FIM'
import os


def handler(event, context):
    return {"mensagem": "ola do pacote", "ambiente": os.environ["AMBIENTE"]}
FIM
cat > template.yaml <<'FIM'
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Lab DevLab - empacotamento com SAM

Globals:
  Function:
    Runtime: python3.13
    Timeout: 10
    MemorySize: 256

Resources:
  DevlabFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: devlab-empacotada
      CodeUri: src/
      Handler: app.handler
      Environment:
        Variables:
          AMBIENTE: dev
FIM
\`\`\``;

  const artifactsLabs: LabSeed[] = [
    {
      title: 'Criar uma layer do Lambda com dependências do runtime certo',
      data: {
        level: 2,
        order: 1,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá empacotado uma biblioteca Python como layer do Lambda com a estrutura de pastas correta e as wheels do runtime certo, visto a função falhar sem a layer e funcionar com ela, e publicado uma segunda versão da layer para entender que versões são imutáveis.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido a lição "Pacotes de deploy do Lambda: zip, layers e imagens de container" ajuda.',
        context:
          'Várias funções de um time usam a biblioteca `requests`, e cada uma a empacota junto do próprio código — os pacotes cresceram e não dá mais para editar o código no Console. O time decidiu mover a dependência para uma layer compartilhada.',
        troubleshooting:
          '"No matching distribution found" no pip: confira se todos os parâmetros (`--platform`, `--python-version`, `--implementation`, `--only-binary`) foram copiados — eles só funcionam juntos com `-t`. \n\n`Runtime.ImportModuleError: No module named \'requests\'` mesmo com a layer: confira se o zip tem `python/` na raiz (`unzip -l camada.zip`) e se a função usa Python 3.13, a mesma versão da layer. \n\nA layer não aparece em "Custom layers": a lista mostra só layers compatíveis com o runtime e a arquitetura da função — confira se a função é Python 3.13 e x86_64.',
        cleanup:
          'Exclua a função `devlab-com-camada` (e seu log group `/aws/lambda/devlab-com-camada`, se quiser). No CloudShell, exclua as duas versões da layer: `aws lambda delete-layer-version --layer-name devlab-requests --version-number 1` e o mesmo com `--version-number 2`.',
        costWarning:
          'Layers não têm custo próprio além do armazenamento de código do Lambda (gratuito em pequenas quantidades), e as invocações ficam dentro do Free Tier.',
      },
      steps: [
        {
          order: 1,
          title: 'Montar o zip da layer',
          instructions: layerBuildInstructions,
          validation:
            'A listagem do zip mostra caminhos começando com `python/` (ex.: `python/requests/__init__.py`) — é essa pasta que vira `/opt/python` na função.',
        },
        {
          order: 2,
          title: 'Publicar a layer',
          instructions:
            'Rode:\n\n```bash\naws lambda publish-layer-version --layer-name devlab-requests --zip-file fileb://camada.zip --compatible-runtimes python3.13 --compatible-architectures x86_64\n```',
          validation: 'A resposta traz um `LayerVersionArn` terminando em `:devlab-requests:1` e `Version` igual a 1.',
        },
        {
          order: 3,
          title: 'Criar a função e testar sem a layer',
          instructions: layerFunctionCode,
          validation:
            'O teste falha com `Runtime.ImportModuleError` ("No module named \'requests\'"): a biblioteca não está no runtime nem no pacote da função.',
        },
        {
          order: 4,
          title: 'Adicionar a layer e testar de novo',
          instructions:
            'Na página da função, em "Layers", clique em "Add a layer", escolha "Custom layers", selecione `devlab-requests` e a versão 1. Execute o teste de novo.',
          validation:
            'O teste devolve `status` 200 e um endereço IP. Em "Code properties", o tamanho do pacote da função continua de poucos KB — a dependência está na layer, não no código.',
        },
        {
          order: 5,
          title: 'Publicar uma nova versão da layer',
          instructions:
            'No CloudShell, publique o mesmo zip de novo (repita o comando do passo 2) e depois liste as versões com `aws lambda list-layer-versions --layer-name devlab-requests --query "LayerVersions[].Version"`. Volte à função e veja qual versão ela usa.',
          validation:
            'Existem as versões 1 e 2, mas a função continua usando a versão 1: versões de layer são imutáveis, e a função só passa a usar a nova quando a configuração dela for atualizada.',
        },
      ],
    },
    {
      title: 'Empacotar e publicar uma função com um template SAM',
      data: {
        level: 2,
        order: 2,
        estimatedMinutes: 30,
        objective:
          'Ao final deste laboratório você terá organizado um projeto serverless com um template SAM, visto o comando `aws cloudformation package` enviar o código ao S3 e reescrever o template, e publicado a função com `aws cloudformation deploy`.',
        prerequisites:
          'Conta AWS com acesso ao AWS CloudShell. Ter lido a lição "Empacotamento e configuração: SAM, CloudFormation, Elastic Beanstalk e AppConfig" ajuda.',
        context:
          'Um time cria funções Lambda pelo Console, e ninguém sabe dizer qual configuração está em produção. A decisão é passar a descrever tudo num template SAM versionado junto do código. Antes de adotar o SAM CLI e um pipeline, você vai entender o que acontece com o código local no caminho até a AWS.',
        troubleshooting:
          '"Unable to upload artifact src/ referenced by CodeUri": rode o `package` de dentro da pasta `devlab-sam`, onde está a pasta `src/`. \n\n"Requires capabilities": o deploy precisa de `--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND`, porque o SAM cria uma role do IAM para a função. \n\nA stack fica em `ROLLBACK_COMPLETE`: veja a causa com `aws cloudformation describe-stack-events --stack-name devlab-empacotada --max-items 10`, exclua a stack e faça o deploy de novo. \n\nO heredoc não terminou (o terminal continua esperando): a linha `FIM` precisa estar sozinha e sem espaços antes.',
        cleanup:
          'No CloudShell, rode `aws cloudformation delete-stack --stack-name devlab-empacotada` (remove a função e a role) e `aws s3 rb s3://NOME-DO-BUCKET --force` (remove o bucket de artefatos e seu conteúdo).',
        costWarning:
          'A stack cria só uma função Lambda e uma role; as invocações e os poucos KB no S3 ficam dentro do Free Tier. O CloudFormation em si não cobra nada: você paga só pelos recursos que a stack cria.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar o bucket de artefatos',
          instructions:
            'No AWS CloudShell, crie um bucket para os artefatos de deploy, com um nome único:\n\n```bash\naws s3 mb s3://devlab-artefatos-SUAS-INICIAIS-DATA\n```\n\nNos próximos passos, `NOME-DO-BUCKET` é esse nome.',
          validation: 'O comando responde `make_bucket: devlab-artefatos-...`.',
        },
        {
          order: 2,
          title: 'Criar o projeto',
          instructions: samProjectInstructions,
          validation:
            '`find .` dentro de `devlab-sam` mostra `./template.yaml` e `./src/app.py` — o template na raiz e o código na pasta que o `CodeUri` aponta.',
        },
        {
          order: 3,
          title: 'Empacotar',
          instructions:
            'Ainda em `devlab-sam`, rode:\n\n```bash\naws cloudformation package --template-file template.yaml --s3-bucket NOME-DO-BUCKET --output-template-file packaged.yaml\ncat packaged.yaml\n```',
          validation:
            'No `packaged.yaml`, o `CodeUri` deixou de ser `src/` e virou `s3://NOME-DO-BUCKET/...` — o `package` compactou a pasta, enviou ao S3 e reescreveu o template. O `template.yaml` original não mudou.',
        },
        {
          order: 4,
          title: 'Publicar',
          instructions:
            'Rode:\n\n```bash\naws cloudformation deploy --template-file packaged.yaml --stack-name devlab-empacotada --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND\n```',
          validation:
            'O comando termina com "Successfully created/updated stack - devlab-empacotada". No Console do CloudFormation, a stack mostra na aba "Resources" a função e uma role criadas a partir do `AWS::Serverless::Function`.',
        },
        {
          order: 5,
          title: 'Invocar a função',
          instructions:
            'Rode:\n\n```bash\naws lambda invoke --function-name devlab-empacotada resposta.json && cat resposta.json\n```',
          validation:
            'A resposta é `{"mensagem": "ola do pacote", "ambiente": "dev"}` — o valor da variável de ambiente veio do template, não do código.',
        },
      ],
    },
  ];

  await seedLabs(artifactsTopic.id, artifactsLabs);

  const artifactsQuestionsToSeed: QuestionSeed[] = [
    {
      prompt:
        'Qual é o tamanho máximo, descompactado, do código de uma função Lambda empacotada como .zip, somando todas as suas layers?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'O limite descompactado é de 250 MB, incluindo a função e todas as layers. O upload direto de um .zip é limitado a 50 MB (acima disso, via S3). Para mais que 250 MB, usa-se uma imagem de container (até 10 GB).',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html',
      options: [
        { text: '250 MB', isCorrect: true, explanation: 'Correto: função + layers, descompactados.' },
        { text: '50 MB', isCorrect: false, explanation: 'É o limite de upload direto do .zip compactado.' },
        { text: '10 GB', isCorrect: false, explanation: 'É o limite de uma imagem de container.' },
        { text: '512 MB', isCorrect: false, explanation: 'É o tamanho padrão do /tmp, não do pacote.' },
      ],
    },
    {
      prompt: 'Quantas layers uma única função Lambda pode usar?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation: 'Uma função pode referenciar até 5 layers, e o total descompactado (função + layers) continua limitado a 250 MB.',
      options: [
        { text: '5', isCorrect: true, explanation: 'Correto.' },
        { text: '1', isCorrect: false, explanation: 'É possível combinar várias layers.' },
        { text: '10', isCorrect: false, explanation: 'O limite é 5.' },
        { text: 'Ilimitadas, desde que caibam em 250 MB.', isCorrect: false, explanation: 'Há um limite de quantidade: 5.' },
      ],
    },
    {
      prompt: 'O que acontece com a CPU disponível para uma função Lambda quando a memória configurada aumenta?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'O Lambda aloca CPU proporcionalmente à memória configurada (por volta de 1.769 MB a função recebe o equivalente a 1 vCPU). Aumentar a memória também acelera código limitado por CPU.',
      options: [
        {
          text: 'Aumenta proporcionalmente à memória.',
          isCorrect: true,
          explanation: 'Correto: memória é o único controle de CPU no Lambda.',
        },
        { text: 'Não muda; CPU é configurada separadamente.', isCorrect: false, explanation: 'Não existe configuração separada de CPU no Lambda.' },
        { text: 'Diminui, para compensar o custo.', isCorrect: false, explanation: 'Mais memória significa mais CPU, não menos.' },
        { text: 'Só muda em funções empacotadas como imagem de container.', isCorrect: false, explanation: 'A regra vale para qualquer tipo de pacote.' },
      ],
    },
    {
      prompt:
        'Um desenvolvedor cria uma layer com uma biblioteca Python. Qual deve ser a estrutura do arquivo .zip para que a função consiga importar a biblioteca?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'A layer é extraída em /opt, e o runtime Python procura bibliotecas em /opt/python. Por isso a biblioteca precisa estar dentro de uma pasta python/ na raiz do zip.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/packaging-layers.html',
      options: [
        {
          text: 'A biblioteca dentro de uma pasta python/ na raiz do zip.',
          isCorrect: true,
          explanation: 'Correto: vira /opt/python, que está no caminho de import.',
        },
        {
          text: 'A biblioteca solta na raiz do zip.',
          isCorrect: false,
          explanation: 'Iria para /opt, que não está no caminho de import do Python.',
        },
        {
          text: 'A biblioteca dentro de uma pasta lib/ na raiz do zip.',
          isCorrect: false,
          explanation: 'Esse caminho não é procurado pelo runtime Python.',
        },
        {
          text: 'A estrutura não importa; o Lambda encontra a biblioteca automaticamente.',
          isCorrect: false,
          explanation: 'O runtime só procura em caminhos específicos de /opt.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda em Python depende de uma biblioteca com código compilado. O pacote, montado no notebook Windows do desenvolvedor, falha ao importar a biblioteca no Lambda. Qual é a correção?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Partes compiladas precisam ser construídas para Amazon Linux, para a arquitetura da função e para a versão do runtime. Construir num ambiente compatível (container ou Amazon Linux, como sam build --use-container) ou baixar as wheels certas (pip --platform manylinux...) resolve.',
      options: [
        {
          text: 'Montar o pacote num ambiente compatível com o Lambda (ex.: sam build --use-container) ou baixar as wheels para a plataforma e a versão do runtime.',
          isCorrect: true,
          explanation: 'Correto: o binário precisa bater com o sistema, a arquitetura e o runtime do Lambda.',
        },
        { text: 'Aumentar a memória da função.', isCorrect: false, explanation: 'O problema é de compatibilidade do binário, não de recursos.' },
        { text: 'Mover a biblioteca para uma layer, sem recompilar.', isCorrect: false, explanation: 'O binário continuaria incompatível dentro da layer.' },
        { text: 'Trocar o handler para o formato do Windows.', isCorrect: false, explanation: 'O Lambda roda em Amazon Linux; não existe formato Windows.' },
      ],
    },
    {
      prompt:
        'Doze funções Lambda de um time empacotam as mesmas bibliotecas de acesso a dados. Os pacotes cresceram, os deploys ficaram lentos e o código não pode mais ser editado no Console. Qual é a melhor solução?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Uma layer com as bibliotecas compartilhadas reduz o pacote de cada função, acelera os deploys e centraliza a versão das dependências.',
      options: [
        {
          text: 'Mover as bibliotecas comuns para uma layer usada pelas doze funções.',
          isCorrect: true,
          explanation: 'Correto: é o caso de uso típico de layers.',
        },
        {
          text: 'Juntar as doze funções numa só.',
          isCorrect: false,
          explanation: 'Mistura responsabilidades e não resolve o compartilhamento de dependências.',
        },
        {
          text: 'Aumentar o limite de tamanho do pacote pelo suporte.',
          isCorrect: false,
          explanation: 'O limite de 250 MB não é ajustável, e o problema é duplicação.',
        },
        {
          text: 'Guardar as bibliotecas no /tmp em tempo de execução.',
          isCorrect: false,
          explanation: 'Baixar bibliotecas a cada cold start aumenta a latência e a complexidade.',
        },
      ],
    },
    {
      prompt:
        'Uma função de inferência de machine learning precisa de bibliotecas que somam 3 GB. Qual forma de empacotamento do Lambda comporta isso?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Imagens de container podem ter até 10 GB e são guardadas no Amazon ECR. Pacotes .zip, mesmo com layers, são limitados a 250 MB descompactados.',
      options: [
        {
          text: 'Imagem de container armazenada no Amazon ECR.',
          isCorrect: true,
          explanation: 'Correto: até 10 GB.',
        },
        { text: 'Pacote .zip enviado via S3.', isCorrect: false, explanation: 'O S3 só evita o limite de upload de 50 MB; os 250 MB descompactados continuam valendo.' },
        { text: 'Cinco layers de 600 MB cada.', isCorrect: false, explanation: 'Layers contam no mesmo limite de 250 MB descompactados.' },
        { text: 'Pacote .zip com as bibliotecas compactadas em nível máximo.', isCorrect: false, explanation: 'O limite é sobre o tamanho descompactado.' },
      ],
    },
    {
      prompt: 'O que o comando aws cloudformation package faz com um template que referencia código local em CodeUri?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'O package compacta cada caminho local referenciado, envia os artefatos para um bucket S3 e gera um novo template com os caminhos trocados pelas URIs do S3. Quem cria os recursos é o deploy.',
      officialReferences: 'https://docs.aws.amazon.com/cli/latest/reference/cloudformation/package.html',
      options: [
        {
          text: 'Envia o código local para o S3 e gera um novo template apontando para as URIs do S3.',
          isCorrect: true,
          explanation: 'Correto: o CloudFormation só consegue usar artefatos que estão no S3 (ou no ECR).',
        },
        { text: 'Cria a stack e os recursos na conta.', isCorrect: false, explanation: 'Isso é o deploy (ou create-stack).' },
        { text: 'Valida a sintaxe do template sem enviar nada.', isCorrect: false, explanation: 'Isso é o validate-template.' },
        { text: 'Instala as dependências de cada função.', isCorrect: false, explanation: 'Isso é o sam build; o package só empacota o que já está na pasta.' },
      ],
    },
    {
      prompt:
        'Uma aplicação no Elastic Beanstalk precisa instalar um pacote do sistema operacional e definir variáveis de ambiente em cada deploy, com essa configuração versionada junto do código. Onde colocar essa configuração?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'Arquivos .config (YAML ou JSON) na pasta .ebextensions/, na raiz do source bundle, permitem instalar pacotes, criar arquivos, rodar comandos e definir option settings (incluindo variáveis de ambiente) em cada deploy.',
      officialReferences: 'https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/ebextensions.html',
      options: [
        {
          text: 'Em arquivos .config na pasta .ebextensions/ na raiz do source bundle.',
          isCorrect: true,
          explanation: 'Correto: é o mecanismo de configuração versionada do Elastic Beanstalk.',
        },
        {
          text: 'Num buildspec.yml na raiz do projeto.',
          isCorrect: false,
          explanation: 'O buildspec é do CodeBuild, não do Elastic Beanstalk.',
        },
        {
          text: 'Num appspec.yml na raiz do projeto.',
          isCorrect: false,
          explanation: 'O appspec é do CodeDeploy.',
        },
        {
          text: 'Configurando cada instância manualmente por SSH.',
          isCorrect: false,
          explanation: 'Não é versionado e se perde quando instâncias são substituídas.',
        },
      ],
    },
    {
      prompt: 'Qual regra um source bundle do Elastic Beanstalk precisa seguir?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'O source bundle é um único .zip ou .war de até 500 MB, sem uma pasta-pai de nível superior envolvendo o conteúdo — os arquivos da aplicação ficam na raiz.',
      options: [
        {
          text: 'Um único .zip ou .war de até 500 MB, sem uma pasta-pai envolvendo os arquivos.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Um .zip com todos os arquivos dentro de uma pasta com o nome da aplicação.',
          isCorrect: false,
          explanation: 'Uma pasta-pai de nível superior não é permitida.',
        },
        {
          text: 'Vários arquivos .zip, um por componente da aplicação.',
          isCorrect: false,
          explanation: 'O bundle é um único arquivo.',
        },
        {
          text: 'Uma imagem de container de até 10 GB.',
          isCorrect: false,
          explanation: 'Esse é o limite de imagens para o Lambda.',
        },
      ],
    },
    {
      prompt:
        'Um time quer ligar e desligar funcionalidades (feature flags) em produção sem novo deploy do código, com validação da configuração, liberação gradual e rollback automático se um alarme do CloudWatch disparar. Qual serviço atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'O AWS AppConfig valida configurações (JSON Schema ou função Lambda), publica segundo uma estratégia de deploy gradual e faz rollback automático quando um alarme do CloudWatch associado dispara.',
      officialReferences: 'https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html',
      options: [
        { text: 'AWS AppConfig', isCorrect: true, explanation: 'Correto: validação, deploy gradual e rollback são o propósito dele.' },
        {
          text: 'Variáveis de ambiente do Lambda',
          isCorrect: false,
          explanation: 'Mudá-las altera a configuração da função de uma vez, sem validação nem liberação gradual.',
        },
        {
          text: 'Parameter Store',
          isCorrect: false,
          explanation: 'Guarda valores, mas não faz deploy gradual nem rollback por alarme.',
        },
        {
          text: 'Um arquivo de configuração dentro do pacote de deploy',
          isCorrect: false,
          explanation: 'Mudar o arquivo exige novo deploy do código.',
        },
      ],
    },
    {
      prompt:
        'Um desenvolvedor publica uma versão nova de uma layer com uma correção, mas as funções que usam a layer continuam com o comportamento antigo. Por quê?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Versões de layer são imutáveis e cada função referencia um ARN de versão específico. Publicar a versão nova não altera nenhuma função; é preciso atualizar a configuração de cada função para o novo ARN.',
      options: [
        {
          text: 'Cada função referencia uma versão específica e imutável da layer; é preciso atualizar as funções para a nova versão.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'O Lambda leva até 24 horas para propagar versões novas de layers.',
          isCorrect: false,
          explanation: 'Não há propagação automática; a função nunca muda de versão sozinha.',
        },
        {
          text: 'A layer nova precisa ter o mesmo tamanho da anterior.',
          isCorrect: false,
          explanation: 'Tamanho não tem relação com isso.',
        },
        {
          text: 'As funções estão em cache no CloudFront.',
          isCorrect: false,
          explanation: 'O CloudFront não participa da execução de funções Lambda.',
        },
      ],
    },
    {
      prompt:
        'Uma função Lambda foi migrada de pacote .zip para imagem de container. O time quer continuar usando a layer de monitoramento que as outras funções usam. Qual é a abordagem correta?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'Funções empacotadas como imagem de container não usam layers. O conteúdo da layer precisa ser copiado para dentro da imagem durante o build (ex.: no Dockerfile).',
      options: [
        {
          text: 'Incluir o conteúdo da layer dentro da imagem no build (ex.: pelo Dockerfile).',
          isCorrect: true,
          explanation: 'Correto: com imagem, tudo vai dentro da imagem.',
        },
        {
          text: 'Adicionar a layer na configuração da função, como nas funções .zip.',
          isCorrect: false,
          explanation: 'Funções de imagem de container não aceitam layers.',
        },
        {
          text: 'Publicar a layer no ECR.',
          isCorrect: false,
          explanation: 'Layers não são publicadas no ECR.',
        },
        {
          text: 'Não é possível monitorar funções de imagem de container.',
          isCorrect: false,
          explanation: 'É possível; só não por layer.',
        },
      ],
    },
  ];

  await seedQuestions(artifactsTopic.id, artifactsQuestionsToSeed);

  const artifactsFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Limites de pacote do Lambda',
      conceptDescription: 'Tamanhos máximos para pacotes .zip e imagens de container no Lambda.',
      serviceId: lambdaService.id,
      front: 'Quais são os limites de tamanho de pacote no Lambda?',
      back: '.zip: 50 MB no upload direto (acima disso, via S3) e 250 MB descompactados somando as layers. Imagem de container: até 10 GB.',
    },
    {
      conceptName: 'Estrutura de uma layer',
      conceptDescription: 'Caminhos que cada runtime procura dentro de /opt.',
      serviceId: lambdaService.id,
      front: 'Onde uma layer é extraída e qual pasta uma layer Python precisa ter?',
      back: 'Em /opt. Para Python, a pasta python/ na raiz do zip (vira /opt/python); para Node.js, nodejs/node_modules/.',
    },
    {
      conceptName: 'Versões de layer',
      conceptDescription: 'Imutabilidade das versões de layers e como as funções as referenciam.',
      serviceId: lambdaService.id,
      front: 'Publicar uma nova versão de uma layer atualiza as funções que a usam?',
      back: 'Não. Versões são imutáveis e cada função aponta para um ARN de versão; é preciso atualizar a configuração da função. Máximo de 5 layers por função.',
    },
    {
      conceptName: 'Lambda como imagem de container',
      conceptDescription: 'Empacotamento de funções Lambda como imagens de container no ECR.',
      serviceId: ecrService.id,
      front: 'Quando empacotar uma função Lambda como imagem de container, e qual a restrição?',
      back: 'Quando as dependências passam de 250 MB (até 10 GB) ou o time já usa containers. A imagem fica no ECR e não usa layers — tudo vai dentro da imagem.',
    },
    {
      conceptName: 'Memória e CPU no Lambda',
      conceptDescription: 'Relação entre a memória configurada e a CPU alocada a uma função.',
      serviceId: lambdaService.id,
      front: 'Como aumentar a CPU disponível para uma função Lambda?',
      back: 'Aumentando a memória (128 MB a 10.240 MB): a CPU é alocada proporcionalmente (~1.769 MB = 1 vCPU).',
    },
    {
      conceptName: 'Dependências nativas no Lambda',
      conceptDescription: 'Compatibilidade de bibliotecas compiladas com o ambiente do Lambda.',
      serviceId: lambdaService.id,
      front: 'Por que um pacote com bibliotecas compiladas montado no Windows/macOS falha no Lambda?',
      back: 'O binário precisa ser para Amazon Linux, para a arquitetura (x86_64/arm64) e para a versão do runtime. Monte em container (sam build --use-container) ou baixe as wheels certas (pip --platform).',
    },
    {
      conceptName: 'cloudformation package e deploy',
      conceptDescription: 'Passos de empacotamento e deploy de templates com artefatos locais.',
      serviceId: cloudFormationService.id,
      front: 'O que fazem aws cloudformation package e aws cloudformation deploy?',
      back: 'package: envia o código local (CodeUri) ao S3 e gera um template com URIs s3://. deploy: cria e executa um change set; roles do IAM exigem CAPABILITY_IAM, e transforms, CAPABILITY_AUTO_EXPAND.',
    },
    {
      conceptName: 'Template SAM',
      conceptDescription: 'Elementos principais de um template do AWS SAM.',
      serviceId: cloudFormationService.id,
      front: 'O que identifica um template SAM e para que servem Globals e CodeUri?',
      back: 'Transform: AWS::Serverless-2016-10-31. Globals define propriedades comuns a todas as funções; CodeUri aponta para a pasta local (ou S3) do código de cada função.',
    },
    {
      conceptName: '.ebextensions e source bundle',
      conceptDescription: 'Configuração versionada e regras de pacote do Elastic Beanstalk.',
      serviceId: beanstalkService.id,
      front: 'Quais as regras do source bundle do Elastic Beanstalk e para que serve .ebextensions?',
      back: 'Um único .zip/.war de até 500 MB, sem pasta-pai. Arquivos .config em .ebextensions/ instalam pacotes, rodam comandos e definem opções do ambiente em cada deploy.',
    },
    {
      conceptName: 'AppConfig',
      conceptDescription: 'Publicação de configurações e feature flags com segurança.',
      serviceId: appConfigService.id,
      front: 'O que o AWS AppConfig oferece além de guardar configuração?',
      back: 'Validação (JSON Schema ou Lambda), deploy gradual por estratégia e rollback automático por alarme do CloudWatch — mudanças de configuração e feature flags sem redeploy do código.',
    },
  ];

  await seedFlashcards(artifactsTopic.id, artifactsFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 7 of 12: Domain 3 "Testes de aplicações
  // em ambientes de desenvolvimento", to the exam-readiness bar.
  // ---------------------------------------------------------------------

  const devTestingTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: deploymentDomain.id, name: 'Testes de aplicações em ambientes de desenvolvimento' },
  });

  const apiGatewayServiceData = {
    shortName: 'API Gateway',
    category: 'Networking & Content Delivery',
    description:
      'Cria, publica e protege APIs REST, HTTP e WebSocket, com stages, stage variables e integrações com Lambda e outros serviços.',
  };
  const apiGatewayService = await prisma.aWSService.upsert({
    where: { name: 'Amazon API Gateway' },
    update: apiGatewayServiceData,
    create: { name: 'Amazon API Gateway', ...apiGatewayServiceData },
  });

  const versionsLessonContent = `## Objetivo

Ao final desta lição você vai conseguir usar versões e aliases do Lambda e stages do API Gateway para manter ambientes de desenvolvimento, teste e produção separados, e liberar uma versão nova para uma fração do tráfego.

## Versões do Lambda

Toda função tem a versão \`$LATEST\`, que é mutável: cada deploy de código ou mudança de configuração altera ela. Publicar uma versão (\`PublishVersion\`, ou "Publish new version" no Console) cria um snapshot **imutável** do código e da configuração (runtime, memória, variáveis de ambiente...), identificado por um número sequencial: 1, 2, 3... Para mudar qualquer coisa numa versão publicada, publica-se uma versão nova.

Cada versão tem o seu próprio ARN qualificado (\`...:function:minha-funcao:3\`). O ARN sem sufixo (não qualificado) sempre invoca \`$LATEST\` — por isso apontar um gatilho de produção para o ARN não qualificado é arriscado: qualquer deploy em desenvolvimento vai direto para produção.

## Aliases

Um alias é um nome que aponta para uma versão: \`prod\` → versão 5, \`homolog\` → versão 6, \`dev\` → \`$LATEST\`. O ARN do alias (\`...:function:minha-funcao:prod\`) é estável, então gatilhos, o API Gateway e outros serviços apontam para o alias, e a promoção de uma versão vira só uma mudança de ponteiro — assim como o rollback.

Um alias também pode dividir o tráfego entre duas versões publicadas (**weighted alias**): por exemplo, 90% para a versão 5 e 10% para a versão 6. É a base dos deploys canary e linear do Lambda, que o CodeDeploy automatiza (tópico de CI/CD).

## Stages do API Gateway

No API Gateway (APIs REST), alterar recursos e métodos não muda nada para quem chama a API até que as mudanças sejam publicadas num **stage** por meio de um **deployment**. Cada stage (\`dev\`, \`homolog\`, \`prod\`) tem a própria URL (\`https://{api-id}.execute-api.{região}.amazonaws.com/dev\`), o próprio deployment, e configurações próprias de throttling, cache, logs e rastreamento.

**Stage variables** são pares chave-valor por stage, disponíveis em mapping templates (\`$stageVariables.nome\`) e em integrações. O padrão clássico da prova: a integração Lambda aponta para \`minha-funcao:\${stageVariables.lambdaAlias}\`, e o stage \`dev\` define \`lambdaAlias = dev\` enquanto o stage \`prod\` define \`lambdaAlias = prod\`. Como a função é resolvida em tempo de execução, é preciso dar ao API Gateway permissão de invocar **cada alias** (uma resource-based policy por ARN qualificado) — sem isso, a chamada falha com erro 500 de permissão.

Um stage também pode ter **canary release**: uma porcentagem do tráfego do stage vai para um deployment novo, enquanto o resto continua no deployment atual, até a promoção ou o descarte.

## Ambientes separados

Versões, aliases e stages separam ambientes dentro de uma mesma função ou API. Para isolamento mais forte, o mesmo template (SAM/CloudFormation) é implantado como **stacks separadas** por ambiente — com parâmetros (\`--parameter-overrides Stage=dev\`) ou ambientes nomeados no \`samconfig.toml\` (\`sam deploy --config-env dev\`) —, idealmente em **contas AWS separadas** para desenvolvimento e produção.

## Relação com a prova DVA-C02

Espere cenários sobre \`$LATEST\` vs. versões publicadas, aliases com ARN estável e divisão de tráfego, stages e a necessidade de novo deployment, stage variables apontando para aliases (e a permissão de invocação por alias), canary release em stages e stacks separadas por ambiente.`;

  const testingLessonContent = `## Objetivo

Ao final desta lição você vai conseguir escolher entre testes unitários com mocks, testes de integração na nuvem e execução local com o SAM CLI, e usar integrações mock do API Gateway para destravar o desenvolvimento.

## Uma pirâmide de testes serverless

- **Testes unitários**: testam a lógica de negócio sem chamar a AWS. As chamadas ao SDK são substituídas por mocks — em Python, \`moto\` (simula serviços em memória) ou o \`Stubber\` do botocore; em JavaScript, \`aws-sdk-client-mock\` para o SDK v3. Rodam em segundos, a cada commit.
- **Testes de integração**: chamam recursos reais num ambiente de desenvolvimento (a função publicada, a tabela DynamoDB de dev, a fila de dev). Pegam o que mocks não pegam: permissões do IAM, formatos reais de eventos, configurações de timeout, limites de serviço.
- **Testes de ponta a ponta**: exercitam o fluxo completo pela API pública do ambiente de teste.

Uma prática que facilita tudo: manter o handler fino — ele só traduz o evento e chama funções de negócio que recebem os clientes do SDK como parâmetro (injeção de dependência), fáceis de testar com mocks.

## Testando com eventos realistas

Funções Lambda recebem eventos com formatos específicos de cada serviço. O Console permite salvar **test events** (inclusive compartilháveis entre usuários da conta), e o SAM CLI gera eventos de exemplo para dezenas de serviços com \`sam local generate-event\` (ex.: \`sam local generate-event s3 put\` ou \`sam local generate-event apigateway aws-proxy\`).

## SAM CLI local

Com o Docker instalado, o SAM CLI roda funções localmente num container que imita o ambiente do Lambda:

- \`sam local invoke MinhaFuncao -e events/evento.json\` executa a função uma vez com um evento.
- \`sam local start-api\` sobe um servidor HTTP local que emula o API Gateway, com as rotas do template.
- \`sam local start-lambda\` expõe um endpoint local compatível com a API do Lambda, útil para testes automatizados que usam o SDK.

Execução local acelera o ciclo de desenvolvimento, mas continua chamando os serviços **reais** da AWS que a função usa (com as credenciais locais) — não é um ambiente isolado. Para iterar direto na nuvem, \`sam sync --watch\` (SAM Accelerate) envia mudanças de código para a stack de desenvolvimento em segundos, sem um deploy completo do CloudFormation — recomendado só para ambientes de desenvolvimento.

## Integração mock do API Gateway

Uma integração do tipo **Mock** faz o API Gateway responder sem nenhum backend: o mapping template da requisição define o status (\`{"statusCode": 200}\`) e o da resposta define o corpo. Serve para o time de frontend desenvolver contra o contrato da API antes de o backend existir, para testes de contrato, e para respostas fixas (ex.: um endpoint de health check ou respostas de CORS).

## Relação com a prova DVA-C02

Espere cenários pedindo mocks do SDK para testes unitários, integração mock do API Gateway para desbloquear o frontend, \`sam local invoke\`/\`start-api\`/\`generate-event\` para testar localmente, e \`sam sync\` para iterar rápido em desenvolvimento.`;

  const devTestingLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 12,
      title: 'Versões, aliases e stages: ambientes de desenvolvimento na AWS',
      content: versionsLessonContent,
      resources: [
        {
          title: 'Aliases de funções Lambda — documentação oficial',
          url: 'https://docs.aws.amazon.com/lambda/latest/dg/configuration-aliases.html',
        },
        {
          title: 'Stage variables no API Gateway — documentação oficial',
          url: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/stage-variables.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 10,
      title: 'Testando aplicações serverless: mocks, integração e SAM local',
      content: testingLessonContent,
      resources: [
        {
          title: 'Testes locais com o SAM CLI — documentação oficial',
          url: 'https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/using-sam-cli-local.html',
        },
        {
          title: 'Integrações mock no API Gateway — documentação oficial',
          url: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-mock-integration.html',
        },
      ],
    },
  ];

  await seedLessons(devTestingTopic.id, devTestingLessons);

  const weightedAliasInstructions = `No Console, edite o alias \`prod\`: mantenha a versão 1 e, em "Weighted alias", escolha a versão 2 com peso de 20%. Salve e, no CloudShell, invoque o alias 20 vezes contando as respostas:

\`\`\`bash
for i in $(seq 1 20); do
  aws lambda invoke --function-name devlab-versoes --qualifier prod saida.json > /dev/null
  cat saida.json; echo
done | sort | uniq -c
\`\`\``;

  const mockTemplateInstructions = `No Console do API Gateway, crie uma **REST API** chamada \`devlab-api\`. Crie o recurso \`/status\` e, nele, um método \`GET\` com tipo de integração **Mock**. Na aba "Integration response" do método, edite a resposta padrão e adicione um mapping template para \`application/json\` com:

\`\`\`json
{"ambiente": "$stageVariables.ambiente", "status": "ok"}
\`\`\``;

  const devTestingLabs: LabSeed[] = [
    {
      title: 'Versões e aliases do Lambda, com divisão de tráfego',
      data: {
        level: 2,
        order: 1,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá publicado duas versões imutáveis de uma função Lambda, criado aliases `dev` e `prod` apontando para versões diferentes, e configurado o alias `prod` para mandar 20% do tráfego para a versão nova.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido a lição "Versões, aliases e stages: ambientes de desenvolvimento na AWS" ajuda.',
        context:
          'Um time faz deploy direto em `$LATEST`, e o gatilho de produção aponta para o ARN não qualificado da função — cada deploy de desenvolvimento chega aos clientes na hora. Você vai separar os ambientes com versões e aliases e liberar a versão nova só para uma parte do tráfego.',
        troubleshooting:
          'As invocações do passo 5 sempre retornam v1: com 20 chamadas, é possível (mas raro) nenhuma cair na versão 2 — rode o laço de novo; confira também se o peso foi salvo no alias `prod`. \n\n"Publish new version" não cria versão nova: o Lambda só publica se o código ou a configuração mudaram desde a última versão — confira se clicou em "Deploy" depois de editar o código. \n\n`ResourceNotFoundException` ao invocar com `--qualifier`: o alias precisa existir com esse nome exato (`dev` ou `prod`) na mesma região do CloudShell.',
        cleanup:
          'Exclua a função `devlab-versoes` (isso remove as versões e os aliases) e, se quiser, o log group `/aws/lambda/devlab-versoes`.',
        costWarning: 'As poucas dezenas de invocações ficam dentro do Free Tier do Lambda.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar a função (v1)',
          instructions:
            'No Console do Lambda, crie a função `devlab-versoes` com Python 3.13. Substitua o código por:\n\n```python\ndef lambda_handler(event, context):\n    return {"versao": "v1"}\n```\n\nClique em "Deploy".',
          validation: 'Um teste com o evento padrão devolve `{"versao": "v1"}`.',
        },
        {
          order: 2,
          title: 'Publicar a versão 1',
          instructions:
            'Na aba "Versions", clique em "Publish new version" com a descrição `primeira versao`.',
          validation:
            'A versão 1 aparece na lista com um ARN terminando em `:devlab-versoes:1`. Abrindo a versão, o editor de código fica somente leitura — versões publicadas são imutáveis.',
        },
        {
          order: 3,
          title: 'Criar a v2 e publicar a versão 2',
          instructions:
            'Volte para a função (`$LATEST`), troque `"v1"` por `"v2"` no código, clique em "Deploy" e publique uma nova versão com a descrição `segunda versao`.',
          validation: 'A aba "Versions" lista as versões 1 e 2, além de `$LATEST`.',
        },
        {
          order: 4,
          title: 'Criar os aliases dev e prod',
          instructions:
            'Na aba "Aliases", crie o alias `prod` apontando para a versão 1 e o alias `dev` apontando para a versão 2. Depois, no CloudShell, invoque cada um:\n\n```bash\naws lambda invoke --function-name devlab-versoes --qualifier prod saida.json > /dev/null && cat saida.json\naws lambda invoke --function-name devlab-versoes --qualifier dev saida.json > /dev/null && cat saida.json\n```',
          validation:
            '`prod` responde `{"versao": "v1"}` e `dev` responde `{"versao": "v2"}` — a mesma função, dois ambientes, cada um com um ARN estável.',
        },
        {
          order: 5,
          title: 'Mandar 20% do tráfego de prod para a v2',
          instructions: weightedAliasInstructions,
          validation:
            'A contagem mostra a maioria das respostas `v1` e algumas `v2` (em torno de 4 em 20) — o alias `prod` está dividindo o tráfego, como num deploy canary. Para promover, basta apontar o alias para a versão 2; para desfazer, remover o peso.',
        },
      ],
    },
    {
      title: 'Stages do API Gateway com stage variables e integração mock',
      data: {
        level: 2,
        order: 2,
        estimatedMinutes: 30,
        objective:
          'Ao final deste laboratório você terá criado uma API REST com integração mock, publicado a API em dois stages com stage variables diferentes, e comprovado que uma mudança só chega a um stage quando ela é implantada nele.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido as duas lições deste tópico ajuda.',
        context:
          'O time de frontend precisa começar a integrar com um endpoint `/status` antes de o backend existir, e o time quer ambientes `dev` e `prod` separados na mesma API. Você vai atender os dois com uma integração mock e stages.',
        troubleshooting:
          'A resposta vem vazia ou sem o JSON: o mapping template precisa estar na "Integration response" (não na "Method response") e com o content type `application/json`. \n\n`"ambiente": ""`: a stage variable não foi criada no stage chamado, ou o nome não é exatamente `ambiente`. \n\n`{"message":"Missing Authentication Token"}`: a URL está errada — confira o nome do stage e o caminho `/status` no fim. \n\nA mudança do passo 5 não aparece em nenhum stage: é o esperado até você fazer o deploy; depois do deploy no `dev`, espere alguns segundos e chame de novo.',
        cleanup: 'No Console do API Gateway, selecione `devlab-api` e use "Delete API". Isso remove os stages e os deployments.',
        costWarning:
          'APIs REST são cobradas por milhão de chamadas; as poucas chamadas deste laboratório custam frações de centavo (e ficam dentro do Free Tier de contas elegíveis).',
      },
      steps: [
        {
          order: 1,
          title: 'Criar a API com integração mock',
          instructions: mockTemplateInstructions,
          validation:
            'O método `GET /status` aparece com integração "Mock". O botão "Test" do Console devolve status 200 com `"ambiente": ""` — ainda não há stage, então a stage variable está vazia.',
        },
        {
          order: 2,
          title: 'Publicar no stage dev',
          instructions:
            'Clique em "Deploy API", escolha "New stage" com o nome `dev`. Depois, na página do stage `dev`, abra "Stage variables" e adicione `ambiente` com o valor `dev`. Copie a "Invoke URL" do stage.',
          validation: 'O stage `dev` aparece com a stage variable `ambiente = dev` e uma Invoke URL terminando em `/dev`.',
        },
        {
          order: 3,
          title: 'Publicar no stage prod',
          instructions:
            'Faça "Deploy API" de novo, agora num novo stage `prod`, e adicione a stage variable `ambiente` com o valor `prod`.',
          validation: 'Existem dois stages, `dev` e `prod`, cada um com sua Invoke URL e seu valor de `ambiente`.',
        },
        {
          order: 4,
          title: 'Chamar os dois stages',
          instructions:
            'No CloudShell, chame os dois stages, trocando `URL-DEV` e `URL-PROD` pelas Invoke URLs:\n\n```bash\ncurl URL-DEV/status; echo\ncurl URL-PROD/status; echo\n```',
          validation:
            'O `dev` responde `{"ambiente": "dev", "status": "ok"}` e o `prod` responde `{"ambiente": "prod", "status": "ok"}` — mesma definição de API, configuração diferente por stage, e nenhum backend envolvido.',
        },
        {
          order: 5,
          title: 'Mudar a API e implantar só no dev',
          instructions:
            'Edite o mapping template da integration response para `{"ambiente": "$stageVariables.ambiente", "status": "ok", "versao": "2"}` e salve. Chame os dois stages de novo. Depois faça "Deploy API" **só** no stage `dev` e chame os dois mais uma vez.',
          validation:
            'Logo após salvar, nenhum stage mostra `versao`. Depois do deploy no `dev`, só o `dev` responde com `"versao": "2"`; o `prod` continua igual — cada stage serve o deployment que foi implantado nele.',
        },
      ],
    },
  ];

  await seedLabs(devTestingTopic.id, devTestingLabs);

  const devTestingQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Qual é a diferença entre a versão $LATEST de uma função Lambda e uma versão publicada?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        '$LATEST é mutável e muda a cada deploy. Uma versão publicada é um snapshot imutável do código e da configuração, com número e ARN próprios.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html',
      options: [
        {
          text: '$LATEST é mutável; uma versão publicada é um snapshot imutável de código e configuração.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Versões publicadas podem ter o código editado no Console; $LATEST não.',
          isCorrect: false,
          explanation: 'É o contrário: só $LATEST é editável.',
        },
        {
          text: 'Não há diferença; são nomes para o mesmo código.',
          isCorrect: false,
          explanation: 'Uma versão publicada congela o estado no momento da publicação.',
        },
        {
          text: '$LATEST só existe para funções empacotadas como imagem de container.',
          isCorrect: false,
          explanation: 'Toda função tem $LATEST.',
        },
      ],
    },
    {
      prompt: 'O que é um alias do Lambda?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Um alias é um ponteiro nomeado (com ARN estável) para uma versão da função, e pode dividir o tráfego entre duas versões publicadas.',
      options: [
        {
          text: 'Um nome com ARN estável que aponta para uma versão da função (e pode dividir tráfego entre duas versões).',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Uma cópia independente da função com outro nome.', isCorrect: false, explanation: 'Um alias não copia código; só aponta para uma versão.' },
        { text: 'Um nome de domínio customizado para a função.', isCorrect: false, explanation: 'Isso seria uma function URL com domínio próprio ou o API Gateway.' },
        { text: 'Uma variável de ambiente compartilhada entre funções.', isCorrect: false, explanation: 'Não tem relação com variáveis de ambiente.' },
      ],
    },
    {
      prompt:
        'Um desenvolvedor alterou um método de uma API REST no Console do API Gateway, mas quem chama a URL do stage prod continua recebendo o comportamento antigo. Por quê?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'Mudanças numa API REST só chegam a um stage quando um novo deployment é feito para ele. Cada stage serve o deployment que foi implantado nele.',
      options: [
        {
          text: 'As mudanças precisam ser publicadas num deployment para o stage prod.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'O API Gateway leva até uma hora para propagar mudanças.', isCorrect: false, explanation: 'Não há propagação automática: é preciso fazer o deploy.' },
        { text: 'O cache do navegador guarda a resposta antiga.', isCorrect: false, explanation: 'O problema é a ausência de deployment, não o cliente.' },
        { text: 'Stages só podem ser alterados via CloudFormation.', isCorrect: false, explanation: 'O Console também faz deployments.' },
      ],
    },
    {
      prompt:
        'Uma API REST tem os stages dev e prod e uma integração com uma função Lambda que tem os aliases dev e prod. Como fazer cada stage invocar o alias correspondente usando uma única definição de integração?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'A integração aponta para minha-funcao:${stageVariables.lambdaAlias}, e cada stage define a stage variable lambdaAlias com o nome do seu alias. É preciso também permitir que o API Gateway invoque cada alias.',
      officialReferences: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/stage-variables.html',
      options: [
        {
          text: 'Usar uma stage variable (ex.: lambdaAlias) no ARN da integração e defini-la em cada stage.',
          isCorrect: true,
          explanation: 'Correto: o alias é resolvido em tempo de execução, por stage.',
        },
        { text: 'Criar duas APIs separadas, uma por alias.', isCorrect: false, explanation: 'Funciona, mas duplica a definição da API — o oposto do pedido.' },
        { text: 'Usar o ARN não qualificado da função.', isCorrect: false, explanation: 'Sempre invocaria $LATEST, nos dois stages.' },
        { text: 'Definir uma variável de ambiente na função com o nome do stage.', isCorrect: false, explanation: 'Não muda qual alias o API Gateway invoca.' },
      ],
    },
    {
      prompt:
        'O time de frontend precisa começar a desenvolver contra um endpoint da API que o backend ainda não implementou. Qual recurso do API Gateway permite isso sem código de backend?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Uma integração do tipo Mock devolve uma resposta definida por mapping templates, sem nenhum backend.',
      officialReferences: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-mock-integration.html',
      options: [
        { text: 'Integração Mock.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Integração Lambda proxy.', isCorrect: false, explanation: 'Exige uma função Lambda de backend.' },
        { text: 'Integração HTTP com o próprio frontend.', isCorrect: false, explanation: 'Não resolve a ausência do backend.' },
        { text: 'Cache do stage habilitado.', isCorrect: false, explanation: 'O cache guarda respostas de um backend existente.' },
      ],
    },
    {
      prompt:
        'Testes unitários de uma função Python que grava no DynamoDB estão criando itens na tabela real de desenvolvimento e ficam lentos e instáveis. Qual é a abordagem recomendada para os testes unitários?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Testes unitários devem isolar a lógica, substituindo as chamadas ao SDK por mocks (ex.: moto ou o Stubber do botocore). Chamadas reais ficam para os testes de integração, num ambiente de desenvolvimento.',
      options: [
        {
          text: 'Mockar as chamadas ao SDK (ex.: moto ou Stubber) nos testes unitários e deixar a tabela real para os testes de integração.',
          isCorrect: true,
          explanation: 'Correto: cada nível de teste com o seu propósito.',
        },
        { text: 'Rodar os testes unitários contra a tabela de produção.', isCorrect: false, explanation: 'Arrisca dados reais e mantém a lentidão.' },
        { text: 'Remover os testes da camada de dados.', isCorrect: false, explanation: 'Perde cobertura em vez de isolar dependências.' },
        { text: 'Aumentar a capacidade da tabela de desenvolvimento.', isCorrect: false, explanation: 'Não resolve o acoplamento dos testes unitários a recursos reais.' },
      ],
    },
    {
      prompt:
        'Um desenvolvedor quer executar localmente, na própria máquina, uma função definida num template SAM, simulando um evento de upload no S3. Qual combinação do SAM CLI atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'sam local generate-event s3 put gera um evento de exemplo, e sam local invoke executa a função num container local (Docker) com esse evento.',
      options: [
        {
          text: 'sam local generate-event s3 put para gerar o evento e sam local invoke -e com ele.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'sam deploy seguido de um upload real no S3.', isCorrect: false, explanation: 'Isso testa na nuvem, não localmente.' },
        { text: 'sam local start-api.', isCorrect: false, explanation: 'Emula o API Gateway, não um evento do S3.' },
        { text: 'sam package com o evento no template.', isCorrect: false, explanation: 'package só empacota artefatos para o S3.' },
      ],
    },
    {
      prompt:
        'Um time quer mandar 10% do tráfego de uma função Lambda para uma versão nova, mantendo o mesmo ARN que o gatilho de produção usa, e poder voltar atrás instantaneamente. Qual recurso atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Um alias com divisão de tráfego (weighted alias) mantém o ARN estável para o gatilho e divide as invocações entre duas versões publicadas; o rollback é só remover o peso.',
      options: [
        { text: 'Um alias com peso de 10% para a versão nova.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Duas funções separadas com o gatilho duplicado.', isCorrect: false, explanation: 'Cada gatilho receberia 100% dos eventos.' },
        { text: 'Concorrência reservada de 10% para a versão nova.', isCorrect: false, explanation: 'Concorrência limita execuções simultâneas; não roteia tráfego.' },
        { text: 'Publicar a versão nova em $LATEST.', isCorrect: false, explanation: '$LATEST não divide tráfego.' },
      ],
    },
    {
      prompt:
        'Um bug chegou a produção logo após um deploy de teste feito por um desenvolvedor. A investigação mostra que a fila de produção dispara a função Lambda pelo ARN não qualificado. Qual é a correção?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'O ARN não qualificado invoca $LATEST, que muda a cada deploy. O gatilho de produção deve apontar para um alias (ex.: prod) que referencia uma versão publicada e testada.',
      options: [
        {
          text: 'Apontar o gatilho de produção para um alias prod que referencia uma versão publicada.',
          isCorrect: true,
          explanation: 'Correto: deploys em $LATEST deixam de afetar produção.',
        },
        { text: 'Proibir deploys fora do horário comercial.', isCorrect: false, explanation: 'Não elimina o acoplamento entre dev e produção.' },
        { text: 'Apontar o gatilho para $LATEST explicitamente.', isCorrect: false, explanation: 'É o mesmo comportamento do ARN não qualificado.' },
        { text: 'Aumentar o timeout da função.', isCorrect: false, explanation: 'Não tem relação com o problema.' },
      ],
    },
    {
      prompt:
        'Um time quer ambientes dev e prod isolados para uma aplicação SAM, com a mesma definição de infraestrutura. Qual abordagem é a recomendada?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'O mesmo template é implantado como stacks separadas por ambiente, com parâmetros ou ambientes nomeados no samconfig.toml (sam deploy --config-env) — idealmente em contas AWS separadas.',
      options: [
        {
          text: 'Implantar o mesmo template como stacks separadas por ambiente (parâmetros ou --config-env), de preferência em contas separadas.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Manter dois templates copiados e editados à mão.', isCorrect: false, explanation: 'As cópias divergem com o tempo.' },
        { text: 'Usar uma única stack e trocar valores manualmente no Console.', isCorrect: false, explanation: 'Mistura ambientes e cria drift.' },
        { text: 'Criar os recursos de dev pelo Console e só os de prod pelo template.', isCorrect: false, explanation: 'Dev deixaria de representar prod.' },
      ],
    },
    {
      prompt:
        'Uma integração do API Gateway usa minha-funcao:${stageVariables.lambdaAlias}. O stage prod funciona, mas o stage dev (lambdaAlias = dev) retorna erro 500 de permissões inválidas na função Lambda. Qual é a causa mais provável?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Com stage variables, o API Gateway precisa de permissão de invocação (resource-based policy, lambda:InvokeFunction) para cada ARN qualificado. Falta a permissão para o alias dev.',
      options: [
        {
          text: 'Falta a permissão lambda:InvokeFunction para o API Gateway no ARN do alias dev.',
          isCorrect: true,
          explanation: 'Correto: cada alias precisa da sua própria permissão.',
        },
        { text: 'Stage variables não funcionam com aliases.', isCorrect: false, explanation: 'Esse é justamente o padrão recomendado.' },
        { text: 'O alias dev precisa apontar para uma versão publicada.', isCorrect: false, explanation: 'Um alias pode apontar para $LATEST; o erro é de permissão.' },
        { text: 'O stage dev precisa de uma chave de API.', isCorrect: false, explanation: 'Isso gera erro 403 para o cliente, não 500 de permissão na função.' },
      ],
    },
    {
      prompt:
        'Um time quer testar um novo deployment de uma API REST com 5% do tráfego real do stage prod antes de promovê-lo para todos. Qual recurso do API Gateway atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'As configurações de canary release de um stage mandam uma porcentagem do tráfego para um deployment canary, que depois é promovido ou descartado.',
      officialReferences: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/canary-release.html',
      options: [
        { text: 'Canary release no stage prod.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Criar um stage prod2 e divulgar a URL a 5% dos clientes.', isCorrect: false, explanation: 'Não divide o tráfego do stage de forma transparente.' },
        { text: 'Usage plans com limite de 5%.', isCorrect: false, explanation: 'Usage plans limitam consumo por chave de API.' },
        { text: 'Cache do stage com TTL de 5%.', isCorrect: false, explanation: 'Cache não divide tráfego entre deployments.' },
      ],
    },
    {
      prompt:
        'Durante o desenvolvimento, um programador quer que cada alteração salva no código seja enviada em segundos para a stack de desenvolvimento na AWS, sem esperar um deploy completo do CloudFormation. Qual comando atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'sam sync --watch (SAM Accelerate) observa os arquivos e sincroniza mudanças de código diretamente com os recursos da stack de desenvolvimento. Não é recomendado para produção.',
      options: [
        { text: 'sam sync --watch', isCorrect: true, explanation: 'Correto: iteração rápida na nuvem, só em desenvolvimento.' },
        { text: 'sam deploy --guided', isCorrect: false, explanation: 'Faz um deploy completo via CloudFormation.' },
        { text: 'sam local start-api', isCorrect: false, explanation: 'Roda localmente, não sincroniza com a nuvem.' },
        { text: 'aws cloudformation package', isCorrect: false, explanation: 'Só empacota artefatos para o S3.' },
      ],
    },
  ];

  await seedQuestions(devTestingTopic.id, devTestingQuestionsToSeed);

  const devTestingFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: '$LATEST e versões publicadas',
      conceptDescription: 'Mutabilidade de $LATEST e imutabilidade das versões publicadas do Lambda.',
      serviceId: lambdaService.id,
      front: 'Qual a diferença entre $LATEST e uma versão publicada do Lambda?',
      back: '$LATEST é mutável e muda a cada deploy. Uma versão publicada é um snapshot imutável de código e configuração, com número e ARN próprios. O ARN não qualificado invoca $LATEST.',
    },
    {
      conceptName: 'Aliases do Lambda',
      conceptDescription: 'Ponteiros nomeados e estáveis para versões de uma função.',
      serviceId: lambdaService.id,
      front: 'Para que servem os aliases do Lambda?',
      back: 'Dão um ARN estável (ex.: :prod) que aponta para uma versão. Promoção e rollback viram mudanças de ponteiro; gatilhos e o API Gateway apontam para o alias.',
    },
    {
      conceptName: 'Weighted alias',
      conceptDescription: 'Divisão de tráfego de um alias entre duas versões publicadas.',
      serviceId: lambdaService.id,
      front: 'Como mandar uma porcentagem do tráfego de uma função para uma versão nova?',
      back: 'Com um weighted alias: o alias aponta para a versão atual e manda um peso (ex.: 10%) para a nova. É a base dos deploys canary/linear do CodeDeploy para Lambda.',
    },
    {
      conceptName: 'Stages e deployments do API Gateway',
      conceptDescription: 'Relação entre mudanças numa API REST, deployments e stages.',
      serviceId: apiGatewayService.id,
      front: 'Quando uma mudança numa API REST do API Gateway chega aos clientes?',
      back: 'Só depois de um deployment para o stage. Cada stage (dev, prod...) tem URL, deployment e configurações próprias (throttling, cache, logs).',
    },
    {
      conceptName: 'Stage variables',
      conceptDescription: 'Configuração por stage no API Gateway.',
      serviceId: apiGatewayService.id,
      front: 'Como fazer cada stage do API Gateway invocar um alias diferente da mesma função?',
      back: 'Integração apontando para minha-funcao:${stageVariables.lambdaAlias}, com lambdaAlias definido em cada stage — e permissão lambda:InvokeFunction para cada alias.',
    },
    {
      conceptName: 'Canary release no API Gateway',
      conceptDescription: 'Liberação de um deployment novo para parte do tráfego de um stage.',
      serviceId: apiGatewayService.id,
      front: 'Como testar um deployment novo de uma API REST com parte do tráfego de produção?',
      back: 'Com canary release no stage: uma porcentagem vai para o deployment canary, que depois é promovido ou descartado.',
    },
    {
      conceptName: 'Integração mock',
      conceptDescription: 'Integração do API Gateway que responde sem backend.',
      serviceId: apiGatewayService.id,
      front: 'Para que serve uma integração Mock no API Gateway?',
      back: 'Responder sem backend, com status e corpo definidos por mapping templates — para o frontend avançar antes do backend, testes de contrato e respostas fixas.',
    },
    {
      conceptName: 'Mocks do SDK em testes unitários',
      conceptDescription: 'Substituição de chamadas à AWS em testes unitários.',
      serviceId: lambdaService.id,
      front: 'Como testar unitariamente código que chama serviços da AWS sem recursos reais?',
      back: 'Mockando o SDK: moto ou Stubber do botocore (Python), aws-sdk-client-mock (JavaScript v3). Recursos reais ficam para os testes de integração em dev.',
    },
    {
      conceptName: 'SAM CLI local',
      conceptDescription: 'Comandos do SAM CLI para executar e testar funções localmente.',
      serviceId: cloudFormationService.id,
      front: 'Quais comandos do SAM CLI testam uma função localmente?',
      back: 'sam local invoke -e evento.json (uma execução), sam local start-api (emula o API Gateway), sam local generate-event (eventos de exemplo). Exigem Docker e chamam os serviços reais da AWS.',
    },
    {
      conceptName: 'sam sync',
      conceptDescription: 'Sincronização rápida de mudanças com a stack de desenvolvimento.',
      serviceId: cloudFormationService.id,
      front: 'Como iterar rápido na nuvem sem esperar deploys completos do CloudFormation?',
      back: 'sam sync --watch (SAM Accelerate): envia mudanças de código para a stack de desenvolvimento em segundos. Não é para produção.',
    },
  ];

  await seedFlashcards(devTestingTopic.id, devTestingFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 8 of 12: Domain 3 "Automação de testes
  // de deploy", to the exam-readiness bar.
  // ---------------------------------------------------------------------

  const testAutomationTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: deploymentDomain.id, name: 'Automação de testes de deploy' },
  });

  const codeBuildServiceData = {
    shortName: 'CodeBuild',
    category: 'Developer Tools',
    description:
      'Serviço de build gerenciado que compila código, roda testes e gera artefatos a partir de um buildspec, cobrando por minuto de build.',
  };
  const codeBuildService = await prisma.aWSService.upsert({
    where: { name: 'AWS CodeBuild' },
    update: codeBuildServiceData,
    create: { name: 'AWS CodeBuild', ...codeBuildServiceData },
  });

  const codePipelineServiceData = {
    shortName: 'CodePipeline',
    category: 'Developer Tools',
    description:
      'Orquestra pipelines de entrega contínua em stages (source, build, test, deploy, aprovação) que rodam a cada mudança.',
  };
  const codePipelineService = await prisma.aWSService.upsert({
    where: { name: 'AWS CodePipeline' },
    update: codePipelineServiceData,
    create: { name: 'AWS CodePipeline', ...codePipelineServiceData },
  });

  const amplifyServiceData = {
    shortName: 'Amplify',
    category: 'Front-End Web & Mobile',
    description:
      'Hospeda e publica aplicações web full-stack com CI/CD por branch do Git e ambientes de preview para pull requests.',
  };
  const amplifyService = await prisma.aWSService.upsert({
    where: { name: 'AWS Amplify' },
    update: amplifyServiceData,
    create: { name: 'AWS Amplify', ...amplifyServiceData },
  });

  const pipelineTestsLessonContent = `## Objetivo

Ao final desta lição você vai conseguir escrever um \`buildspec.yml\` que roda testes e publica relatórios no AWS CodeBuild, e posicionar testes unitários, de integração e aprovações num pipeline do AWS CodePipeline.

## Onde os testes rodam

Num pipeline da AWS, o CodePipeline orquestra os stages (source → build → teste → deploy) e o **CodeBuild** executa o trabalho pesado: instala dependências, roda os testes e gera artefatos, num container gerenciado que existe só durante o build. Se qualquer comando da fase \`build\` termina com código de saída diferente de zero, o build falha — e o pipeline para ali, sem chegar ao deploy.

## O buildspec

Por padrão, o CodeBuild procura um arquivo \`buildspec.yml\` na **raiz** do código-fonte (o nome e o caminho podem ser trocados na configuração do projeto). A estrutura:

- \`version: 0.2\`
- \`env\`: variáveis de ambiente — valores fixos (\`variables\`), valores do Parameter Store (\`parameter-store\`) e segredos do Secrets Manager (\`secrets-manager\`), sem colocar segredos no arquivo.
- \`phases\`, nesta ordem: \`install\` (runtimes e ferramentas, com \`runtime-versions\`), \`pre_build\` (login no ECR, lint, preparação), \`build\` (compilação e testes) e \`post_build\` (empacotamento, push de imagens, notificações).
- \`reports\`: arquivos de resultado de testes (JUnit XML, Cucumber, TestNG, NUnit...) e de cobertura, publicados num **report group** para acompanhar os resultados ao longo dos builds.
- \`artifacts\`: o que sai do build para os próximos stages (ex.: o template empacotado pelo SAM).
- \`cache\`: caminhos (ex.: o cache do pip ou \`node_modules\`) guardados entre builds, no S3 ou localmente, para acelerar instalações.

Builds que precisam rodar Docker (construir imagens, \`sam build --use-container\`) exigem o **modo privilegiado** no ambiente do projeto.

## Testes em cada stage

- **Build**: testes unitários com mocks — rápidos, sem depender de nenhum ambiente.
- **Deploy em teste**: o mesmo artefato é implantado num ambiente de teste (uma stack separada, um alias ou stage de teste).
- **Teste**: uma ação do CodeBuild roda testes de integração e ponta a ponta contra o ambiente de teste, usando os outputs da stack (URL da API, nome da fila) e eventos de teste versionados no repositório (ex.: \`events/*.json\`).
- **Aprovação manual** (opcional): uma ação de aprovação pausa o pipeline até alguém aprovar, antes da produção.
- **Deploy em produção**: com o artefato que passou por tudo — nunca reconstruído.

O artefato promovido deve ser sempre o mesmo e aprovado: uma versão publicada do Lambda, uma tag imutável da imagem de container (ou o digest), um template empacotado. Ferramentas como o **Amazon Q Developer** ajudam a gerar testes unitários a partir do código, que depois entram nesse fluxo.

## Relação com a prova DVA-C02

Espere perguntas sobre a estrutura e a ordem das fases do \`buildspec\`, onde o CodeBuild procura o arquivo, segredos via \`env\`, \`reports\` e \`cache\`, modo privilegiado para Docker, e a ordem dos testes e aprovações num pipeline.`;

  const iacTestEnvLessonContent = `## Objetivo

Ao final desta lição você vai conseguir criar ambientes de teste reproduzíveis e descartáveis com o AWS CloudFormation e o AWS SAM, usando parâmetros, condições, change sets, exports e proteções de dados.

## Um template, vários ambientes

Com infraestrutura como código, um ambiente de teste é idêntico ao de produção por construção — e pode ser criado e destruído a cada pull request. Os recursos do CloudFormation para isso:

- **Parameters**: valores de entrada, como \`Ambiente\` (com \`AllowedValues: [teste, prod]\`), passados no deploy (\`--parameter-overrides Ambiente=teste\`).
- **Mappings**: tabelas fixas consultadas com \`!FindInMap\` (ex.: tamanho de instância por ambiente).
- **Conditions**: expressões como \`EhProd: !Equals [!Ref Ambiente, prod]\`, usadas para criar um recurso só em alguns ambientes (\`Condition: EhProd\`) ou escolher valores com \`!If\` — ex.: alarmes e retenção longa só em produção.
- **Outputs** com **Export**: publicam valores (URL da API, nome da fila) que testes automatizados leem com \`describe-stacks\` e que outras stacks importam com \`!ImportValue\`. Uma stack não pode ser excluída enquanto outra importar um valor exportado por ela.

## Mudanças com segurança

- **Change sets** mostram o que uma atualização vai adicionar, modificar ou substituir antes de executá-la — essencial para perceber uma **substituição** (\`Replacement: True\`) de um recurso com dados.
- **Rollback triggers**: a stack monitora alarmes do CloudWatch durante a criação/atualização (e por um período depois) e faz rollback automático se algum disparar.
- **DeletionPolicy**: \`Retain\` mantém o recurso quando a stack é excluída, e \`Snapshot\` (RDS, EBS, entre outros) cria um snapshot antes de excluir. \`UpdateReplacePolicy\` faz o mesmo quando uma atualização substitui o recurso.
- **Drift detection** encontra recursos alterados fora do CloudFormation.
- Validação no pipeline, antes do deploy: \`aws cloudformation validate-template\`, \`sam validate\` e linters como o \`cfn-lint\`.

## Escala: nested stacks e StackSets

**Nested stacks** reutilizam pedaços de template (ex.: uma VPC padrão) dentro de outras stacks. **StackSets** implantam a mesma stack em várias contas e regiões a partir de uma conta administradora.

## Ambientes por branch

Além de stacks por branch em pipelines próprios, o **AWS Amplify** cria automaticamente um ambiente para cada branch conectada do Git e **previews** para cada pull request, com URL própria — o time testa a mudança isolada antes do merge.

## Relação com a prova DVA-C02

Espere cenários com parâmetros e conditions por ambiente, change sets para prever substituições, exports/\`ImportValue\` entre stacks, \`DeletionPolicy\` para proteger dados, rollback triggers com alarmes, ambientes efêmeros por pull request e ambientes por branch no Amplify.`;

  const testAutomationLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 12,
      title: 'Testes automatizados no pipeline: CodeBuild e buildspec',
      content: pipelineTestsLessonContent,
      resources: [
        {
          title: 'Referência do buildspec — documentação oficial',
          url: 'https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html',
        },
        {
          title: 'Relatórios de testes no CodeBuild — documentação oficial',
          url: 'https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 11,
      title: 'Ambientes de teste com infraestrutura como código',
      content: iacTestEnvLessonContent,
      resources: [
        {
          title: 'Change sets do CloudFormation — documentação oficial',
          url: 'https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html',
        },
        {
          title: 'Conditions em templates do CloudFormation — documentação oficial',
          url: 'https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/conditions-section-structure.html',
        },
      ],
    },
  ];

  await seedLessons(testAutomationTopic.id, testAutomationLessons);

  const codeBuildSourceInstructions = `No AWS CloudShell, crie um projeto Python com uma função, um teste e o \`buildspec.yml\`, compacte e envie para um bucket novo (troque \`NOME-DO-BUCKET\` por um nome único):

\`\`\`bash
mkdir -p devlab-build/tests && cd devlab-build
cat > calculadora.py <<'FIM'
def desconto(valor, percentual):
    if not 0 <= percentual <= 100:
        raise ValueError("percentual invalido")
    return round(valor * (1 - percentual / 100), 2)
FIM
cat > tests/test_calculadora.py <<'FIM'
import pytest

from calculadora import desconto


def test_desconto_simples():
    assert desconto(200, 10) == 180


def test_percentual_invalido():
    with pytest.raises(ValueError):
        desconto(100, 150)
FIM
cat > buildspec.yml <<'FIM'
version: 0.2
phases:
  install:
    runtime-versions:
      python: 3.12
    commands:
      - pip install pytest
  build:
    commands:
      - python -m pytest --junitxml=relatorios/unit.xml
reports:
  testes-unitarios:
    files:
      - unit.xml
    base-directory: relatorios
    file-format: JUNITXML
FIM
zip -r ../devlab-build.zip . && cd ..
aws s3 mb s3://NOME-DO-BUCKET
aws s3 cp devlab-build.zip s3://NOME-DO-BUCKET/devlab-build.zip
\`\`\``;

  const ephemeralTemplateInstructions = `No AWS CloudShell, crie o template de um ambiente com uma fila SQS, uma condição que só cria o alarme em produção e um output exportado:

\`\`\`bash
mkdir -p devlab-efemero && cd devlab-efemero
cat > ambiente.yaml <<'FIM'
AWSTemplateFormatVersion: '2010-09-09'
Description: Ambiente efemero do DevLab
Parameters:
  Ambiente:
    Type: String
    AllowedValues: [teste, prod]
    Default: teste
Conditions:
  EhProd: !Equals [!Ref Ambiente, prod]
Resources:
  Fila:
    Type: AWS::SQS::Queue
    Properties:
      MessageRetentionPeriod: !If [EhProd, 1209600, 3600]
  AlarmeFilaParada:
    Type: AWS::CloudWatch::Alarm
    Condition: EhProd
    Properties:
      AlarmDescription: Mensagem mais antiga da fila com mais de 5 minutos
      Namespace: AWS/SQS
      MetricName: ApproximateAgeOfOldestMessage
      Dimensions:
        - Name: QueueName
          Value: !GetAtt Fila.QueueName
      Statistic: Maximum
      Period: 60
      EvaluationPeriods: 5
      Threshold: 300
      ComparisonOperator: GreaterThanThreshold
Outputs:
  FilaUrl:
    Value: !Ref Fila
    Export:
      Name: !Sub '\${AWS::StackName}-FilaUrl'
FIM
aws cloudformation validate-template --template-body file://ambiente.yaml
\`\`\``;

  const ephemeralTestInstructions = `Rode um "teste de integração" contra o ambiente, lendo a URL da fila do output da stack — exatamente como um teste automatizado no pipeline faria:

\`\`\`bash
FILA=$(aws cloudformation describe-stacks --stack-name devlab-teste --query "Stacks[0].Outputs[?OutputKey=='FilaUrl'].OutputValue" --output text)
aws sqs send-message --queue-url "$FILA" --message-body "pedido-123"
aws sqs receive-message --queue-url "$FILA" --query "Messages[0].Body" --output text
\`\`\``;

  const testAutomationLabs: LabSeed[] = [
    {
      title: 'Testes unitários no CodeBuild com relatório',
      data: {
        level: 2,
        order: 1,
        estimatedMinutes: 30,
        objective:
          'Ao final deste laboratório você terá um projeto do AWS CodeBuild que roda testes unitários a partir de um `buildspec.yml`, publica o resultado num report group, e falha o build quando um teste quebra.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido a lição "Testes automatizados no pipeline: CodeBuild e buildspec" ajuda.',
        context:
          'Hoje os testes de uma aplicação só rodam quando alguém lembra de rodá-los no próprio computador. O primeiro passo para um pipeline confiável é um build automatizado que rode os testes sempre e falhe quando algum quebrar.',
        troubleshooting:
          '"Unknown runtime version" na fase install: a versão de Python precisa existir na imagem escolhida — confira a lista de runtimes da imagem na documentação do CodeBuild e ajuste `python: 3.12` no `buildspec.yml`. \n\n"YAML_FILE_ERROR" ou "buildspec.yml not found": o arquivo precisa estar na raiz do zip — confira com `unzip -l devlab-build.zip` que ele não está dentro de uma pasta. \n\nO build falha com AccessDenied no S3: confira se o bucket e a chave do objeto no projeto estão corretos e na mesma região do projeto. \n\nA aba "Reports" não mostra nada: o caminho em `base-directory`/`files` precisa bater com o arquivo gerado pelo pytest (`relatorios/unit.xml`).',
        cleanup:
          'Exclua o projeto `devlab-build` no CodeBuild e o report group `devlab-build-testes-unitarios`. Exclua o bucket com `aws s3 rb s3://NOME-DO-BUCKET --force`. A role de serviço criada pelo Console (`codebuild-devlab-build-service-role`) pode ser excluída no IAM.',
        costWarning:
          'O CodeBuild cobra por minuto de build; cada build deste laboratório leva cerca de 1 a 2 minutos na menor configuração, o que custa centavos (e contas elegíveis ao Free Tier têm minutos de build gratuitos por mês).',
      },
      steps: [
        {
          order: 1,
          title: 'Criar o código, o teste e o buildspec',
          instructions: codeBuildSourceInstructions,
          validation:
            '`aws s3 ls s3://NOME-DO-BUCKET` mostra `devlab-build.zip`, e `unzip -l devlab-build.zip` mostra `buildspec.yml` na raiz.',
        },
        {
          order: 2,
          title: 'Criar o projeto no CodeBuild',
          instructions:
            'No Console do CodeBuild, clique em "Create project". Nome: `devlab-build`. Em "Source", escolha **Amazon S3**, o bucket criado e a chave `devlab-build.zip`. Em "Environment", use uma imagem gerenciada Amazon Linux (a padrão sugerida pelo Console) com a menor capacidade de computação, e deixe o Console criar uma nova service role. Em "Buildspec", mantenha "Use a buildspec file". Crie o projeto.',
          validation: 'O projeto `devlab-build` aparece na lista de projetos de build.',
        },
        {
          order: 3,
          title: 'Rodar o build',
          instructions:
            'Clique em "Start build" e acompanhe as fases em "Phase details" e o log em "Build logs".',
          validation:
            'O build termina como **Succeeded**; o log mostra `2 passed` do pytest, e as fases aparecem na ordem `INSTALL` → `PRE_BUILD` → `BUILD` → `POST_BUILD`.',
        },
        {
          order: 4,
          title: 'Ver o relatório de testes',
          instructions: 'Abra a aba "Reports" do build (ou "Report groups" no menu do CodeBuild).',
          validation:
            'O report group `devlab-build-testes-unitarios` mostra um relatório com 2 testes, ambos com status "Succeeded".',
        },
        {
          order: 5,
          title: 'Quebrar um teste e ver o build falhar',
          instructions:
            'No CloudShell, altere o teste para esperar um valor errado e envie o zip de novo:\n\n```bash\ncd devlab-build\nsed -i "s/== 180/== 170/" tests/test_calculadora.py\nzip -r ../devlab-build.zip . && cd ..\naws s3 cp devlab-build.zip s3://NOME-DO-BUCKET/devlab-build.zip\n```\n\nRode um novo build no Console.',
          validation:
            'O build termina como **Failed** na fase `BUILD`, o log mostra `1 failed, 1 passed`, e o relatório aponta qual teste falhou — num pipeline, o deploy nem começaria.',
        },
      ],
    },
    {
      title: 'Ambiente de teste efêmero com CloudFormation',
      data: {
        level: 2,
        order: 2,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá criado um ambiente de teste a partir de um template com parâmetros e conditions, testado o ambiente usando os outputs da stack, previsto com um change set o que mudaria em produção, e destruído o ambiente.',
        prerequisites:
          'Conta AWS com acesso ao AWS CloudShell. Ter lido a lição "Ambientes de teste com infraestrutura como código" ajuda.',
        context:
          'Os testes de integração de um time rodam num ambiente de teste compartilhado que ninguém sabe como foi criado, e que vive quebrado por testes anteriores. A proposta é criar um ambiente novo a partir do template a cada execução, testar e destruir.',
        troubleshooting:
          '"Template format error": a indentação do YAML precisa ser exatamente a do exemplo (espaços, sem tabs); rode o `validate-template` de novo depois de corrigir. \n\n"No changes to deploy" no passo 4: o change set só é criado se algo mudar — confira se passou `Ambiente=prod`. \n\n`receive-message` não retorna nada: a mensagem pode levar um instante para aparecer — rode o comando de novo. \n\nA exclusão da stack falha com "Export ... cannot be deleted as it is in use": alguma outra stack importa o output — exclua a stack importadora primeiro.',
        cleanup:
          'O passo 5 já exclui a stack (e, com ela, a fila e o change set não executado). Confira com `aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE --query "StackSummaries[?StackName==\'devlab-teste\']"`.',
        costWarning:
          'O ambiente de teste tem só uma fila SQS, e as poucas requisições ficam dentro do Free Tier. O alarme de produção nunca é criado neste laboratório, porque o change set não é executado.',
      },
      steps: [
        {
          order: 1,
          title: 'Escrever e validar o template',
          instructions: ephemeralTemplateInstructions,
          validation:
            'O `validate-template` responde com a lista de `Parameters` (incluindo `Ambiente`) e a `Description` — o template está sintaticamente correto.',
        },
        {
          order: 2,
          title: 'Criar o ambiente de teste',
          instructions:
            'Rode:\n\n```bash\naws cloudformation deploy --template-file ambiente.yaml --stack-name devlab-teste --parameter-overrides Ambiente=teste\naws cloudformation describe-stack-resources --stack-name devlab-teste --query "StackResources[].LogicalResourceId"\n```',
          validation:
            'A stack é criada com um único recurso, `Fila`: como `Ambiente=teste`, a condition `EhProd` é falsa e o alarme não existe neste ambiente.',
        },
        {
          order: 3,
          title: 'Testar usando os outputs da stack',
          instructions: ephemeralTestInstructions,
          validation:
            'O último comando imprime `pedido-123` — o teste descobriu a fila pelo output da stack, sem nenhum nome fixo no código do teste.',
        },
        {
          order: 4,
          title: 'Prever a mudança para prod com um change set',
          instructions:
            'Crie um change set sem executá-lo:\n\n```bash\naws cloudformation deploy --template-file ambiente.yaml --stack-name devlab-teste --parameter-overrides Ambiente=prod --no-execute-changeset\n```\n\nNo Console do CloudFormation, abra a stack `devlab-teste`, aba "Change sets", e abra o change set criado.',
          validation:
            'O change set lista `AlarmeFilaParada` com ação **Add** e `Fila` com ação **Modify** (a retenção muda de 1 hora para 14 dias) — tudo visível antes de qualquer mudança real.',
        },
        {
          order: 5,
          title: 'Destruir o ambiente',
          instructions:
            'Rode `aws cloudformation delete-stack --stack-name devlab-teste` e depois `aws cloudformation wait stack-delete-complete --stack-name devlab-teste`.',
          validation:
            'O comando `wait` termina sem erro e a fila deixa de existir no Console do SQS — o ambiente efêmero sumiu por completo, e a próxima execução começa do zero.',
        },
      ],
    },
  ];

  await seedLabs(testAutomationTopic.id, testAutomationLabs);

  const testAutomationQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Em que ordem o AWS CodeBuild executa as fases de um buildspec?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation: 'As fases são executadas na ordem install, pre_build, build e post_build.',
      officialReferences: 'https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html',
      options: [
        { text: 'install → pre_build → build → post_build', isCorrect: true, explanation: 'Correto.' },
        { text: 'pre_build → install → build → post_build', isCorrect: false, explanation: 'install vem primeiro.' },
        { text: 'build → test → deploy', isCorrect: false, explanation: 'Esses não são nomes de fases do buildspec.' },
        { text: 'A ordem é definida pela posição das fases no arquivo.', isCorrect: false, explanation: 'A ordem das fases é fixa.' },
      ],
    },
    {
      prompt: 'Por padrão, onde o AWS CodeBuild procura as instruções de build de um projeto?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Por padrão, o CodeBuild procura um arquivo buildspec.yml na raiz do código-fonte. É possível informar outro nome/caminho ou um buildspec inline no projeto.',
      options: [
        { text: 'Num arquivo buildspec.yml na raiz do código-fonte.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Num arquivo appspec.yml na raiz do código-fonte.', isCorrect: false, explanation: 'O appspec é do CodeDeploy.' },
        { text: 'Numa pasta .codebuild/ obrigatória.', isCorrect: false, explanation: 'Não existe essa convenção.' },
        { text: 'Sempre num buildspec definido no Console, nunca no repositório.', isCorrect: false, explanation: 'O padrão é o arquivo no repositório.' },
      ],
    },
    {
      prompt:
        'Um time quer acompanhar, build a build, quantos testes passaram e falharam no AWS CodeBuild. O que deve ser configurado?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'A seção reports do buildspec publica arquivos de resultado (ex.: JUnit XML) num report group, que mostra os resultados e o histórico dos testes.',
      options: [
        {
          text: 'A seção reports do buildspec apontando para os arquivos de resultado (ex.: JUnit XML).',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'A seção artifacts com os arquivos de teste.', isCorrect: false, explanation: 'artifacts leva arquivos para os próximos stages, sem interpretar resultados.' },
        { text: 'A seção cache com a pasta de relatórios.', isCorrect: false, explanation: 'cache acelera builds, não exibe resultados.' },
        { text: 'Um alarme do CloudWatch no projeto.', isCorrect: false, explanation: 'Não mostra o resultado de cada teste.' },
      ],
    },
    {
      prompt:
        'Os testes de integração rodados no CodeBuild precisam da senha de um banco de testes, guardada no Secrets Manager. Como disponibilizá-la ao build sem escrevê-la no repositório?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Na seção env do buildspec, secrets-manager (ou parameter-store) mapeia uma variável de ambiente para o segredo; a service role do projeto precisa de permissão para lê-lo.',
      options: [
        {
          text: 'Mapear a variável na seção env/secrets-manager do buildspec e dar permissão à service role do projeto.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Colocar a senha em env/variables no buildspec.', isCorrect: false, explanation: 'O valor ficaria em texto claro no repositório.' },
        { text: 'Colocar a senha no nome do projeto.', isCorrect: false, explanation: 'Não faz sentido e exporia o valor.' },
        { text: 'Passar a senha como argumento de linha de comando fixo no buildspec.', isCorrect: false, explanation: 'Também fica no repositório e nos logs.' },
      ],
    },
    {
      prompt:
        'Cada build de um projeto Node.js no CodeBuild passa minutos baixando as mesmas dependências. Qual configuração reduz esse tempo?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation: 'A seção cache (com cache no S3 ou local) guarda caminhos como node_modules ou o cache do npm entre builds.',
      options: [
        { text: 'Configurar cache dos caminhos de dependências (S3 ou local).', isCorrect: true, explanation: 'Correto.' },
        { text: 'Aumentar o timeout do build.', isCorrect: false, explanation: 'Só permite builds mais longos.' },
        { text: 'Mover a instalação para post_build.', isCorrect: false, explanation: 'A instalação continuaria acontecendo a cada build.' },
        { text: 'Habilitar o modo privilegiado.', isCorrect: false, explanation: 'Serve para rodar Docker dentro do build.' },
      ],
    },
    {
      prompt:
        'Um pipeline deve garantir que só chegue à produção uma versão que passou em testes de integração num ambiente real, com aprovação de uma pessoa. Qual sequência de stages atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Build com testes unitários → deploy num ambiente de teste → ação de teste (CodeBuild) com testes de integração → aprovação manual → deploy em produção, sempre com o mesmo artefato.',
      options: [
        {
          text: 'Build (unitários) → deploy em teste → testes de integração → aprovação manual → deploy em produção.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Deploy em produção → testes de integração → aprovação manual.',
          isCorrect: false,
          explanation: 'Testa depois de expor a mudança aos clientes.',
        },
        {
          text: 'Build → aprovação manual → deploy em produção, sem ambiente de teste.',
          isCorrect: false,
          explanation: 'Não há testes de integração num ambiente real.',
        },
        {
          text: 'Build separado para teste e para produção, cada um com seu artefato.',
          isCorrect: false,
          explanation: 'O artefato testado deve ser o mesmo que vai para produção.',
        },
      ],
    },
    {
      prompt:
        'Os testes de integração de um time falham de forma intermitente porque vários pull requests compartilham o mesmo ambiente de teste. Qual abordagem resolve o problema?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Criar um ambiente efêmero a partir do template para cada pull request (uma stack por branch), rodar os testes contra ele e excluí-lo em seguida elimina a interferência entre execuções.',
      options: [
        {
          text: 'Criar uma stack efêmera por pull request a partir do template, testar e excluir.',
          isCorrect: true,
          explanation: 'Correto: cada execução tem seu próprio ambiente limpo.',
        },
        { text: 'Rodar os testes de integração só uma vez por semana.', isCorrect: false, explanation: 'Adia os problemas em vez de resolvê-los.' },
        { text: 'Aumentar os timeouts dos testes.', isCorrect: false, explanation: 'Não resolve a interferência entre execuções.' },
        { text: 'Rodar os testes de integração contra produção.', isCorrect: false, explanation: 'Coloca produção em risco.' },
      ],
    },
    {
      prompt:
        'Antes de atualizar uma stack de produção, um desenvolvedor quer ver exatamente quais recursos serão adicionados, modificados ou substituídos. Qual recurso do CloudFormation atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Um change set mostra as mudanças previstas — incluindo se um recurso será substituído — antes de ser executado.',
      options: [
        { text: 'Change set', isCorrect: true, explanation: 'Correto.' },
        { text: 'Drift detection', isCorrect: false, explanation: 'Compara a stack com o estado real, não prevê uma atualização.' },
        { text: 'Stack policy', isCorrect: false, explanation: 'Impede atualizações em recursos, mas não mostra o que vai mudar.' },
        { text: 'validate-template', isCorrect: false, explanation: 'Só verifica a sintaxe do template.' },
      ],
    },
    {
      prompt:
        'Um mesmo template é usado para os ambientes teste e prod. Alarmes do CloudWatch e retenção longa de mensagens só devem existir em prod. Como implementar isso no template?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'Um parâmetro Ambiente e uma condition (ex.: EhProd: !Equals [!Ref Ambiente, prod]) permitem criar recursos só em prod (Condition: EhProd) e escolher valores com !If.',
      options: [
        {
          text: 'Parâmetro Ambiente + Conditions (Condition nos alarmes e !If na retenção).',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Manter dois templates, um por ambiente.', isCorrect: false, explanation: 'Os templates divergem com o tempo.' },
        { text: 'Criar os alarmes manualmente depois do deploy de prod.', isCorrect: false, explanation: 'Fica fora do controle de versão e do template.' },
        { text: 'Usar Outputs com Export para ligar e desligar recursos.', isCorrect: false, explanation: 'Outputs publicam valores; não controlam a criação de recursos.' },
      ],
    },
    {
      prompt:
        'Uma stack de rede cria uma fila compartilhada, e várias stacks de aplicação precisam da URL dessa fila. Como compartilhar o valor entre stacks?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'A stack de rede declara um Output com Export, e as outras stacks o importam com Fn::ImportValue. A stack exportadora não pode ser excluída enquanto o valor estiver importado.',
      options: [
        {
          text: 'Output com Export na stack de rede e Fn::ImportValue nas stacks de aplicação.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Copiar a URL manualmente para cada template.', isCorrect: false, explanation: 'Quebra quando a fila muda.' },
        { text: 'Usar Mappings com a URL.', isCorrect: false, explanation: 'Mappings são valores fixos escritos no próprio template.' },
        { text: 'Usar Fn::GetAtt entre stacks.', isCorrect: false, explanation: 'GetAtt só referencia recursos da mesma stack.' },
      ],
    },
    {
      prompt:
        'Uma atualização de stack deve ser desfeita automaticamente se o alarme de taxa de erros da aplicação disparar durante o deploy ou logo após. Qual recurso do CloudFormation atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Rollback triggers (rollback configuration) fazem o CloudFormation monitorar alarmes do CloudWatch durante a operação e por um período configurável depois, e reverter a stack se algum disparar.',
      officialReferences:
        'https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-rollback-triggers.html',
      options: [
        { text: 'Rollback triggers com o alarme de taxa de erros.', isCorrect: true, explanation: 'Correto.' },
        { text: 'DeletionPolicy: Retain', isCorrect: false, explanation: 'Protege recursos na exclusão, não reverte atualizações.' },
        { text: 'Drift detection agendada.', isCorrect: false, explanation: 'Detecta mudanças manuais; não reverte deploys.' },
        { text: 'Termination protection', isCorrect: false, explanation: 'Impede a exclusão da stack.' },
      ],
    },
    {
      prompt:
        'Um ambiente efêmero de teste inclui uma tabela DynamoDB com dados de referência caros de recriar. Ao excluir a stack, a tabela deve ser mantida. O que usar no template?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation: 'DeletionPolicy: Retain faz o CloudFormation manter o recurso quando a stack é excluída.',
      options: [
        { text: 'DeletionPolicy: Retain na tabela.', isCorrect: true, explanation: 'Correto.' },
        { text: 'DeletionPolicy: Snapshot na tabela.', isCorrect: false, explanation: 'Snapshot não é suportado para tabelas DynamoDB; vale para RDS, EBS e outros.' },
        { text: 'Termination protection na stack.', isCorrect: false, explanation: 'Impede a exclusão de toda a stack, não só preserva a tabela.' },
        { text: 'Um Output com Export do nome da tabela.', isCorrect: false, explanation: 'Não preserva o recurso.' },
      ],
    },
    {
      prompt:
        'O ambiente de testes de integração de uma aplicação em containers às vezes testa uma imagem diferente da que vai para produção, porque os dois usam a tag latest. Como garantir que produção receba exatamente a imagem testada?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Referenciar a imagem por uma tag imutável e versionada (com tag immutability habilitada no ECR) ou pelo digest garante que o artefato aprovado nos testes seja o mesmo promovido para produção.',
      options: [
        {
          text: 'Usar uma tag imutável e versionada (ou o digest) da imagem em todos os ambientes, com tag immutability no ECR.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Reconstruir a imagem para produção a partir do mesmo commit.', isCorrect: false, explanation: 'Um novo build pode produzir uma imagem diferente da testada.' },
        { text: 'Continuar com latest e rodar os testes mais rápido.', isCorrect: false, explanation: 'latest continua mudando entre o teste e a produção.' },
        { text: 'Usar um repositório ECR por ambiente com a tag latest.', isCorrect: false, explanation: 'Não garante que a imagem promovida seja a testada.' },
      ],
    },
    {
      prompt:
        'Um time de frontend quer que cada pull request ganhe automaticamente um ambiente com URL própria para revisão, antes do merge. Qual serviço oferece isso pronto?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'O AWS Amplify cria ambientes por branch conectada do Git e previews para pull requests, cada um com URL própria.',
      options: [
        { text: 'AWS Amplify (previews de pull request).', isCorrect: true, explanation: 'Correto.' },
        { text: 'AWS CloudFormation StackSets.', isCorrect: false, explanation: 'StackSets implantam stacks em várias contas e regiões.' },
        { text: 'Amazon API Gateway stages.', isCorrect: false, explanation: 'Stages são criados manualmente e não por pull request.' },
        { text: 'AWS Elastic Beanstalk com .ebextensions.', isCorrect: false, explanation: 'Não cria ambientes por pull request automaticamente.' },
      ],
    },
  ];

  await seedQuestions(testAutomationTopic.id, testAutomationQuestionsToSeed);

  const testAutomationFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Fases do buildspec',
      conceptDescription: 'Estrutura e ordem das fases de um buildspec do CodeBuild.',
      serviceId: codeBuildService.id,
      front: 'Quais são as fases de um buildspec e onde fica o arquivo por padrão?',
      back: 'install → pre_build → build → post_build. O arquivo padrão é buildspec.yml na raiz do código-fonte. Um comando que falha na fase build faz o build falhar.',
    },
    {
      conceptName: 'Seções env, reports, artifacts e cache',
      conceptDescription: 'Seções de apoio do buildspec.',
      serviceId: codeBuildService.id,
      front: 'Para que servem as seções env, reports, artifacts e cache do buildspec?',
      back: 'env: variáveis (inclusive de Parameter Store e Secrets Manager). reports: resultados de testes num report group. artifacts: saídas para os próximos stages. cache: caminhos guardados entre builds.',
    },
    {
      conceptName: 'Modo privilegiado do CodeBuild',
      conceptDescription: 'Configuração necessária para rodar Docker dentro de um build.',
      serviceId: codeBuildService.id,
      front: 'O que é preciso para construir imagens Docker dentro do CodeBuild?',
      back: 'Habilitar o modo privilegiado (privileged mode) no ambiente do projeto.',
    },
    {
      conceptName: 'Testes num pipeline',
      conceptDescription: 'Posição de cada tipo de teste num pipeline de entrega contínua.',
      serviceId: codePipelineService.id,
      front: 'Qual a sequência típica de testes num pipeline até produção?',
      back: 'Build com testes unitários → deploy em teste → testes de integração (ação do CodeBuild) → aprovação manual → deploy em produção, sempre com o mesmo artefato.',
    },
    {
      conceptName: 'Parameters e Conditions',
      conceptDescription: 'Um template para vários ambientes no CloudFormation.',
      serviceId: cloudFormationService.id,
      front: 'Como criar um recurso só em produção usando o mesmo template?',
      back: 'Parâmetro Ambiente + condition (EhProd: !Equals [!Ref Ambiente, prod]); o recurso recebe Condition: EhProd, e valores variam com !If.',
    },
    {
      conceptName: 'Change sets',
      conceptDescription: 'Prévia das mudanças de uma atualização de stack.',
      serviceId: cloudFormationService.id,
      front: 'Como ver o que uma atualização de stack vai mudar antes de aplicá-la?',
      back: 'Com um change set: lista recursos adicionados, modificados e substituídos (Replacement), e só muda algo quando executado.',
    },
    {
      conceptName: 'Exports e ImportValue',
      conceptDescription: 'Compartilhamento de valores entre stacks.',
      serviceId: cloudFormationService.id,
      front: 'Como uma stack usa um valor criado por outra stack?',
      back: 'A stack de origem declara um Output com Export; a outra usa Fn::ImportValue. A stack exportadora não pode ser excluída enquanto o valor estiver importado.',
    },
    {
      conceptName: 'DeletionPolicy',
      conceptDescription: 'Proteção de recursos com dados na exclusão ou substituição.',
      serviceId: cloudFormationService.id,
      front: 'Como impedir que o CloudFormation apague dados ao excluir uma stack?',
      back: 'DeletionPolicy: Retain (mantém o recurso) ou Snapshot (RDS, EBS etc.); UpdateReplacePolicy faz o mesmo quando uma atualização substitui o recurso.',
    },
    {
      conceptName: 'Rollback triggers',
      conceptDescription: 'Rollback automático de stacks com base em alarmes.',
      serviceId: cloudFormationService.id,
      front: 'Como reverter automaticamente uma atualização de stack que aumentou os erros?',
      back: 'Com rollback triggers: o CloudFormation monitora alarmes do CloudWatch durante a operação e por um período depois, e faz rollback se algum disparar.',
    },
    {
      conceptName: 'Ambientes por branch no Amplify',
      conceptDescription: 'Ambientes automáticos por branch e pull request no AWS Amplify.',
      serviceId: amplifyService.id,
      front: 'Como ter um ambiente com URL própria para cada pull request de um frontend?',
      back: 'Com o AWS Amplify: ambientes por branch conectada e previews de pull request, criados automaticamente.',
    },
  ];

  await seedFlashcards(testAutomationTopic.id, testAutomationFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 9 of 12: Domain 3 "Deploy de código com
  // serviços de CI/CD da AWS", to the exam-readiness bar.
  // ---------------------------------------------------------------------

  const cicdTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: deploymentDomain.id, name: 'Deploy de código com serviços de CI/CD da AWS' },
  });

  const codeDeployServiceData = {
    shortName: 'CodeDeploy',
    category: 'Developer Tools',
    description:
      'Automatiza deploys em EC2/on-premises, Lambda e ECS, com estratégias in-place, blue/green, canary e linear e rollback automático.',
  };
  const codeDeployService = await prisma.aWSService.upsert({
    where: { name: 'AWS CodeDeploy' },
    update: codeDeployServiceData,
    create: { name: 'AWS CodeDeploy', ...codeDeployServiceData },
  });

  const cdkServiceData = {
    shortName: 'CDK',
    category: 'Developer Tools',
    description:
      'Define infraestrutura em linguagens de programação (TypeScript, Python, Java...) e a sintetiza em templates do CloudFormation.',
  };
  const cdkService = await prisma.aWSService.upsert({
    where: { name: 'AWS Cloud Development Kit' },
    update: cdkServiceData,
    create: { name: 'AWS Cloud Development Kit', ...cdkServiceData },
  });

  const codeDeployLessonContent = `## Objetivo

Ao final desta lição você vai conseguir montar um pipeline no AWS CodePipeline, configurar deploys no AWS CodeDeploy para EC2, Lambda e ECS, e escolher a estratégia de deploy e de rollback certa para cada cenário.

## CodePipeline

Um pipeline é uma sequência de **stages** (source, build, teste, aprovação, deploy), cada um com uma ou mais **actions**. Os artefatos passam de um stage para o outro através de um bucket S3 do pipeline. Pontos cobrados na prova:

- **Source**: GitHub, GitLab e Bitbucket via **AWS CodeConnections** (antigo CodeStar Connections) — a conexão nasce com status *Pending* e precisa ser autorizada no Console antes de funcionar; também há S3 e ECR como fontes.
- **Build/teste**: ações do CodeBuild. **Deploy**: CodeDeploy, CloudFormation, Elastic Beanstalk, ECS, S3, entre outros.
- **Aprovação manual**: pausa o pipeline até alguém aprovar (pode notificar por SNS).
- Se uma action falha, o pipeline para naquele stage. Mudanças de estado do pipeline viram eventos no EventBridge, que podem disparar notificações ou automações.

## CodeDeploy: conceitos

O CodeDeploy organiza deploys em **applications** e **deployment groups** (o conjunto de destinos: instâncias por tag ou Auto Scaling group, uma função Lambda, um serviço ECS), com uma **deployment configuration** (a velocidade) e um arquivo **\`appspec.yml\`** (o que fazer).

**EC2/on-premises**: exige o **agente do CodeDeploy** rodando nas instâncias e um instance profile com acesso ao S3 onde está a revisão. O \`appspec.yml\` fica na raiz da revisão e define \`files\` (o que copiar para onde) e \`hooks\` (scripts por evento do ciclo de vida). A ordem dos hooks principais: \`ApplicationStop\` → (DownloadBundle) → \`BeforeInstall\` → (Install) → \`AfterInstall\` → \`ApplicationStart\` → \`ValidateService\`. Os deploys podem ser **in-place** (atualiza as instâncias existentes, em lotes: \`AllAtOnce\`, \`HalfAtATime\`, \`OneAtATime\`) ou **blue/green** (sobe instâncias novas, troca o tráfego no load balancer e depois encerra as antigas).

**Lambda**: o deploy troca o peso de um **alias** entre a versão atual e a nova. Configurações: \`Canary10Percent5Minutes\` (10% por 5 minutos, depois 100%), \`Linear10PercentEvery1Minute\` (+10% a cada minuto) e \`AllAtOnce\`. Hooks: \`BeforeAllowTraffic\` e \`AfterAllowTraffic\`, funções Lambda que validam a versão nova antes e depois da troca.

**ECS**: deploy blue/green com um load balancer (ALB ou NLB) e **dois target groups**; o tráfego passa do conjunto de tasks original para o novo (de uma vez, canary ou linear), com hooks como \`BeforeAllowTraffic\` e \`AfterAllowTestTraffic\`, e um listener de teste opcional.

## Rollback

Um deployment group pode fazer **rollback automático** quando o deploy falha ou quando um **alarme do CloudWatch** associado dispara — o CodeDeploy volta para a última revisão boa (no Lambda, devolve 100% do tráfego à versão anterior). Em deploys blue/green, o ambiente antigo pode ser mantido por um tempo para um rollback instantâneo.

## Relação com a prova DVA-C02

Espere cenários sobre a ordem dos hooks do \`appspec.yml\`, o agente do CodeDeploy e o instance profile, canary vs. linear vs. all-at-once no Lambda, blue/green no ECS com dois target groups, rollback por alarme, aprovação manual e conexões pendentes do CodeConnections.`;

  const deployToolsLessonContent = `## Objetivo

Ao final desta lição você vai conseguir fazer deploys seguros com o AWS SAM, entender o ciclo do AWS CDK, escolher a política de deploy do Elastic Beanstalk e usar o Amplify Hosting para frontends.

## Deploys seguros com o SAM

O SAM integra o CodeDeploy direto no template de uma função:

- \`AutoPublishAlias: live\` publica uma nova versão a cada mudança de código e aponta o alias \`live\` para ela.
- \`DeploymentPreference\` com \`Type\` (ex.: \`Canary10Percent5Minutes\`, \`Linear10PercentEvery1Minute\`, \`AllAtOnce\`) faz a troca do alias ser gradual, via CodeDeploy — o SAM cria a application e o deployment group sozinho.
- \`Alarms\` lista alarmes do CloudWatch que disparam rollback automático, e \`Hooks\` (\`PreTraffic\`/\`PostTraffic\`) aponta funções de validação.

No primeiro deploy não há troca gradual — só existe uma versão. A partir do segundo, cada mudança de código vira um deploy canary ou linear.

## CDK

O AWS CDK descreve a infraestrutura em linguagens de programação, com **constructs** em três níveis: L1 (\`Cfn*\`, um para um com o CloudFormation), L2 (recursos com padrões sensatos, como \`lambda.Function\`) e L3 (patterns que combinam vários recursos). O ciclo:

- \`cdk bootstrap\` — uma vez por **conta e região**: cria a stack \`CDKToolkit\` com o bucket S3, o repositório ECR e as roles que o CDK usa para publicar artefatos. Sem ele, o primeiro deploy falha.
- \`cdk synth\` — sintetiza o template do CloudFormation (em \`cdk.out\`).
- \`cdk diff\` — compara com o que está implantado.
- \`cdk deploy\` — publica os artefatos e faz o deploy via CloudFormation.

**CDK Pipelines** criam um pipeline do CodePipeline que se atualiza sozinho a partir do próprio código do CDK.

## Políticas de deploy do Elastic Beanstalk

- **All at once**: atualiza todas as instâncias juntas — o mais rápido, com indisponibilidade; bom para desenvolvimento.
- **Rolling**: em lotes, com capacidade reduzida durante o deploy.
- **Rolling with additional batch**: sobe um lote extra antes, mantendo a capacidade total (com custo extra durante o deploy).
- **Immutable**: sobe um Auto Scaling group temporário com instâncias novas; se algo falhar, basta descartá-lo — o rollback mais seguro, sem reduzir capacidade.
- **Traffic splitting**: canary — manda uma porcentagem do tráfego para instâncias novas por um período de avaliação.
- **Blue/green** (fora das políticas): cria um segundo ambiente e troca as URLs (**swap environment URLs**, uma troca de CNAME) quando o novo estiver validado.

## Amplify Hosting

Para frontends (SPA, SSR), o Amplify Hosting conecta um repositório Git e faz build e deploy a cada push, por branch, com o build definido em \`amplify.yml\`, previews de pull request e rollback para qualquer deploy anterior.

## Relação com a prova DVA-C02

Espere cenários com \`AutoPublishAlias\` + \`DeploymentPreference\` + alarmes no SAM, \`cdk bootstrap\`/\`synth\`/\`deploy\`, a política certa do Elastic Beanstalk para cada exigência (velocidade, capacidade, rollback) e blue/green por troca de URL.`;

  const cicdLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 13,
      title: 'CodePipeline, CodeDeploy e estratégias de deploy',
      content: codeDeployLessonContent,
      resources: [
        {
          title: 'Configurações de deploy do CodeDeploy — documentação oficial',
          url: 'https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-configurations.html',
        },
        {
          title: 'Hooks do AppSpec — documentação oficial',
          url: 'https://docs.aws.amazon.com/codedeploy/latest/userguide/reference-appspec-file-structure-hooks.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 11,
      title: 'Deploy com SAM, CDK, Elastic Beanstalk e Amplify',
      content: deployToolsLessonContent,
      resources: [
        {
          title: 'Deploys graduais com o SAM — documentação oficial',
          url: 'https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/automating-updates-to-serverless-apps.html',
        },
        {
          title: 'Políticas de deploy do Elastic Beanstalk — documentação oficial',
          url: 'https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.rolling-version-deploy.html',
        },
      ],
    },
  ];

  await seedLessons(cicdTopic.id, cicdLessons);

  const canaryProjectInstructions = `No AWS CloudShell, crie um bucket para artefatos (troque \`NOME-DO-BUCKET\` por um nome único) e um projeto SAM com deploy canary:

\`\`\`bash
aws s3 mb s3://NOME-DO-BUCKET
mkdir -p devlab-canary/src && cd devlab-canary
cat > src/app.py <<'FIM'
def handler(event, context):
    return {"versao": "v1"}
FIM
cat > template.yaml <<'FIM'
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Resources:
  Funcao:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: devlab-canary
      Runtime: python3.13
      Handler: app.handler
      CodeUri: src/
      AutoPublishAlias: live
      DeploymentPreference:
        Type: Canary10Percent5Minutes
FIM
aws cloudformation package --template-file template.yaml --s3-bucket NOME-DO-BUCKET --output-template-file packaged.yaml
aws cloudformation deploy --template-file packaged.yaml --stack-name devlab-canary --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND
\`\`\``;

  const canaryWatchInstructions = `Enquanto o deploy do passo anterior roda, abra uma **segunda aba** do CloudShell (botão "+" no topo do terminal) e invoque o alias \`live\` 20 vezes:

\`\`\`bash
for i in $(seq 1 20); do
  aws lambda invoke --function-name devlab-canary --qualifier live saida.json > /dev/null
  cat saida.json; echo
done | sort | uniq -c
\`\`\``;

  const pipelineSourceInstructions = `No AWS CloudShell, crie o bucket de origem (com versionamento, exigido pelo CodePipeline para fontes S3), o bucket de destino do "site" e o pacote da aplicação. Troque \`ORIGEM\` e \`DESTINO\` por nomes únicos:

\`\`\`bash
aws s3 mb s3://ORIGEM
aws s3api put-bucket-versioning --bucket ORIGEM --versioning-configuration Status=Enabled
aws s3 mb s3://DESTINO
mkdir -p devlab-site/tests && cd devlab-site
echo '<h1>DevLab v1</h1>' > index.html
cat > tests/test_site.py <<'FIM'
def test_titulo():
    assert "<h1>" in open("index.html").read()
FIM
cat > buildspec.yml <<'FIM'
version: 0.2
phases:
  install:
    runtime-versions:
      python: 3.12
    commands:
      - pip install pytest
  build:
    commands:
      - python -m pytest
artifacts:
  files:
    - index.html
FIM
zip -r ../devlab-site.zip . && cd ..
aws s3 cp devlab-site.zip s3://ORIGEM/devlab-site.zip
\`\`\``;

  const cicdLabs: LabSeed[] = [
    {
      title: 'Deploy canary de uma função Lambda com SAM e CodeDeploy',
      data: {
        level: 2,
        order: 1,
        estimatedMinutes: 30,
        objective:
          'Ao final deste laboratório você terá publicado uma função com `AutoPublishAlias` e `DeploymentPreference` no SAM, e acompanhado o CodeDeploy mandar 10% do tráfego para a versão nova por 5 minutos antes de completar a troca.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido a lição "Deploy com SAM, CDK, Elastic Beanstalk e Amplify" e feito o laboratório de aliases do tópico anterior ajuda.',
        context:
          'Uma função crítica já quebrou produção num deploy que trocou 100% do tráfego de uma vez. O time quer que toda versão nova receba primeiro uma fração do tráfego, sem ninguém mexer em pesos de alias manualmente.',
        troubleshooting:
          '"Requires capabilities": o deploy precisa de `--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND` — o SAM cria roles para a função e para o CodeDeploy. \n\nO segundo deploy terminou na hora, sem canary: confira se o código mudou de fato (sem mudança, nenhuma versão nova é publicada) e se rodou o `package` de novo antes do `deploy`. \n\nNenhuma resposta `v2` no passo 4: o canary dura 5 minutos a partir do início do deploy — rode o laço logo depois de iniciar o deploy, ou repita-o enquanto o deployment aparecer como "In progress" no CodeDeploy.',
        cleanup:
          'No CloudShell, rode `aws cloudformation delete-stack --stack-name devlab-canary` (remove a função, o alias e a application do CodeDeploy) e `aws s3 rb s3://NOME-DO-BUCKET --force`.',
        costWarning:
          'O CodeDeploy não cobra por deploys em Lambda; as invocações e os poucos KB no S3 ficam dentro do Free Tier.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar e publicar a v1',
          instructions: canaryProjectInstructions,
          validation:
            'O deploy termina com sucesso. No Console do Lambda, a função `devlab-canary` tem a versão 1 e o alias `live` apontando para ela; no Console do CodeDeploy, existe uma application criada pelo SAM.',
        },
        {
          order: 2,
          title: 'Mudar o código para v2 e iniciar o deploy',
          instructions:
            'Ainda em `devlab-canary`, troque `"v1"` por `"v2"` em `src/app.py` (ex.: `sed -i "s/v1/v2/" src/app.py`) e rode de novo os comandos `aws cloudformation package` e `aws cloudformation deploy` do passo 1. Deixe o deploy rodando.',
          validation:
            'O deploy não termina logo: a stack fica em `UPDATE_IN_PROGRESS` enquanto o CodeDeploy faz a troca gradual.',
        },
        {
          order: 3,
          title: 'Acompanhar o deployment no CodeDeploy',
          instructions:
            'No Console do CodeDeploy, abra "Deployments" e o deployment em andamento.',
          validation:
            'O deployment mostra a configuração `Canary10Percent5Minutes`, com 10% do tráfego na versão 2 (original: versão 1) e o tempo restante até a troca completa.',
        },
        {
          order: 4,
          title: 'Invocar durante o canary',
          instructions: canaryWatchInstructions,
          validation:
            'A contagem mostra a maioria das respostas `v1` e algumas `v2` (em torno de 2 em 20): o alias `live` está com 10% na versão nova.',
        },
        {
          order: 5,
          title: 'Ver a troca completa',
          instructions:
            'Espere o deploy da primeira aba terminar (cerca de 5 minutos) e rode o laço de invocações de novo.',
          validation:
            'As 20 respostas são `v2`, o deployment aparece como "Succeeded" no CodeDeploy e o alias `live` aponta só para a versão 2 — sem ninguém ter mexido em pesos manualmente.',
        },
      ],
    },
    {
      title: 'Pipeline no CodePipeline com teste, aprovação manual e deploy',
      data: {
        level: 3,
        order: 2,
        estimatedMinutes: 40,
        objective:
          'Ao final deste laboratório você terá um pipeline no AWS CodePipeline que pega o código de um bucket S3, roda testes no CodeBuild, pausa para aprovação manual e publica o resultado noutro bucket — e verá um teste quebrado impedir o deploy.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter feito o laboratório de CodeBuild do tópico "Automação de testes de deploy" ajuda.',
        context:
          'O time já roda testes no CodeBuild, mas o deploy ainda é manual e às vezes publica código que não passou nos testes. Você vai ligar tudo num pipeline: nada chega ao destino sem passar pelos testes e por uma aprovação.',
        troubleshooting:
          'O stage Source falha com erro de versionamento: o bucket de origem precisa ter versionamento habilitado antes de criar o pipeline. \n\nO stage Build falha com "Unknown runtime version": ajuste `python: 3.12` no `buildspec.yml` para uma versão disponível na imagem escolhida. \n\nO stage Deploy falha com AccessDenied: a service role do pipeline precisa de permissão no bucket de destino — o assistente do Console cria essa role; confira se o bucket escolhido é o `DESTINO`. \n\nO pipeline não rodou depois do novo upload: clique em "Release change" para iniciar uma execução manualmente.',
        cleanup:
          'Exclua o pipeline `devlab-pipeline` e o projeto do CodeBuild criado pelo assistente. No CloudShell, esvazie e exclua os buckets: `aws s3 rb s3://ORIGEM --force`, `aws s3 rb s3://DESTINO --force` e o bucket de artefatos criado pelo pipeline (começa com `codepipeline-`). Com versionamento, se o `rb --force` falhar no bucket de origem, esvazie-o pelo botão "Empty" do Console antes.',
        costWarning:
          'Pipelines do tipo V2 cobram por minuto de execução de action, com uma cota gratuita mensal, e o CodeBuild cobra por minuto de build; as poucas execuções deste laboratório custam centavos. Exclua o pipeline ao final.',
      },
      steps: [
        {
          order: 1,
          title: 'Preparar os buckets e o código',
          instructions: pipelineSourceInstructions,
          validation: '`aws s3 ls s3://ORIGEM` mostra `devlab-site.zip`, e o bucket de origem tem versionamento habilitado.',
        },
        {
          order: 2,
          title: 'Criar o pipeline',
          instructions:
            'No Console do CodePipeline, crie um pipeline personalizado chamado `devlab-pipeline` (tipo V2, nova service role). **Source**: Amazon S3, bucket `ORIGEM`, chave `devlab-site.zip`. **Build**: AWS CodeBuild, criando um projeto novo pelo próprio assistente (imagem gerenciada Amazon Linux, buildspec do código-fonte). **Deploy**: Amazon S3, bucket `DESTINO`, marcando "Extract file before deploy". Crie o pipeline.',
          validation:
            'O pipeline começa a rodar sozinho e os três stages terminam como "Succeeded". `aws s3 ls s3://DESTINO` mostra `index.html`.',
        },
        {
          order: 3,
          title: 'Adicionar uma aprovação manual',
          instructions:
            'Edite o pipeline e adicione um stage `Aprovacao` entre Build e Deploy, com uma action do tipo "Manual approval". Salve.',
          validation: 'O pipeline passa a ter quatro stages: Source, Build, Aprovacao e Deploy.',
        },
        {
          order: 4,
          title: 'Publicar uma v2 passando pela aprovação',
          instructions:
            'No CloudShell, altere o site e envie o novo pacote:\n\n```bash\ncd devlab-site && echo \'<h1>DevLab v2</h1>\' > index.html\nzip -r ../devlab-site.zip . && cd ..\naws s3 cp devlab-site.zip s3://ORIGEM/devlab-site.zip\n```\n\nNo Console, clique em "Release change" (se o pipeline não iniciar sozinho). Quando o stage `Aprovacao` ficar aguardando, clique em "Review" e aprove.',
          validation:
            'O pipeline para em `Aprovacao` até a aprovação; depois disso, o Deploy roda e `aws s3 cp s3://DESTINO/index.html -` imprime `<h1>DevLab v2</h1>`.',
        },
        {
          order: 5,
          title: 'Quebrar o teste e ver o deploy ser bloqueado',
          instructions:
            'Envie uma versão sem `<h1>`:\n\n```bash\ncd devlab-site && echo \'<p>sem titulo</p>\' > index.html\nzip -r ../devlab-site.zip . && cd ..\naws s3 cp devlab-site.zip s3://ORIGEM/devlab-site.zip\n```\n\nInicie o pipeline de novo, se preciso, com "Release change".',
          validation:
            'O stage Build falha no teste, e os stages Aprovacao e Deploy nem são executados — `index.html` no bucket `DESTINO` continua com a v2.',
        },
      ],
    },
  ];

  await seedLabs(cicdTopic.id, cicdLabs);

  const cicdQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Qual arquivo o AWS CodeDeploy usa para saber o que instalar e quais scripts executar em cada etapa do deploy?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation: 'O appspec.yml (ou appspec.json para Lambda/ECS) define arquivos e hooks do deploy. O buildspec.yml é do CodeBuild.',
      options: [
        { text: 'appspec.yml', isCorrect: true, explanation: 'Correto.' },
        { text: 'buildspec.yml', isCorrect: false, explanation: 'É o arquivo do CodeBuild.' },
        { text: 'template.yaml', isCorrect: false, explanation: 'É o template do SAM/CloudFormation.' },
        { text: 'amplify.yml', isCorrect: false, explanation: 'É o build do Amplify Hosting.' },
      ],
    },
    {
      prompt: 'Num deploy do CodeDeploy em instâncias EC2, qual é a ordem dos hooks principais do appspec.yml?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'A ordem é ApplicationStop → BeforeInstall → AfterInstall → ApplicationStart → ValidateService (com DownloadBundle e Install executados pelo agente entre eles).',
      officialReferences:
        'https://docs.aws.amazon.com/codedeploy/latest/userguide/reference-appspec-file-structure-hooks.html',
      options: [
        {
          text: 'ApplicationStop → BeforeInstall → AfterInstall → ApplicationStart → ValidateService',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'BeforeInstall → ApplicationStop → ApplicationStart → AfterInstall → ValidateService',
          isCorrect: false,
          explanation: 'A aplicação é parada antes de tudo, e AfterInstall vem antes de ApplicationStart.',
        },
        {
          text: 'ValidateService → ApplicationStop → BeforeInstall → AfterInstall → ApplicationStart',
          isCorrect: false,
          explanation: 'ValidateService é o último hook.',
        },
        {
          text: 'BeforeAllowTraffic → AfterAllowTraffic',
          isCorrect: false,
          explanation: 'Esses são os hooks de deploys em Lambda.',
        },
      ],
    },
    {
      prompt: 'O que a configuração de deploy Canary10Percent5Minutes faz num deploy de Lambda pelo CodeDeploy?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation: 'Manda 10% do tráfego para a versão nova por 5 minutos e, se nada der errado, troca os 90% restantes de uma vez.',
      options: [
        {
          text: 'Manda 10% do tráfego para a versão nova por 5 minutos e depois os 90% restantes de uma vez.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        {
          text: 'Aumenta o tráfego da versão nova em 10% a cada 5 minutos.',
          isCorrect: false,
          explanation: 'Esse comportamento é de uma configuração linear.',
        },
        { text: 'Troca 100% do tráfego e faz rollback depois de 5 minutos.', isCorrect: false, explanation: 'Não é o que canary significa.' },
        { text: 'Faz o deploy em 10% das instâncias EC2 a cada 5 minutos.', isCorrect: false, explanation: 'Em Lambda, o que se divide é o tráfego do alias.' },
      ],
    },
    {
      prompt:
        'Num template SAM, como fazer cada mudança de código de uma função ser liberada gradualmente, com rollback automático se um alarme de erros disparar?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'AutoPublishAlias publica uma versão nova a cada mudança, e DeploymentPreference (Type, Alarms, Hooks) faz o SAM usar o CodeDeploy para trocar o alias gradualmente, com rollback pelos alarmes.',
      officialReferences:
        'https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/automating-updates-to-serverless-apps.html',
      options: [
        {
          text: 'AutoPublishAlias + DeploymentPreference com Type (ex.: Canary10Percent5Minutes) e Alarms.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Aumentar a concorrência reservada da função.', isCorrect: false, explanation: 'Não controla a liberação de versões.' },
        { text: 'Usar AllAtOnce com um alarme no CloudWatch sem DeploymentPreference.', isCorrect: false, explanation: 'Sem DeploymentPreference não há troca gradual nem rollback automático.' },
        { text: 'Criar dois templates, um para cada versão.', isCorrect: false, explanation: 'Não é como o SAM faz deploys graduais.' },
      ],
    },
    {
      prompt:
        'O primeiro cdk deploy numa conta e região novas falha dizendo que o ambiente não está preparado para o CDK. O que falta?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'É preciso rodar cdk bootstrap uma vez por conta e região. Ele cria a stack CDKToolkit, com o bucket S3, o repositório ECR e as roles que o CDK usa para publicar artefatos.',
      options: [
        { text: 'Rodar cdk bootstrap na conta e região.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Rodar cdk synth antes de cada deploy.', isCorrect: false, explanation: 'O deploy já sintetiza; o problema é a falta de bootstrap.' },
        { text: 'Converter o código do CDK para um template SAM.', isCorrect: false, explanation: 'Não é necessário.' },
        { text: 'Criar manualmente uma stack chamada cdk.out.', isCorrect: false, explanation: 'cdk.out é a pasta local de saída do synth.' },
      ],
    },
    {
      prompt:
        'Uma aplicação no Elastic Beanstalk precisa de deploys sem nenhuma redução de capacidade e com o rollback mais seguro possível, mesmo que o deploy demore mais. Qual política atende?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Immutable sobe instâncias novas num Auto Scaling group temporário; se algo falhar, basta descartá-lo, sem tocar nas instâncias atuais e sem reduzir capacidade.',
      options: [
        { text: 'Immutable', isCorrect: true, explanation: 'Correto.' },
        { text: 'All at once', isCorrect: false, explanation: 'Causa indisponibilidade durante o deploy.' },
        { text: 'Rolling', isCorrect: false, explanation: 'Reduz a capacidade enquanto cada lote é atualizado.' },
        { text: 'Rolling with additional batch', isCorrect: false, explanation: 'Mantém a capacidade, mas o rollback exige um novo deploy nas instâncias atualizadas.' },
      ],
    },
    {
      prompt:
        'Num ambiente de desenvolvimento do Elastic Beanstalk, o time quer o deploy mais rápido e barato possível, e uma breve indisponibilidade é aceitável. Qual política usar?',
      type: 'SCENARIO',
      difficulty: 'EASY',
      explanation: 'All at once atualiza todas as instâncias ao mesmo tempo: é o mais rápido e não cria instâncias extras, ao custo de indisponibilidade.',
      options: [
        { text: 'All at once', isCorrect: true, explanation: 'Correto.' },
        { text: 'Immutable', isCorrect: false, explanation: 'Cria instâncias novas; é mais lento e mais caro durante o deploy.' },
        { text: 'Traffic splitting', isCorrect: false, explanation: 'Adiciona um período de avaliação com instâncias extras.' },
        { text: 'Blue/green com troca de URL', isCorrect: false, explanation: 'Exige um segundo ambiente inteiro.' },
      ],
    },
    {
      prompt:
        'Um time quer fazer deploy blue/green de uma aplicação no Elastic Beanstalk, validando a nova versão num ambiente separado antes de mandar os usuários para ela. Como fazer a troca?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'Cria-se um segundo ambiente com a nova versão e, depois de validado, usa-se "Swap environment URLs" (troca de CNAME) para direcionar o tráfego a ele. O ambiente antigo fica disponível para uma volta rápida.',
      options: [
        {
          text: 'Criar um segundo ambiente com a nova versão e usar Swap environment URLs (troca de CNAME).',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Usar a política Rolling no ambiente atual.', isCorrect: false, explanation: 'Atualiza o próprio ambiente, sem um ambiente separado.' },
        { text: 'Alterar o .ebextensions do ambiente atual.', isCorrect: false, explanation: 'Muda a configuração, não a troca de ambientes.' },
        { text: 'Criar um stage novo no API Gateway.', isCorrect: false, explanation: 'Não tem relação com ambientes do Elastic Beanstalk.' },
      ],
    },
    {
      prompt:
        'Um time quer que o CodeDeploy desfaça automaticamente um deploy se a taxa de erros da aplicação subir. O que configurar no deployment group?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Associar um alarme do CloudWatch (ex.: taxa de erros) ao deployment group e habilitar rollback automático quando o alarme disparar.',
      options: [
        {
          text: 'Associar o alarme de erros ao deployment group e habilitar rollback automático por alarme.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Usar a configuração AllAtOnce.', isCorrect: false, explanation: 'Não traz rollback automático.' },
        { text: 'Criar uma aprovação manual depois do deploy.', isCorrect: false, explanation: 'Depende de uma pessoa e não reverte sozinha.' },
        { text: 'Aumentar o timeout dos hooks.', isCorrect: false, explanation: 'Não monitora a taxa de erros.' },
      ],
    },
    {
      prompt:
        'Num deploy de uma função Lambda pelo CodeDeploy, o time quer rodar testes automáticos na versão nova antes que ela receba qualquer tráfego de produção. Onde colocar esses testes?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'O hook BeforeAllowTraffic (PreTraffic no SAM) executa uma função de validação antes da troca de tráfego; se ela reportar falha, o deploy é interrompido e revertido.',
      options: [
        { text: 'Numa função no hook BeforeAllowTraffic (PreTraffic no SAM).', isCorrect: true, explanation: 'Correto.' },
        { text: 'No hook AfterAllowTraffic.', isCorrect: false, explanation: 'Roda depois que o tráfego já foi trocado.' },
        { text: 'No hook ApplicationStop.', isCorrect: false, explanation: 'É um hook de deploys em EC2.' },
        { text: 'No post_build do buildspec.', isCorrect: false, explanation: 'Roda no build, antes do deploy, não contra a versão publicada.' },
      ],
    },
    {
      prompt:
        'Um pipeline novo usa um repositório do GitHub como source, mas nunca é disparado; a conexão do CodeConnections aparece com status Pending. O que fazer?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Conexões criadas por CLI ou CloudFormation nascem como Pending e precisam ser autorizadas (handshake com o GitHub) no Console para ficarem Available.',
      options: [
        {
          text: 'Concluir a conexão no Console (autorizar o app da AWS no GitHub) para ela ficar Available.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Recriar o pipeline com o mesmo nome.', isCorrect: false, explanation: 'A conexão continuaria pendente.' },
        { text: 'Adicionar uma aprovação manual no stage Source.', isCorrect: false, explanation: 'Não resolve a conexão.' },
        { text: 'Trocar o CodeBuild por outro provedor de build.', isCorrect: false, explanation: 'O problema está na origem, não no build.' },
      ],
    },
    {
      prompt: 'O que é necessário para fazer deploy blue/green de um serviço ECS com o CodeDeploy?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'O deploy blue/green do ECS com CodeDeploy exige um Application ou Network Load Balancer com dois target groups (um para as tasks originais e outro para as novas), entre os quais o tráfego é trocado.',
      options: [
        { text: 'Um ALB ou NLB com dois target groups.', isCorrect: true, explanation: 'Correto.' },
        { text: 'O agente do CodeDeploy instalado em cada task.', isCorrect: false, explanation: 'O agente é para EC2/on-premises.' },
        { text: 'Um alias de função Lambda.', isCorrect: false, explanation: 'Aliases são usados em deploys de Lambda.' },
        { text: 'Um ambiente do Elastic Beanstalk.', isCorrect: false, explanation: 'Não é necessário para ECS.' },
      ],
    },
    {
      prompt:
        'Um deploy do CodeDeploy em instâncias EC2 falha antes de executar qualquer hook, e o log mostra que as instâncias nunca obtiveram a revisão do S3. Quais são as causas mais prováveis?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'Em EC2, o agente do CodeDeploy precisa estar instalado e rodando, e o instance profile precisa de permissão para ler a revisão no S3.',
      options: [
        {
          text: 'O agente do CodeDeploy não está rodando nas instâncias ou o instance profile não tem acesso ao bucket da revisão.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'O buildspec.yml está na pasta errada.', isCorrect: false, explanation: 'O buildspec é do CodeBuild.' },
        { text: 'Falta um alias na função Lambda.', isCorrect: false, explanation: 'O deploy é em EC2.' },
        { text: 'O pipeline não tem aprovação manual.', isCorrect: false, explanation: 'Não afeta o download da revisão.' },
      ],
    },
    {
      prompt: 'Qual comando do AWS CDK gera o template do CloudFormation a partir do código, sem fazer deploy?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation: 'cdk synth sintetiza o template (na pasta cdk.out). cdk deploy sintetiza e implanta; cdk diff compara com o que está implantado.',
      options: [
        { text: 'cdk synth', isCorrect: true, explanation: 'Correto.' },
        { text: 'cdk bootstrap', isCorrect: false, explanation: 'Prepara a conta/região para o CDK.' },
        { text: 'cdk deploy', isCorrect: false, explanation: 'Também faz o deploy.' },
        { text: 'cdk init', isCorrect: false, explanation: 'Cria um projeto novo.' },
      ],
    },
  ];

  await seedQuestions(cicdTopic.id, cicdQuestionsToSeed);

  const cicdFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Estrutura do CodePipeline',
      conceptDescription: 'Stages, actions, artefatos e fontes de um pipeline.',
      serviceId: codePipelineService.id,
      front: 'Como um pipeline do CodePipeline é organizado?',
      back: 'Em stages (source, build, teste, aprovação, deploy) com actions; artefatos passam por um bucket S3. GitHub entra via CodeConnections, que precisa ser autorizado (status Pending → Available).',
    },
    {
      conceptName: 'Hooks do appspec em EC2',
      conceptDescription: 'Ordem dos eventos do ciclo de vida de um deploy do CodeDeploy em EC2.',
      serviceId: codeDeployService.id,
      front: 'Qual a ordem dos hooks do appspec.yml num deploy em EC2?',
      back: 'ApplicationStop → BeforeInstall → AfterInstall → ApplicationStart → ValidateService. Exige o agente do CodeDeploy e um instance profile com acesso à revisão no S3.',
    },
    {
      conceptName: 'Configurações de deploy para Lambda',
      conceptDescription: 'Canary, linear e all-at-once no CodeDeploy para Lambda.',
      serviceId: codeDeployService.id,
      front: 'Qual a diferença entre Canary10Percent5Minutes e Linear10PercentEvery1Minute?',
      back: 'Canary: 10% por 5 minutos, depois o resto de uma vez. Linear: +10% a cada minuto até 100%. Hooks: BeforeAllowTraffic e AfterAllowTraffic.',
    },
    {
      conceptName: 'Blue/green no ECS',
      conceptDescription: 'Requisitos de um deploy blue/green do ECS com CodeDeploy.',
      serviceId: codeDeployService.id,
      front: 'O que um deploy blue/green do ECS com CodeDeploy exige?',
      back: 'Um ALB ou NLB com dois target groups (original e novo); o tráfego é trocado de uma vez, canary ou linear.',
    },
    {
      conceptName: 'Rollback no CodeDeploy',
      conceptDescription: 'Rollback automático por falha ou alarme.',
      serviceId: codeDeployService.id,
      front: 'Como o CodeDeploy desfaz um deploy ruim automaticamente?',
      back: 'Com rollback automático no deployment group, por falha do deploy ou por um alarme do CloudWatch associado; volta para a última revisão boa.',
    },
    {
      conceptName: 'Deploy seguro no SAM',
      conceptDescription: 'AutoPublishAlias e DeploymentPreference no AWS SAM.',
      serviceId: cloudFormationService.id,
      front: 'Como liberar gradualmente cada versão de uma função no SAM?',
      back: 'AutoPublishAlias (versão nova + alias a cada mudança) e DeploymentPreference com Type (canary/linear), Alarms (rollback) e Hooks (PreTraffic/PostTraffic).',
    },
    {
      conceptName: 'Ciclo do CDK',
      conceptDescription: 'Comandos principais do AWS CDK.',
      serviceId: cdkService.id,
      front: 'Para que servem cdk bootstrap, synth, diff e deploy?',
      back: 'bootstrap: prepara conta/região (stack CDKToolkit), uma vez. synth: gera o template. diff: compara com o implantado. deploy: publica via CloudFormation.',
    },
    {
      conceptName: 'Constructs do CDK',
      conceptDescription: 'Níveis de abstração dos constructs do CDK.',
      serviceId: cdkService.id,
      front: 'O que são constructs L1, L2 e L3 no CDK?',
      back: 'L1: Cfn*, um para um com o CloudFormation. L2: recursos com padrões sensatos (ex.: lambda.Function). L3: patterns que combinam vários recursos.',
    },
    {
      conceptName: 'Políticas de deploy do Elastic Beanstalk',
      conceptDescription: 'All at once, rolling, rolling with additional batch, immutable e traffic splitting.',
      serviceId: beanstalkService.id,
      front: 'Quando usar cada política de deploy do Elastic Beanstalk?',
      back: 'All at once: rápido, com indisponibilidade. Rolling: capacidade reduzida. Rolling with additional batch: mantém capacidade. Immutable: instâncias novas, rollback mais seguro. Traffic splitting: canary.',
    },
    {
      conceptName: 'Blue/green no Elastic Beanstalk',
      conceptDescription: 'Troca de ambientes por CNAME no Elastic Beanstalk.',
      serviceId: beanstalkService.id,
      front: 'Como fazer blue/green no Elastic Beanstalk?',
      back: 'Criar um segundo ambiente com a versão nova e, depois de validado, usar Swap environment URLs (troca de CNAME). O antigo fica para voltar rápido.',
    },
  ];

  await seedFlashcards(cicdTopic.id, cicdFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 10 of 12: Domain 4 "Análise de causa
  // raiz", to the exam-readiness bar.
  // ---------------------------------------------------------------------

  const troubleshootingDomain = await prisma.domain.findUniqueOrThrow({
    where: { examVersionId_code: { examVersionId: examVersion.id, code: 'domain-4' } },
  });
  const rootCauseTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: troubleshootingDomain.id, name: 'Análise de causa raiz' },
  });

  const xrayServiceData = {
    shortName: 'X-Ray',
    category: 'Developer Tools',
    description:
      'Rastreia requisições de ponta a ponta entre serviços, mostrando latência, erros e dependências num mapa de serviços.',
  };
  const xrayService = await prisma.aWSService.upsert({
    where: { name: 'AWS X-Ray' },
    update: xrayServiceData,
    create: { name: 'AWS X-Ray', ...xrayServiceData },
  });

  const cloudTrailServiceData = {
    shortName: 'CloudTrail',
    category: 'Management & Governance',
    description: 'Registra as chamadas de API feitas na conta — quem fez o quê, quando e de onde — para auditoria e investigação.',
  };
  const cloudTrailService = await prisma.aWSService.upsert({
    where: { name: 'AWS CloudTrail' },
    update: cloudTrailServiceData,
    create: { name: 'AWS CloudTrail', ...cloudTrailServiceData },
  });

  const logsMetricsLessonContent = `## Objetivo

Ao final desta lição você vai conseguir investigar uma falha usando CloudWatch Logs Insights, as métricas certas do Lambda e do API Gateway, e interpretar os códigos HTTP e as exceções de SDK que a prova DVA-C02 cobra.

## Logs no CloudWatch

Os logs ficam em **log groups** (um por aplicação ou função — no Lambda, \`/aws/lambda/nome-da-funcao\`), divididos em **log streams** (no Lambda, um por ambiente de execução). A retenção padrão é "nunca expirar"; defina uma retenção para controlar custo. Cada invocação do Lambda termina com uma linha \`REPORT\` com \`Duration\`, \`Billed Duration\`, \`Memory Size\`, \`Max Memory Used\` e, em cold starts, \`Init Duration\`.

Mensagens clássicas do Lambda:

- \`Task timed out after 3.00 seconds\` — a função passou do timeout configurado (padrão de 3 s, máximo de 15 min).
- \`Runtime.ImportModuleError\` — handler ou dependência não encontrados no pacote.
- \`Max Memory Used\` igual ao \`Memory Size\`, seguido de erro do runtime — falta de memória.

## CloudWatch Logs Insights

Logs Insights consulta um ou mais log groups com uma linguagem de pipes, e descobre automaticamente os campos de logs em JSON:

\`\`\`
fields @timestamp, @message
| filter nivel = "ERROR"
| sort @timestamp desc
| limit 20
\`\`\`

Os comandos mais usados: \`fields\` (escolhe campos), \`filter\` (condições, inclusive \`like /regex/\`), \`stats\` (agregações como \`count(*)\`, \`avg()\`, \`max()\`, \`pct()\`, agrupadas com \`by\` ou \`bin(5m)\`), \`sort\`, \`limit\` e \`parse\` (extrai campos de texto). Para as linhas \`REPORT\` do Lambda, existem campos prontos: \`filter @type = "REPORT" | stats avg(@duration), max(@maxMemoryUsed)\`. Logging estruturado em JSON é o que torna esse tipo de consulta simples.

**Metric filters** transformam padrões de log em métricas do CloudWatch (ex.: contar linhas com \`"estoque indisponivel"\`), que podem ter alarmes.

## Métricas que apontam a causa

- **Lambda**: \`Invocations\`, \`Errors\` (exceções e timeouts), \`Throttles\` (limite de concorrência atingido), \`Duration\`, \`ConcurrentExecutions\`, \`IteratorAge\` (atraso ao consumir streams do Kinesis/DynamoDB) e \`DeadLetterErrors\`.
- **API Gateway**: \`4XXError\`, \`5XXError\`, \`Count\`, \`Latency\` (tempo total) e \`IntegrationLatency\` (só o backend) — se \`Latency\` é alta mas \`IntegrationLatency\` é baixa, o tempo está no próprio API Gateway (autorizador, transformações); se as duas são altas, o problema está no backend.

## Códigos HTTP

- **400** requisição inválida; **401** sem autenticação; **403** autenticado sem permissão (ou chave de API/WAF barrando); **404** recurso ou rota inexistente; **429** throttling — repetir com backoff exponencial.
- **500** erro interno; **502** bad gateway — no API Gateway com integração Lambda proxy, costuma ser resposta mal formada da função (sem \`statusCode\`, ou \`body\` que não é string) ou uma exceção na função; **503** serviço indisponível; **504** timeout da integração (o API Gateway espera até 29 s por padrão).

## Exceções de SDK

- \`ThrottlingException\`, \`ProvisionedThroughputExceededException\`, \`TooManyRequestsException\` — repetíveis com backoff.
- \`AccessDeniedException\` / \`UnauthorizedOperation\` — falta permissão na role ou numa resource policy.
- \`ResourceNotFoundException\` — nome errado ou região errada.
- \`ValidationException\` — parâmetros inválidos; não adianta repetir.
- \`ConditionalCheckFailedException\` — condição de escrita não atendida (esperado em optimistic locking).
- \`ExpiredTokenException\` — credenciais temporárias expiradas.

## Relação com a prova DVA-C02

Espere consultas de Logs Insights, a métrica certa para cada sintoma (\`Throttles\`, \`IteratorAge\`, \`IntegrationLatency\`), o significado de 403/429/502/504 no API Gateway, e a ação certa para cada exceção de SDK.`;

  const tracingLessonContent = `## Objetivo

Ao final desta lição você vai conseguir usar o AWS X-Ray para encontrar qual serviço causa erros ou lentidão numa requisição distribuída, e diagnosticar falhas de deploy com os eventos e logs de cada serviço.

## X-Ray: traces, segmentos e mapa

Um **trace** acompanha uma requisição de ponta a ponta. Cada serviço que ela atravessa grava um **segment**, e chamadas dentro dele (ao DynamoDB, a uma API HTTP, a um trecho de código) viram **subsegments**. Com isso, o X-Ray monta o **trace map** (mapa de serviços): cada nó mostra latência média e porcentagens de **errors** (respostas 4xx), **faults** (5xx) e **throttles** (429).

- **Annotations** são pares chave-valor **indexados**: dá para filtrar traces por eles (ex.: \`annotation.cliente = "123"\`). **Metadata** guarda qualquer dado extra, mas **não** é indexado nem filtrável.
- **Filter expressions** buscam traces: \`responsetime > 2\`, \`fault = true\`, \`http.status = 502\`, \`service("minha-funcao")\`.
- **Sampling**: por padrão, o X-Ray grava a primeira requisição de cada segundo e 5% das demais; **sampling rules** ajustam isso por serviço, rota ou método.

## Habilitando o X-Ray

- **Lambda**: ativar o **active tracing** na função (a role precisa de \`xray:PutTraceSegments\` e \`xray:PutTelemetryRecords\`). Para ver as chamadas que a função faz a outros serviços como subsegments, o código precisa ser instrumentado (X-Ray SDK ou AWS Distro for OpenTelemetry).
- **API Gateway** (APIs REST): habilitar o X-Ray tracing no stage.
- **EC2 e ECS**: rodar o **X-Ray daemon** (ou o CloudWatch agent / ADOT collector), que recebe os segments via **UDP na porta 2000** e os envia à AWS; a instance role ou task role precisa das permissões de escrita no X-Ray. Sem daemon ou sem permissão, a aplicação roda normalmente, mas nenhum trace aparece.

## Diagnosticando falhas de deploy

- **CloudFormation**: na aba "Events", a causa real é o **primeiro** evento \`CREATE_FAILED\`/\`UPDATE_FAILED\` — os que vêm depois costumam ser consequência do rollback. Uma stack em \`UPDATE_ROLLBACK_FAILED\` precisa que a causa seja corrigida e depois um **continue update rollback** (podendo pular recursos).
- **CodeDeploy**: cada lifecycle event mostra o resultado dos scripts; nas instâncias EC2, os logs do agente e dos scripts ficam em \`/opt/codedeploy-agent/deployment-root/\`.
- **CodeBuild**: o log do build (no Console e no CloudWatch Logs) mostra em que fase e comando falhou.
- **CloudTrail**: registra as chamadas de API da conta — quem mudou uma configuração, de onde, e quais chamadas receberam \`AccessDenied\` — essencial quando algo "parou de funcionar sozinho".

## Relação com a prova DVA-C02

Espere cenários pedindo o X-Ray para achar o serviço lento ou com falhas, annotations vs. metadata, sampling, o daemon na porta UDP 2000 com as permissões da role, o primeiro evento de falha do CloudFormation e o CloudTrail para descobrir quem mudou o quê.`;

  const rootCauseLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 12,
      title: 'Investigando falhas com logs, métricas e códigos de erro',
      content: logsMetricsLessonContent,
      resources: [
        {
          title: 'Sintaxe de consultas do CloudWatch Logs Insights — documentação oficial',
          url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html',
        },
        {
          title: 'Métricas de funções Lambda — documentação oficial',
          url: 'https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 11,
      title: 'Rastreando requisições com X-Ray e diagnosticando deploys',
      content: tracingLessonContent,
      resources: [
        {
          title: 'Conceitos do AWS X-Ray — documentação oficial',
          url: 'https://docs.aws.amazon.com/xray/latest/devguide/xray-concepts.html',
        },
        {
          title: 'Solução de problemas do CloudFormation — documentação oficial',
          url: 'https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/troubleshooting.html',
        },
      ],
    },
  ];

  await seedLessons(rootCauseTopic.id, rootCauseLessons);

  const failingFunctionInstructions = `No Console do Lambda, crie a função \`devlab-falhas\` com Python 3.13 (mantenha o timeout padrão de 3 segundos). Substitua o código por este, que falha em ~20% das chamadas e passa do timeout em ~10%, sempre com logs em JSON, e clique em "Deploy":

\`\`\`python
import json
import random
import time


def lambda_handler(event, context):
    pedido = event.get("pedido", 0)
    sorteio = random.random()
    if sorteio < 0.2:
        print(json.dumps({"nivel": "ERROR", "pedido": pedido, "erro": "estoque indisponivel"}))
        raise RuntimeError("estoque indisponivel")
    if sorteio < 0.3:
        time.sleep(5)  # passa do timeout padrão de 3 s
    print(json.dumps({"nivel": "INFO", "pedido": pedido, "status": "processado"}))
    return {"pedido": pedido, "status": "processado"}
\`\`\``;

  const failingInvokeInstructions = `No AWS CloudShell, gere tráfego com 30 invocações:

\`\`\`bash
for i in $(seq 1 30); do
  aws lambda invoke --function-name devlab-falhas --cli-binary-format raw-in-base64-out --payload "{\\"pedido\\": $i}" saida.json > /dev/null
done
echo concluido
\`\`\``;

  const insightsQueriesInstructions = `No Console do CloudWatch, abra "Logs Insights", selecione o log group \`/aws/lambda/devlab-falhas\` e o intervalo das últimas horas. Rode, uma de cada vez:

\`\`\`
fields @timestamp, pedido, erro
| filter nivel = "ERROR"
| sort @timestamp desc
\`\`\`

\`\`\`
filter @message like /timed out|timeout/
| stats count(*) as timeouts
\`\`\`

\`\`\`
filter @type = "REPORT"
| stats count(*) as invocacoes, avg(@duration) as media_ms, max(@duration) as max_ms
\`\`\``;

  const proxyCodeInstructions = `A resposta 502 vem de a função devolver um objeto qualquer, e não o formato que a integração **Lambda proxy** exige. Corrija o código da função \`devlab-falhas\` para ler o pedido da query string e devolver \`statusCode\` e \`body\` (string), e clique em "Deploy":

\`\`\`python
import json
import random
import time


def lambda_handler(event, context):
    params = event.get("queryStringParameters") or {}
    pedido = params.get("pedido", "0")
    sorteio = random.random()
    if sorteio < 0.2:
        print(json.dumps({"nivel": "ERROR", "pedido": pedido, "erro": "estoque indisponivel"}))
        raise RuntimeError("estoque indisponivel")
    if sorteio < 0.3:
        time.sleep(5)
    return {"statusCode": 200, "body": json.dumps({"pedido": pedido, "status": "processado"})}
\`\`\`

Depois repita o laço de \`curl\` do passo anterior.`;

  const curlLoopInstructions = `Copie a Invoke URL do stage \`teste\` e, no CloudShell, faça 20 chamadas contando os códigos HTTP (troque \`URL-DO-STAGE\`):

\`\`\`bash
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\\n" "URL-DO-STAGE/pedido?pedido=$i"
done | sort | uniq -c
\`\`\``;

  const rootCauseLabs: LabSeed[] = [
    {
      title: 'Investigar falhas de uma função com CloudWatch Logs Insights',
      data: {
        level: 2,
        order: 1,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá gerado tráfego numa função que falha de forma intermitente e usado o CloudWatch Logs Insights e as métricas do Lambda para quantificar erros, timeouts e duração.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido a lição "Investigando falhas com logs, métricas e códigos de erro" ajuda.',
        context:
          'Clientes reclamam que "às vezes o pedido não é processado". Ninguém sabe se é um erro de código, lentidão ou as duas coisas, nem com que frequência acontece. Você vai responder com dados dos logs.',
        troubleshooting:
          'Logs Insights não mostra o campo `nivel`: ele só é descoberto em linhas que são JSON válido — confira se o código usa `json.dumps` e amplie o intervalo de tempo da consulta. \n\nA consulta de timeouts retorna 0: com ~10% de chance por chamada, pode não ter ocorrido nenhum em 30 invocações — rode o laço de novo. \n\n"Invalid base64" no `invoke`: faltou `--cli-binary-format raw-in-base64-out` no comando.',
        cleanup:
          'Se não for fazer o próximo laboratório (que reaproveita esta função), exclua a função `devlab-falhas` e o log group `/aws/lambda/devlab-falhas`.',
        costWarning:
          'As invocações ficam dentro do Free Tier do Lambda. O Logs Insights cobra por GB analisado, e os poucos KB deste laboratório custam praticamente nada.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar a função instável',
          instructions: failingFunctionInstructions,
          validation: 'Um teste com o evento `{"pedido": 1}` no Console às vezes sucede, às vezes falha ou estoura o tempo.',
        },
        {
          order: 2,
          title: 'Gerar tráfego',
          instructions: failingInvokeInstructions,
          validation: 'O laço termina com `concluido`; algumas chamadas demoram mais (as que estouram o timeout de 3 s).',
        },
        {
          order: 3,
          title: 'Consultar com Logs Insights',
          instructions: insightsQueriesInstructions,
          validation:
            'A primeira consulta lista os pedidos com erro (cerca de 20% das 30 chamadas), a segunda conta os timeouts e a terceira mostra 30 invocações com `max_ms` perto de 3000 — o teto de timeout.',
        },
        {
          order: 4,
          title: 'Conferir as métricas do Lambda',
          instructions:
            'Na página da função, abra a aba "Monitor" e observe os gráficos de "Invocations", "Error count and success rate" e "Duration".',
          validation:
            'A contagem de erros inclui tanto as exceções quanto os timeouts (as duas coisas contam na métrica `Errors`), e o gráfico de duração mostra picos em ~3 s.',
        },
        {
          order: 5,
          title: 'Escrever o diagnóstico',
          instructions:
            'Com os números das consultas, responda: qual porcentagem das chamadas falha por erro de negócio, qual porcentagem por timeout, e qual seria a primeira ação para cada caso?',
          validation:
            'O diagnóstico separa duas causas diferentes: ~20% de exceções "estoque indisponivel" (tratar o erro e devolver uma resposta adequada) e ~10% de timeouts (investigar a lentidão ou ajustar o timeout) — em vez de um genérico "às vezes falha".',
        },
      ],
    },
    {
      title: 'Rastrear requisições com X-Ray pelo API Gateway',
      data: {
        level: 2,
        order: 2,
        estimatedMinutes: 30,
        objective:
          'Ao final deste laboratório você terá exposto uma função por uma API REST com X-Ray habilitado, diagnosticado um erro 502 real, e usado o trace map e filter expressions do X-Ray para achar requisições com falha e lentas.',
        prerequisites:
          'A função `devlab-falhas` do laboratório anterior e acesso ao AWS CloudShell. Ter lido a lição "Rastreando requisições com X-Ray e diagnosticando deploys" ajuda.',
        context:
          'A função instável agora vai ser chamada por uma API. O time quer enxergar cada requisição de ponta a ponta — da API até a função — e saber onde o tempo e os erros acontecem.',
        troubleshooting:
          'Todas as chamadas voltam 502 mesmo depois do passo 4: confira se clicou em "Deploy" na função e se o código devolve `statusCode` e `body` como string. \n\n`{"message":"Missing Authentication Token"}`: a URL está sem o caminho `/pedido` ou com o stage errado. \n\nO trace map não aparece: o X-Ray leva até um minuto para processar os traces — confira se o tracing está ativo no stage `teste` e na função, e gere tráfego de novo. \n\n"The role defined for the function cannot be assumed" ou falta de permissão ao ativar o tracing: aceite a permissão que o Console oferece adicionar à role de execução.',
        cleanup:
          'Exclua a API `devlab-rastreio` no API Gateway, a função `devlab-falhas` e o log group `/aws/lambda/devlab-falhas`.',
        costWarning:
          'O X-Ray tem uma cota gratuita mensal de traces gravados e consultados, e as poucas chamadas à API e à função deste laboratório custam frações de centavo.',
      },
      steps: [
        {
          order: 1,
          title: 'Ativar o tracing na função',
          instructions:
            'Na função `devlab-falhas`, vá em "Configuration" > "Monitoring and operations tools", clique em "Edit" e ative **Active tracing** do X-Ray. Salve (aceitando a permissão de escrita no X-Ray que o Console adiciona à role).',
          validation: 'A configuração mostra "Active tracing: Enabled".',
        },
        {
          order: 2,
          title: 'Criar a API com tracing',
          instructions:
            'No API Gateway, crie uma **REST API** `devlab-rastreio`, um recurso `/pedido` e um método `GET` com integração **Lambda proxy** apontando para `devlab-falhas`. Faça "Deploy API" num novo stage `teste` e, nas configurações de logs e rastreamento do stage, habilite o **X-Ray tracing**.',
          validation: 'O stage `teste` aparece com X-Ray tracing habilitado e uma Invoke URL.',
        },
        {
          order: 3,
          title: 'Chamar a API e ver o 502',
          instructions: curlLoopInstructions,
          validation:
            'Todas as 20 chamadas voltam **502**: a função atual devolve um objeto sem `statusCode`/`body`, que a integração proxy não aceita — é o erro "Malformed Lambda proxy response".',
        },
        {
          order: 4,
          title: 'Corrigir a resposta da função',
          instructions: proxyCodeInstructions,
          validation:
            'Agora a maioria das chamadas volta **200**, e cerca de 30% voltam **502** — as exceções e os timeouts da função, que a API repassa como bad gateway.',
        },
        {
          order: 5,
          title: 'Investigar no X-Ray',
          instructions:
            'No Console do CloudWatch, abra "X-Ray traces" > "Trace map" e depois "Traces". Filtre com `fault = true` e, em seguida, com `responsetime > 2`. Abra um trace de cada filtro.',
          validation:
            'O trace map mostra cliente → `devlab-rastreio/teste` → `devlab-falhas` com porcentagem de faults. O trace com falha mostra a exceção `RuntimeError: estoque indisponivel` no segmento da função, e o trace lento mostra a função ocupando ~3 s da linha do tempo — a causa de cada 502 identificada por requisição.',
        },
      ],
    },
  ];

  await seedLabs(rootCauseTopic.id, rootCauseLabs);

  const rootCauseQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Qual código HTTP indica que o cliente está sendo limitado por excesso de requisições (throttling)?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation: '429 Too Many Requests indica throttling; o cliente deve repetir com backoff exponencial e jitter.',
      options: [
        { text: '429', isCorrect: true, explanation: 'Correto.' },
        { text: '403', isCorrect: false, explanation: 'Indica falta de permissão.' },
        { text: '404', isCorrect: false, explanation: 'Indica recurso inexistente.' },
        { text: '503', isCorrect: false, explanation: 'Indica serviço indisponível, não throttling do cliente.' },
      ],
    },
    {
      prompt: 'No AWS X-Ray, qual é a diferença entre annotations e metadata?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'Annotations são pares chave-valor indexados, usados em filter expressions para buscar traces. Metadata guarda dados extras de qualquer tipo, mas não é indexado.',
      officialReferences: 'https://docs.aws.amazon.com/xray/latest/devguide/xray-concepts.html',
      options: [
        {
          text: 'Annotations são indexadas e filtráveis; metadata não é indexada.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Metadata é indexada; annotations não.', isCorrect: false, explanation: 'É o contrário.' },
        { text: 'As duas são indexadas; a diferença é só o tamanho.', isCorrect: false, explanation: 'Só annotations são indexadas.' },
        { text: 'Annotations só existem em funções Lambda.', isCorrect: false, explanation: 'Podem ser usadas em qualquer código instrumentado.' },
      ],
    },
    {
      prompt:
        'Uma API no API Gateway com integração HTTP retorna 504 para requisições cujo backend demora cerca de 40 segundos. Qual é a causa?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'O API Gateway espera por padrão até 29 segundos pela integração; acima disso, devolve 504 Gateway Timeout.',
      options: [
        {
          text: 'O timeout da integração do API Gateway (29 s por padrão) foi excedido.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'O backend devolveu uma resposta mal formada.', isCorrect: false, explanation: 'Isso geraria 502.' },
        { text: 'O cliente não tem permissão.', isCorrect: false, explanation: 'Isso geraria 401 ou 403.' },
        { text: 'A API está sofrendo throttling.', isCorrect: false, explanation: 'Isso geraria 429.' },
      ],
    },
    {
      prompt: 'Qual consulta do CloudWatch Logs Insights calcula a duração média das invocações de uma função Lambda?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'As linhas REPORT do Lambda expõem o campo @duration; filtrando por @type = "REPORT", stats avg(@duration) dá a média.',
      officialReferences: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html',
      options: [
        { text: 'filter @type = "REPORT" | stats avg(@duration)', isCorrect: true, explanation: 'Correto.' },
        { text: 'SELECT AVG(duration) FROM lambda', isCorrect: false, explanation: 'Logs Insights não usa SQL desse jeito.' },
        { text: 'fields @duration | sort @duration desc | limit 1', isCorrect: false, explanation: 'Mostra só a maior duração, não a média.' },
        { text: 'filter @message like /START/ | stats count(*)', isCorrect: false, explanation: 'Conta invocações, não calcula duração.' },
      ],
    },
    {
      prompt:
        'Uma API REST com integração Lambda proxy retorna 502 em todas as chamadas, e os logs mostram que a função termina sem erro. Qual é a causa mais provável?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Com integração proxy, a função precisa devolver um objeto com statusCode e body (string). Qualquer outro formato gera "Malformed Lambda proxy response" e 502.',
      options: [
        {
          text: 'A função devolve uma resposta fora do formato proxy (sem statusCode ou com body que não é string).',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'O timeout do API Gateway é curto demais.', isCorrect: false, explanation: 'Timeout gera 504.' },
        { text: 'Falta uma chave de API.', isCorrect: false, explanation: 'Geraria 403.' },
        { text: 'A função está sem memória.', isCorrect: false, explanation: 'Os logs mostram que ela termina sem erro.' },
      ],
    },
    {
      prompt:
        'Os logs de uma função Lambda mostram "Task timed out after 3.00 seconds" em chamadas a uma API externa que às vezes demora 8 segundos. Qual é a ação mais adequada?',
      type: 'APPLICATION',
      difficulty: 'EASY',
      explanation:
        'A função atingiu o timeout configurado (padrão de 3 s). Ajustar o timeout para cobrir a latência real da dependência (e investigar a lentidão dela) resolve.',
      options: [
        {
          text: 'Aumentar o timeout da função para cobrir a latência da API externa e investigar a lentidão dela.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Aumentar a concorrência reservada.', isCorrect: false, explanation: 'Não muda o tempo máximo de cada execução.' },
        { text: 'Trocar o runtime da função.', isCorrect: false, explanation: 'O limite é de tempo, não de runtime.' },
        { text: 'Habilitar o X-Ray para evitar o timeout.', isCorrect: false, explanation: 'O X-Ray ajuda a enxergar, mas não evita o timeout.' },
      ],
    },
    {
      prompt:
        'Uma função Lambda passou a falhar com AccessDeniedException ao gravar numa tabela DynamoDB, depois de funcionar por meses. Qual é a melhor forma de descobrir o que mudou?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'AccessDeniedException indica falta de permissão. O CloudTrail registra quem alterou a role de execução ou suas policies, e quando.',
      options: [
        {
          text: 'Verificar a role de execução e usar o CloudTrail para ver quem alterou suas policies e quando.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Aumentar a capacidade da tabela.', isCorrect: false, explanation: 'Capacidade gera throttling, não AccessDenied.' },
        { text: 'Repetir a gravação com backoff exponencial.', isCorrect: false, explanation: 'Erros de permissão não se resolvem repetindo.' },
        { text: 'Aumentar o timeout da função.', isCorrect: false, explanation: 'Não tem relação com permissão.' },
      ],
    },
    {
      prompt:
        'A linha REPORT de uma função Lambda que falha mostra "Memory Size: 128 MB Max Memory Used: 128 MB". Qual é a causa provável e a correção?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'A função atingiu o limite de memória e foi encerrada. Aumentar a memória configurada resolve (e também aumenta a CPU disponível).',
      options: [
        { text: 'Falta de memória; aumentar a memória da função.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Timeout; aumentar o timeout.', isCorrect: false, explanation: 'A linha REPORT mostra a memória no limite.' },
        { text: 'Throttling; aumentar a concorrência.', isCorrect: false, explanation: 'Throttling impede a execução, não esgota memória.' },
        { text: 'Falta de permissão; ajustar a role.', isCorrect: false, explanation: 'Não tem relação com a memória usada.' },
      ],
    },
    {
      prompt:
        'Uma requisição passa por API Gateway, três funções Lambda e uma tabela DynamoDB, e está lenta. Qual ferramenta mostra quanto tempo cada serviço consome naquela requisição?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation: 'O AWS X-Ray grava um trace por requisição, com segments e subsegments de cada serviço e um trace map com latências.',
      options: [
        { text: 'AWS X-Ray', isCorrect: true, explanation: 'Correto.' },
        { text: 'AWS CloudTrail', isCorrect: false, explanation: 'Registra chamadas de API da conta, não a latência de requisições da aplicação.' },
        { text: 'Métricas de Invocations do Lambda', isCorrect: false, explanation: 'Contam invocações, sem relacionar os serviços de uma requisição.' },
        { text: 'AWS Config', isCorrect: false, explanation: 'Registra configurações de recursos.' },
      ],
    },
    {
      prompt:
        'Uma stack do CloudFormation ficou em UPDATE_ROLLBACK_FAILED porque um recurso foi apagado manualmente fora da stack. Como seguir em frente?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'Depois de corrigir a causa (ou decidir pular o recurso problemático), usa-se Continue update rollback, que pode pular recursos que não conseguem voltar ao estado anterior.',
      options: [
        {
          text: 'Corrigir a causa e usar Continue update rollback, pulando o recurso se necessário.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Fazer um novo update da stack imediatamente.', isCorrect: false, explanation: 'Não é possível atualizar uma stack em UPDATE_ROLLBACK_FAILED.' },
        { text: 'Habilitar termination protection.', isCorrect: false, explanation: 'Só impede a exclusão da stack.' },
        { text: 'Rodar drift detection e esperar.', isCorrect: false, explanation: 'Detecta a diferença, mas não tira a stack do estado de falha.' },
      ],
    },
    {
      prompt:
        'Um time quer ser alertado sempre que a mensagem "falha no pagamento" aparecer nos logs de uma aplicação no CloudWatch Logs. Qual é a solução?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Um metric filter no log group transforma ocorrências do padrão numa métrica do CloudWatch, e um alarme nessa métrica notifica (ex.: via SNS).',
      options: [
        {
          text: 'Criar um metric filter no log group para o padrão e um alarme na métrica gerada.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Rodar uma consulta do Logs Insights manualmente todo dia.', isCorrect: false, explanation: 'Não alerta em tempo real.' },
        { text: 'Habilitar o X-Ray na aplicação.', isCorrect: false, explanation: 'O X-Ray não observa o texto dos logs.' },
        { text: 'Consultar o CloudTrail.', isCorrect: false, explanation: 'O CloudTrail registra chamadas de API, não logs da aplicação.' },
      ],
    },
    {
      prompt:
        'Uma aplicação em EC2, instrumentada com o X-Ray SDK, não gera nenhum trace no Console, embora funcione normalmente. Quais são as causas mais prováveis?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'O SDK envia segments por UDP (porta 2000) ao X-Ray daemon, que os publica na AWS. Sem o daemon rodando, ou sem permissão de xray:PutTraceSegments na instance role, nada chega ao X-Ray.',
      options: [
        {
          text: 'O X-Ray daemon não está rodando ou a instance role não tem permissão de xray:PutTraceSegments.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'O security group bloqueia a porta 443 de entrada.', isCorrect: false, explanation: 'O daemon faz conexões de saída; a entrada 443 não é o problema.' },
        { text: 'O X-Ray só funciona com funções Lambda.', isCorrect: false, explanation: 'Funciona em EC2, ECS e outros.' },
        { text: 'A aplicação precisa estar atrás de um API Gateway.', isCorrect: false, explanation: 'Não é um requisito.' },
      ],
    },
    {
      prompt:
        'A criação de uma stack do CloudFormation falhou e a aba Events mostra dezenas de eventos de falha e de rollback. Onde está a causa raiz?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'A causa raiz está no primeiro evento CREATE_FAILED (o mais antigo); os eventos seguintes costumam ser consequência do rollback.',
      options: [
        { text: 'No primeiro evento CREATE_FAILED, o mais antigo.', isCorrect: true, explanation: 'Correto.' },
        { text: 'No último evento da lista, o mais recente.', isCorrect: false, explanation: 'Costuma ser o fim do rollback.' },
        { text: 'No evento ROLLBACK_COMPLETE.', isCorrect: false, explanation: 'Indica só que o rollback terminou.' },
        { text: 'Nos Outputs da stack.', isCorrect: false, explanation: 'Outputs não registram falhas.' },
      ],
    },
    {
      prompt:
        'No API Gateway, a métrica Latency de uma API está alta, mas IntegrationLatency está baixa. Onde provavelmente está o tempo extra?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Latency mede o tempo total no API Gateway; IntegrationLatency mede só o backend. Se só a primeira está alta, o tempo está no próprio API Gateway (ex.: autorizador Lambda, transformações).',
      options: [
        {
          text: 'No próprio API Gateway, como um autorizador Lambda lento ou transformações.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'No backend da integração.', isCorrect: false, explanation: 'Nesse caso IntegrationLatency também estaria alta.' },
        { text: 'Na rede do cliente, antes de chegar à AWS.', isCorrect: false, explanation: 'Latency não mede a rede do cliente.' },
        { text: 'No banco de dados usado pelo backend.', isCorrect: false, explanation: 'Esse tempo entraria em IntegrationLatency.' },
      ],
    },
  ];

  await seedQuestions(rootCauseTopic.id, rootCauseQuestionsToSeed);

  const rootCauseFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'CloudWatch Logs Insights',
      conceptDescription: 'Linguagem de consulta de logs do CloudWatch.',
      serviceId: cloudWatchService.id,
      front: 'Quais comandos principais do CloudWatch Logs Insights?',
      back: 'fields, filter (inclusive like /regex/), stats (count, avg, max, pct, by bin()), sort, limit e parse. Para o Lambda: filter @type = "REPORT" | stats avg(@duration).',
    },
    {
      conceptName: 'Metric filters',
      conceptDescription: 'Métricas derivadas de padrões de log.',
      serviceId: cloudWatchService.id,
      front: 'Como gerar um alarme a partir de um texto que aparece nos logs?',
      back: 'Metric filter no log group (transforma ocorrências do padrão em métrica) + alarme do CloudWatch nessa métrica.',
    },
    {
      conceptName: 'Linha REPORT do Lambda',
      conceptDescription: 'Informações de cada invocação registradas pelo Lambda.',
      serviceId: lambdaService.id,
      front: 'O que a linha REPORT do Lambda mostra e como ela ajuda no diagnóstico?',
      back: 'Duration, Billed Duration, Memory Size, Max Memory Used e Init Duration (cold start). Max Memory Used = Memory Size indica falta de memória.',
    },
    {
      conceptName: 'Métricas de diagnóstico do Lambda',
      conceptDescription: 'Métricas do Lambda e o sintoma que cada uma revela.',
      serviceId: lambdaService.id,
      front: 'O que indicam as métricas Errors, Throttles e IteratorAge do Lambda?',
      back: 'Errors: exceções e timeouts. Throttles: limite de concorrência atingido. IteratorAge: atraso ao consumir streams (Kinesis/DynamoDB).',
    },
    {
      conceptName: 'Códigos 5xx no API Gateway',
      conceptDescription: 'Causas comuns de 502 e 504 no API Gateway.',
      serviceId: apiGatewayService.id,
      front: 'O que costuma causar 502 e 504 no API Gateway?',
      back: '502: resposta mal formada da integração Lambda proxy (sem statusCode ou body não string) ou exceção no backend. 504: integração passou do timeout (29 s por padrão).',
    },
    {
      conceptName: 'Latency vs. IntegrationLatency',
      conceptDescription: 'Métricas de latência do API Gateway.',
      serviceId: apiGatewayService.id,
      front: 'Qual a diferença entre Latency e IntegrationLatency no API Gateway?',
      back: 'Latency: tempo total no API Gateway. IntegrationLatency: só o backend. Latency alta com IntegrationLatency baixa → tempo gasto no próprio API Gateway (ex.: autorizador).',
    },
    {
      conceptName: 'Exceções de SDK',
      conceptDescription: 'Exceções comuns dos SDKs da AWS e a ação para cada uma.',
      serviceId: lambdaService.id,
      front: 'Quais exceções de SDK devem ser repetidas e quais não?',
      back: 'Repetir com backoff: ThrottlingException, ProvisionedThroughputExceededException, TooManyRequests. Não repetir: AccessDenied (permissão), ValidationException (parâmetros), ResourceNotFound (nome/região).',
    },
    {
      conceptName: 'Annotations e metadata no X-Ray',
      conceptDescription: 'Dados adicionados a segments do X-Ray.',
      serviceId: xrayService.id,
      front: 'Qual a diferença entre annotations e metadata no X-Ray?',
      back: 'Annotations: chave-valor indexados, usados em filter expressions. Metadata: qualquer dado extra, não indexado.',
    },
    {
      conceptName: 'X-Ray daemon e sampling',
      conceptDescription: 'Como traces chegam ao X-Ray e quantos são gravados.',
      serviceId: xrayService.id,
      front: 'Como o X-Ray recebe traces de EC2/ECS e quantas requisições grava por padrão?',
      back: 'Via X-Ray daemon (UDP 2000), com permissão xray:PutTraceSegments na role. Sampling padrão: a primeira requisição de cada segundo + 5% das demais.',
    },
    {
      conceptName: 'Diagnóstico de falhas de deploy',
      conceptDescription: 'Onde procurar a causa de falhas em CloudFormation e mudanças na conta.',
      serviceId: cloudTrailService.id,
      front: 'Onde procurar a causa de uma stack que falhou e de algo que "parou de funcionar sozinho"?',
      back: 'Stack: o primeiro evento CREATE_FAILED/UPDATE_FAILED (UPDATE_ROLLBACK_FAILED → continue update rollback). Mudança misteriosa: o CloudTrail, que registra quem chamou qual API e quando.',
    },
  ];

  await seedFlashcards(rootCauseTopic.id, rootCauseFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 11 of 12: Domain 4 "Instrumentação de
  // código para observabilidade", to the exam-readiness bar.
  // ---------------------------------------------------------------------

  const observabilityTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: troubleshootingDomain.id, name: 'Instrumentação de código para observabilidade' },
  });

  const eventBridgeServiceData = {
    shortName: 'EventBridge',
    category: 'Application Integration',
    description:
      'Barramento de eventos que roteia eventos de serviços da AWS, de aplicações e de SaaS para destinos por meio de regras.',
  };
  const eventBridgeService = await prisma.aWSService.upsert({
    where: { name: 'Amazon EventBridge' },
    update: eventBridgeServiceData,
    create: { name: 'Amazon EventBridge', ...eventBridgeServiceData },
  });

  const logsMetricsInstrumentationLessonContent = `## Objetivo

Ao final desta lição você vai conseguir diferenciar logging, monitoramento e observabilidade, escrever logs estruturados úteis e publicar métricas customizadas no CloudWatch da forma mais eficiente.

## Logging, monitoramento e observabilidade

- **Logging**: registrar o que aconteceu (eventos, erros, decisões do código).
- **Monitoramento**: acompanhar indicadores conhecidos e alertar quando saem do normal ("a taxa de erros passou de 1%").
- **Observabilidade**: conseguir responder perguntas **novas** sobre o sistema sem mudar o código ("por que só os clientes do plano X estão lentos desde ontem?"), combinando os três pilares — **logs**, **métricas** e **traces** — ligados por identificadores em comum.

## Logs estruturados

Logs em JSON, com campos consistentes, podem ser filtrados e agregados (no Logs Insights, por exemplo) em vez de só lidos. Boas práticas:

- Um **nível** por mensagem (\`DEBUG\`, \`INFO\`, \`WARN\`, \`ERROR\`) e o nível configurável sem mudar código.
- Um **ID de correlação** em toda linha — o request ID do Lambda, o trace ID do X-Ray ou um ID propagado entre serviços — para seguir uma requisição por vários serviços.
- Contexto de negócio (ID do pedido, tipo de cliente), mas **nunca** segredos ou dados sensíveis sem mascarar.

No Lambda, os **controles avançados de logging** permitem escolher o formato **JSON** para os logs da função e do sistema (as linhas \`START\`/\`REPORT\` viram eventos \`platform.*\`), definir o **nível de log da aplicação** e do sistema (filtrando mensagens abaixo dele sem alterar o código) e apontar a função para um **log group customizado**. O **Powertools for AWS Lambda** (Python, TypeScript, Java, .NET) oferece Logger, Metrics e Tracer prontos com essas práticas.

## Métricas customizadas

Uma métrica do CloudWatch é identificada por **namespace** (ex.: \`DevLab/Pedidos\`), **nome** e **dimensions** (pares chave-valor, como \`Servico=checkout\`; até 30 por métrica). Cada combinação de dimensões é uma métrica separada e cobrada — por isso valores de **alta cardinalidade** (ID do pedido, ID do usuário) vão para os logs, nunca para dimensões.

Duas formas de publicar:

- **\`PutMetricData\`**: uma chamada de API do SDK. Simples, mas adiciona latência e custo por chamada no caminho da requisição, e está sujeita a throttling.
- **Embedded Metric Format (EMF)**: a aplicação escreve uma linha de log em JSON com um bloco \`_aws\` descrevendo as métricas, e o CloudWatch extrai as métricas **de forma assíncrona** a partir do log — sem chamada de API, e com o contexto (IDs de alta cardinalidade) preservado no próprio log. É a forma recomendada no Lambda.

Métricas têm resolução **padrão** (60 s) ou **alta resolução** (1 s, via \`StorageResolution\`), que permite alarmes com períodos de 10 ou 30 segundos. Para latência, prefira **percentis** (\`p90\`, \`p99\`) à média, que esconde a cauda lenta. Em instâncias EC2, métricas de dentro do sistema operacional (**memória**, **disco**) não existem por padrão — exigem o **CloudWatch agent**.

## Relação com a prova DVA-C02

Espere cenários sobre EMF vs. \`PutMetricData\`, dimensões e cardinalidade, alta resolução, percentis, CloudWatch agent para memória em EC2, logs estruturados com ID de correlação e o nível de log do Lambda ajustado sem mudar código.`;

  const tracingAlarmsLessonContent = `## Objetivo

Ao final desta lição você vai conseguir instrumentar código com o X-Ray SDK (ou OpenTelemetry), configurar alarmes que não disparam à toa e notificar o time sobre eventos como falhas de pipeline e cotas perto do limite.

## Instrumentando traces

O active tracing do Lambda e o tracing do API Gateway registram os serviços, mas **o que acontece dentro do código** só aparece com instrumentação:

- **Patch dos clientes**: o X-Ray SDK (\`patch_all()\` em Python, \`captureAWSv3Client\` em Node.js) cria automaticamente um **subsegment** para cada chamada ao SDK da AWS e a APIs HTTP, com tempo e erros.
- **Subsegments customizados**: marcam trechos do código (\`with xray_recorder.in_subsegment("calcular_frete")\`).
- **Annotations** (indexadas, até 50 por trace, usadas em filter expressions) e **metadata** (qualquer dado, não indexado). No Lambda, o segmento da função é criado pelo próprio serviço (um *facade segment*) e não pode ser alterado — annotations e metadata vão em **subsegments** que o código cria.
- **AWS Distro for OpenTelemetry (ADOT)** é a alternativa baseada no padrão aberto OpenTelemetry, que envia traces ao X-Ray e métricas ao CloudWatch — útil quando o time quer instrumentação portável.

## Alarmes do CloudWatch

Um alarme observa uma métrica (ou uma expressão matemática sobre métricas) e fica em \`OK\`, \`ALARM\` ou \`INSUFFICIENT_DATA\`. Os parâmetros que evitam alarmes falsos:

- **Period** e **statistic** (ex.: \`Sum\` de erros em 1 minuto, \`p99\` de latência em 5 minutos).
- **Evaluation periods** e **datapoints to alarm** — "M de N": 3 de 5 períodos acima do limite, em vez de um pico isolado.
- **Treat missing data**: como tratar períodos sem dados (\`missing\`, \`notBreaching\`, \`breaching\`, \`ignore\`) — em serviços de pouco tráfego, \`notBreaching\` evita alarmes por falta de dados.
- **Composite alarms**: combinam alarmes com AND/OR para reduzir ruído (ex.: só alertar se erros **e** latência estiverem altos).
- **Anomaly detection**: faixa esperada aprendida do histórico, em vez de um limite fixo.

Ações de alarme: notificar via **SNS**, escalar um Auto Scaling group, executar ações de EC2 ou invocar uma função Lambda.

## Notificações sobre eventos

Nem tudo é métrica. O **Amazon EventBridge** recebe eventos de mudança de estado dos serviços — uma execução do CodePipeline que falhou, um deploy do CodeDeploy que terminou, uma notificação do AWS Health — e uma **regra** com um padrão de evento os envia para SNS, Lambda, filas etc. Para **cotas de serviço**, o Service Quotas publica o uso de muitas cotas como métricas no CloudWatch (namespace \`AWS/Usage\`), e é possível criar alarmes quando o uso passa de uma porcentagem da cota. **CloudWatch Synthetics** (canaries) testa endpoints e fluxos periodicamente de fora da aplicação, e **dashboards** reúnem métricas, logs e alarmes num lugar só.

## Relação com a prova DVA-C02

Espere cenários sobre patch do SDK e subsegments, annotations no Lambda, "M de N" datapoints, \`treatMissingData\`, composite alarms, EventBridge para notificar falhas de pipeline/deploy e alarmes de uso de cotas.`;

  const observabilityLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 12,
      title: 'Logs estruturados e métricas customizadas',
      content: logsMetricsInstrumentationLessonContent,
      resources: [
        {
          title: 'Embedded Metric Format — documentação oficial',
          url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html',
        },
        {
          title: 'Controles avançados de logging do Lambda — documentação oficial',
          url: 'https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-advanced.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 11,
      title: 'Tracing, alarmes e notificações',
      content: tracingAlarmsLessonContent,
      resources: [
        {
          title: 'Instrumentando Python com o X-Ray SDK — documentação oficial',
          url: 'https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-python.html',
        },
        {
          title: 'Alarmes do CloudWatch — documentação oficial',
          url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html',
        },
      ],
    },
  ];

  await seedLessons(observabilityTopic.id, observabilityLessons);

  const emfFunctionInstructions = `No Console do Lambda, crie a função \`devlab-metricas\` com Python 3.13. Substitua o código por este, que publica duas métricas via **Embedded Metric Format** — só escrevendo uma linha de log — e clique em "Deploy":

\`\`\`python
import json
import random
import time


def lambda_handler(event, context):
    valor = round(random.uniform(10, 500), 2)
    aprovado = random.random() > 0.2
    print(json.dumps({
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [{
                "Namespace": "DevLab/Pedidos",
                "Dimensions": [["Servico"]],
                "Metrics": [
                    {"Name": "ValorPedido", "Unit": "None"},
                    {"Name": "PagamentoRecusado", "Unit": "Count"}
                ]
            }]
        },
        "Servico": "checkout",
        "ValorPedido": valor,
        "PagamentoRecusado": 0 if aprovado else 1,
        "pedidoId": context.aws_request_id
    }))
    return {"valor": valor, "aprovado": aprovado}
\`\`\`

Repare: \`pedidoId\` está no log, mas **não** é dimensão — tem cardinalidade alta demais para virar métrica.`;

  const emfInvokeInstructions = `No AWS CloudShell, gere 40 pedidos:

\`\`\`bash
for i in $(seq 1 40); do
  aws lambda invoke --function-name devlab-metricas saida.json > /dev/null
done
echo concluido
\`\`\``;

  const xrayLayerInstructions = `No AWS CloudShell, empacote o X-Ray SDK como layer, com as wheels do runtime Python 3.13 (a mesma técnica do laboratório de layers do tópico "Preparação de artefatos de deploy"):

\`\`\`bash
mkdir -p xray/python
pip3 install aws-xray-sdk -t xray/python --platform manylinux2014_x86_64 --python-version 3.13 --implementation cp --only-binary=:all:
cd xray && zip -r ../xray.zip python && cd ..
aws lambda publish-layer-version --layer-name devlab-xray-sdk --zip-file fileb://xray.zip --compatible-runtimes python3.13 --compatible-architectures x86_64
\`\`\``;

  const instrumentedCodeInstructions = `Substitua o código da função \`devlab-observavel\` por este e clique em "Deploy":

\`\`\`python
import logging

import boto3
from aws_xray_sdk.core import patch_all, xray_recorder

patch_all()  # cria subsegments para as chamadas do boto3
logger = logging.getLogger()
sts = boto3.client("sts")


def lambda_handler(event, context):
    cliente = event.get("cliente", "anonimo")
    # No Lambda, annotations vão num subsegment criado pelo código.
    with xray_recorder.in_subsegment("processar_pedido") as subsegment:
        subsegment.put_annotation("cliente", cliente)
        subsegment.put_metadata("evento", event)
        conta = sts.get_caller_identity()["Account"]
    logger.info("pedido processado para %s", cliente)
    logger.debug("detalhe que só aparece com nível DEBUG")
    return {"cliente": cliente, "conta": conta[-4:]}
\`\`\``;

  const instrumentedInvokeInstructions = `No CloudShell, invoque a função algumas vezes com clientes diferentes:

\`\`\`bash
for cliente in ana bruno ana carla ana; do
  aws lambda invoke --function-name devlab-observavel --cli-binary-format raw-in-base64-out --payload "{\\"cliente\\": \\"$cliente\\"}" saida.json > /dev/null
done
echo concluido
\`\`\`

Depois, no CloudWatch Logs Insights, consulte o log group \`/aws/lambda/devlab-observavel\`:

\`\`\`
fields @timestamp, level, message, requestId
| filter level = "INFO"
| sort @timestamp desc
\`\`\``;

  const observabilityLabs: LabSeed[] = [
    {
      title: 'Métricas customizadas com Embedded Metric Format e um alarme',
      data: {
        level: 2,
        order: 1,
        estimatedMinutes: 30,
        objective:
          'Ao final deste laboratório você terá publicado métricas de negócio no CloudWatch a partir de uma função Lambda usando o Embedded Metric Format, sem nenhuma chamada a PutMetricData, e criado um alarme com notificação por e-mail sobre uma delas.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell, e um e-mail seu para receber a notificação. Ter lido a lição "Logs estruturados e métricas customizadas" ajuda.',
        context:
          'O time de negócio quer acompanhar o valor dos pedidos e ser avisado quando muitos pagamentos forem recusados. A função de checkout já existe; o desafio é publicar essas métricas sem adicionar latência e custo de chamadas de API a cada pedido.',
        troubleshooting:
          'O namespace `DevLab/Pedidos` não aparece: as métricas extraídas do log podem levar alguns minutos para surgir; confira também se a linha de log é JSON válido com o bloco `_aws` (abra o log no CloudWatch Logs). \n\nO alarme fica em `INSUFFICIENT_DATA`: não houve dados no período — gere mais tráfego com o laço do passo 2. \n\nO e-mail de notificação não chega: a assinatura do tópico SNS precisa ser confirmada pelo link do e-mail "AWS Notification - Subscription Confirmation" (confira o spam).',
        cleanup:
          'Exclua o alarme `devlab-pagamentos-recusados`, o tópico SNS criado para ele, a função `devlab-metricas` e o log group `/aws/lambda/devlab-metricas`. Métricas customizadas não podem ser excluídas: param de ser cobradas quando deixam de receber dados e expiram sozinhas.',
        costWarning:
          'Métricas customizadas e alarmes do CloudWatch têm uma cota gratuita mensal (10 métricas e 10 alarmes no Free Tier); fora dela, custam centavos por mês, proporcionalmente. As invocações ficam no Free Tier do Lambda.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar a função que publica métricas',
          instructions: emfFunctionInstructions,
          validation: 'Um teste no Console devolve `valor` e `aprovado`, e o log da execução mostra a linha JSON com o bloco `_aws`.',
        },
        {
          order: 2,
          title: 'Gerar pedidos',
          instructions: emfInvokeInstructions,
          validation: 'O laço termina com `concluido`, sem erros.',
        },
        {
          order: 3,
          title: 'Ver as métricas no CloudWatch',
          instructions:
            'Espere alguns minutos. No Console do CloudWatch, abra "Metrics" > "All metrics" > namespace `DevLab/Pedidos` > dimensão `Servico`. Grafique `PagamentoRecusado` com a estatística **Sum** e `ValorPedido` com **p90**, em períodos de 1 minuto.',
          validation:
            'As duas métricas aparecem sob `Servico = checkout`: a soma de recusas fica em torno de 20% dos pedidos, e o p90 mostra o valor abaixo do qual estão 90% dos pedidos — métricas criadas só a partir de logs.',
        },
        {
          order: 4,
          title: 'Criar o alarme com notificação',
          instructions:
            'Na métrica `PagamentoRecusado`, clique no ícone de sino ("Create alarm"). Estatística **Sum**, período de **5 minutos**, condição **maior ou igual a 3**. Em "Notification", crie um novo tópico SNS com o seu e-mail e confirme a assinatura pelo link recebido. Nomeie o alarme `devlab-pagamentos-recusados`.',
          validation: 'O alarme aparece na lista e a assinatura do tópico SNS está confirmada.',
        },
        {
          order: 5,
          title: 'Disparar o alarme',
          instructions: 'Rode o laço do passo 2 mais uma vez e acompanhe o alarme por alguns minutos.',
          validation:
            'Com cerca de 8 recusas em 40 pedidos, o alarme passa para **ALARM** e você recebe o e-mail do SNS — do log da função até o alerta, sem uma única chamada a `PutMetricData`.',
        },
      ],
    },
    {
      title: 'Logs em JSON e tracing com o X-Ray SDK',
      data: {
        level: 3,
        order: 2,
        estimatedMinutes: 35,
        objective:
          'Ao final deste laboratório você terá uma função Lambda com logs em formato JSON e nível de log configurável sem mudar código, e com instrumentação do X-Ray SDK — subsegments automáticos para o SDK da AWS e uma annotation usada para filtrar traces por cliente.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter feito o laboratório de layers do tópico "Preparação de artefatos de deploy" e lido a lição "Tracing, alarmes e notificações" ajuda.',
        context:
          'O suporte recebe reclamações de clientes específicos e precisa encontrar as requisições deles rapidamente. Hoje os logs são texto livre e os traces só mostram "a função demorou". Você vai instrumentar a função para que dê para filtrar traces por cliente e consultar logs por campo.',
        troubleshooting:
          '`No module named \'aws_xray_sdk\'`: confira se a layer `devlab-xray-sdk` foi adicionada e se a função é Python 3.13 x86_64, igual à layer. \n\nNenhum trace com a annotation: o active tracing precisa estar ligado; e, no Lambda, a annotation só funciona dentro do subsegment criado pelo código (colocá-la fora gera erro de "facade segment"). \n\nOs logs continuam em texto: o formato JSON é configurado em "Logging configuration" da função — confira se salvou como JSON. \n\nA consulta por `level` não retorna nada: amplie o intervalo de tempo; com o formato JSON, os campos `level`, `message` e `requestId` são descobertos automaticamente.',
        cleanup:
          'Exclua a função `devlab-observavel`, o log group `/aws/lambda/devlab-observavel` e a layer: `aws lambda delete-layer-version --layer-name devlab-xray-sdk --version-number 1`.',
        costWarning:
          'As invocações e os poucos traces ficam dentro das cotas gratuitas do Lambda e do X-Ray. A chamada `sts get-caller-identity` usada no código não tem custo.',
      },
      steps: [
        {
          order: 1,
          title: 'Publicar a layer do X-Ray SDK',
          instructions: xrayLayerInstructions,
          validation: 'A resposta traz um `LayerVersionArn` terminando em `:devlab-xray-sdk:1`.',
        },
        {
          order: 2,
          title: 'Criar e configurar a função',
          instructions:
            'Crie a função `devlab-observavel` com Python 3.13 (x86_64) e adicione a layer `devlab-xray-sdk` (versão 1). Em "Configuration" > "Monitoring and operations tools": ative o **Active tracing** do X-Ray e, em "Logging configuration", escolha **Log format: JSON** e **Application log level: INFO**.',
          validation: 'A configuração mostra active tracing habilitado, formato de log JSON e nível de aplicação INFO.',
        },
        {
          order: 3,
          title: 'Instrumentar o código',
          instructions: instrumentedCodeInstructions,
          validation: 'Um teste com `{"cliente": "ana"}` devolve o cliente e os 4 últimos dígitos da conta.',
        },
        {
          order: 4,
          title: 'Gerar tráfego e consultar os logs',
          instructions: instrumentedInvokeInstructions,
          validation:
            'Cada linha é um JSON com `level`, `message` (ex.: "pedido processado para ana") e `requestId` — e a mensagem `DEBUG` não aparece, porque o nível da aplicação é INFO. Trocando o nível para DEBUG na configuração (sem mudar o código) e invocando de novo, ela passa a aparecer.',
        },
        {
          order: 5,
          title: 'Filtrar traces por annotation',
          instructions:
            'No Console do CloudWatch, abra "X-Ray traces" > "Traces" e filtre com `annotation.cliente = "ana"`. Abra um dos traces.',
          validation:
            'Só aparecem os 3 traces da cliente "ana". O trace mostra o subsegment `processar_pedido` com a annotation e, dentro dele, um subsegment `STS` criado automaticamente pelo `patch_all()` — o tempo da chamada ao SDK visível dentro do código.',
        },
      ],
    },
  ];

  await seedLabs(observabilityTopic.id, observabilityLabs);

  const observabilityQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'Quais são os três pilares normalmente associados à observabilidade?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Logs, métricas e traces. Juntos, e ligados por identificadores em comum, permitem responder perguntas novas sobre o sistema sem mudar o código.',
      options: [
        { text: 'Logs, métricas e traces', isCorrect: true, explanation: 'Correto.' },
        { text: 'Backups, snapshots e réplicas', isCorrect: false, explanation: 'Isso é resiliência de dados.' },
        { text: 'Usuários, grupos e roles', isCorrect: false, explanation: 'Isso é gerenciamento de identidade.' },
        { text: 'Build, teste e deploy', isCorrect: false, explanation: 'Isso é CI/CD.' },
      ],
    },
    {
      prompt: 'Um time quer um alarme de uso de memória de instâncias EC2, mas não encontra essa métrica no CloudWatch. Por quê?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Métricas de dentro do sistema operacional, como memória e disco, não são coletadas por padrão. É preciso instalar e configurar o CloudWatch agent nas instâncias.',
      options: [
        { text: 'Memória não é coletada por padrão; é preciso o CloudWatch agent.', isCorrect: true, explanation: 'Correto.' },
        { text: 'É preciso habilitar o monitoramento detalhado (1 minuto).', isCorrect: false, explanation: 'Isso aumenta a frequência das métricas padrão, mas não adiciona memória.' },
        { text: 'A métrica só existe em instâncias com mais de 8 GB de memória.', isCorrect: false, explanation: 'Não existe essa regra.' },
        { text: 'É preciso habilitar o X-Ray.', isCorrect: false, explanation: 'O X-Ray trata de traces, não de métricas do sistema operacional.' },
      ],
    },
    {
      prompt:
        'Um desenvolvedor quer publicar uma métrica customizada com o ID de cada usuário como dimensão, para ver a latência por usuário. Por que isso não é recomendado?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'Cada combinação de dimensões vira uma métrica separada e cobrada. Valores de alta cardinalidade (IDs de usuário ou de pedido) criariam milhares de métricas; eles devem ir para os logs (por exemplo, no mesmo evento EMF), onde podem ser consultados.',
      options: [
        {
          text: 'Cada valor de dimensão vira uma métrica separada e cobrada; IDs de alta cardinalidade devem ir para os logs.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Dimensões só aceitam valores numéricos.', isCorrect: false, explanation: 'Dimensões são texto.' },
        { text: 'Métricas customizadas não aceitam dimensões.', isCorrect: false, explanation: 'Aceitam até 30 dimensões.' },
        { text: 'O CloudWatch rejeita qualquer dimensão chamada usuario.', isCorrect: false, explanation: 'Não existe essa restrição de nome.' },
      ],
    },
    {
      prompt:
        'Uma função Lambda chama PutMetricData a cada requisição, o que adiciona latência e às vezes gera throttling. Qual alternativa publica as mesmas métricas sem chamadas de API no caminho da requisição?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Com o Embedded Metric Format, a função escreve um log JSON com o bloco _aws e o CloudWatch extrai as métricas de forma assíncrona, sem chamada de API.',
      officialReferences:
        'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html',
      options: [
        { text: 'Embedded Metric Format (EMF) nos logs da função.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Aumentar a memória da função.', isCorrect: false, explanation: 'Não elimina a chamada de API.' },
        { text: 'Criar um metric filter para cada requisição.', isCorrect: false, explanation: 'Metric filters são definidos uma vez por padrão, não por requisição; e o EMF é a forma recomendada para métricas com valores.' },
        { text: 'Publicar as métricas no X-Ray.', isCorrect: false, explanation: 'O X-Ray guarda traces, não métricas do CloudWatch.' },
      ],
    },
    {
      prompt:
        'Uma aplicação precisa de alarmes que reajam em 10 segundos a picos numa métrica customizada. O que é necessário?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Métricas de alta resolução (StorageResolution = 1 segundo) permitem alarmes com períodos de 10 ou 30 segundos. Métricas de resolução padrão têm granularidade de 60 segundos.',
      options: [
        {
          text: 'Publicar a métrica em alta resolução (1 segundo) e usar um alarme com período de 10 segundos.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Usar a resolução padrão e um período de 10 segundos.', isCorrect: false, explanation: 'Métricas padrão têm granularidade de 60 segundos.' },
        { text: 'Habilitar o monitoramento detalhado do EC2.', isCorrect: false, explanation: 'Dá métricas de 1 minuto das instâncias, não de uma métrica customizada.' },
        { text: 'Usar um composite alarm.', isCorrect: false, explanation: 'Combina alarmes, mas não reduz o período.' },
      ],
    },
    {
      prompt:
        'Numa função Lambda com active tracing, um desenvolvedor chama put_annotation diretamente no segmento atual e recebe um erro. Qual é a forma correta de adicionar a annotation?',
      type: 'APPLICATION',
      difficulty: 'HARD',
      explanation:
        'No Lambda, o segmento da função é um facade segment criado pelo serviço e não pode ser alterado pelo código. Annotations e metadata devem ser adicionadas a um subsegment criado pelo código.',
      options: [
        {
          text: 'Criar um subsegment no código e adicionar a annotation nele.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Desligar o active tracing e criar o segmento manualmente.', isCorrect: false, explanation: 'Perde o tracing integrado do Lambda.' },
        { text: 'Usar metadata em vez de annotation no segmento da função.', isCorrect: false, explanation: 'O facade segment também não aceita metadata.' },
        { text: 'Adicionar a annotation como variável de ambiente.', isCorrect: false, explanation: 'Variáveis de ambiente não viram annotations.' },
      ],
    },
    {
      prompt:
        'Uma requisição passa por três microsserviços, e o time precisa encontrar nos logs de todos eles as linhas da mesma requisição. Qual prática resolve isso?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Logs estruturados com um ID de correlação (por exemplo, o trace ID do X-Ray ou um ID propagado nos cabeçalhos) em todas as linhas permitem juntar os logs de uma requisição entre serviços.',
      options: [
        {
          text: 'Logs estruturados com um ID de correlação propagado entre os serviços.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Usar o mesmo log group para os três serviços.', isCorrect: false, explanation: 'Sem um ID comum, as linhas continuam impossíveis de relacionar.' },
        { text: 'Aumentar a retenção dos logs.', isCorrect: false, explanation: 'Não ajuda a relacionar linhas.' },
        { text: 'Logar tudo em nível DEBUG.', isCorrect: false, explanation: 'Mais volume não resolve a correlação.' },
      ],
    },
    {
      prompt:
        'Durante um incidente, o time quer ver temporariamente logs de nível DEBUG de uma função Lambda, sem alterar nem republicar o código. Qual recurso permite isso?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Os controles avançados de logging do Lambda (com formato JSON) permitem mudar o nível de log da aplicação na configuração da função, filtrando ou liberando mensagens sem mudar o código.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-advanced.html',
      options: [
        {
          text: 'Mudar o application log level para DEBUG nos controles avançados de logging da função.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Aumentar a retenção do log group.', isCorrect: false, explanation: 'Não muda o que é logado.' },
        { text: 'Habilitar o active tracing do X-Ray.', isCorrect: false, explanation: 'Gera traces, não logs de DEBUG.' },
        { text: 'Criar um metric filter para DEBUG.', isCorrect: false, explanation: 'Metric filters leem logs existentes; não fazem a função logar mais.' },
      ],
    },
    {
      prompt:
        'Um alarme de latência dispara várias vezes por dia por picos isolados de um único minuto, que não afetam os usuários. Como reduzir esses alarmes falsos sem esconder problemas reais?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Configurar "datapoints to alarm" como M de N (ex.: 3 de 5 períodos) faz o alarme exigir uma violação sustentada, ignorando picos isolados.',
      options: [
        {
          text: 'Exigir M de N datapoints (ex.: 3 de 5 períodos) acima do limite.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Aumentar muito o limite do alarme.', isCorrect: false, explanation: 'Esconde problemas reais.' },
        { text: 'Desligar o alarme durante o horário comercial.', isCorrect: false, explanation: 'Esconde problemas no horário de maior uso.' },
        { text: 'Trocar a estatística para Minimum.', isCorrect: false, explanation: 'Ignoraria justamente a latência alta.' },
      ],
    },
    {
      prompt:
        'Um time quer receber um e-mail sempre que uma execução do CodePipeline falhar. Qual é a solução mais direta?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'O CodePipeline emite eventos de mudança de estado no EventBridge. Uma regra que casa com execuções no estado FAILED e tem um tópico SNS (com a assinatura de e-mail) como destino resolve.',
      options: [
        {
          text: 'Uma regra do EventBridge para execuções do pipeline com estado FAILED, enviando para um tópico SNS.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Um alarme do CloudWatch na métrica CPUUtilization.', isCorrect: false, explanation: 'Não tem relação com o pipeline.' },
        { text: 'Um metric filter no log do CodeBuild procurando a palavra "pipeline".', isCorrect: false, explanation: 'Frágil e indireto; o evento de estado já existe.' },
        { text: 'Uma consulta diária do CloudTrail.', isCorrect: false, explanation: 'Não notifica na hora.' },
      ],
    },
    {
      prompt:
        'Um alarme sobre uma métrica de um serviço de pouco tráfego fica indo para ALARM ou INSUFFICIENT_DATA nos períodos sem nenhuma requisição. Como corrigir?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'A opção treat missing data define como períodos sem dados são tratados. Com notBreaching, períodos sem requisições contam como dentro do limite.',
      options: [
        { text: 'Configurar treat missing data como notBreaching.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Configurar treat missing data como breaching.', isCorrect: false, explanation: 'Faria os períodos vazios dispararem o alarme.' },
        { text: 'Publicar a métrica em alta resolução.', isCorrect: false, explanation: 'Não resolve a ausência de dados.' },
        { text: 'Aumentar o número de evaluation periods para 100.', isCorrect: false, explanation: 'Atrasa a detecção de problemas reais.' },
      ],
    },
    {
      prompt:
        'Um time quer ser avisado antes de atingir a cota de execuções concorrentes do Lambda na conta. Qual abordagem atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'A métrica de uso (ConcurrentExecutions no Lambda, ou as métricas de uso do Service Quotas no namespace AWS/Usage) permite um alarme quando o uso passa de uma porcentagem da cota.',
      options: [
        {
          text: 'Um alarme do CloudWatch sobre o uso de concorrência (ConcurrentExecutions ou a métrica de uso do Service Quotas) em relação à cota.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Um alarme sobre a métrica Throttles.', isCorrect: false, explanation: 'Throttles só aparece depois que a cota já foi atingida.' },
        { text: 'Uma regra do EventBridge para cada invocação.', isCorrect: false, explanation: 'Gera eventos demais e não mede a concorrência.' },
        { text: 'Habilitar o X-Ray.', isCorrect: false, explanation: 'Não acompanha cotas.' },
      ],
    },
    {
      prompt:
        'Um time quer instrumentar uma aplicação com um padrão aberto, enviando traces ao X-Ray e métricas ao CloudWatch, sem ficar preso a um SDK proprietário. Qual opção atende?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'O AWS Distro for OpenTelemetry (ADOT) usa o padrão aberto OpenTelemetry e exporta traces para o X-Ray e métricas para o CloudWatch.',
      options: [
        { text: 'AWS Distro for OpenTelemetry (ADOT).', isCorrect: true, explanation: 'Correto.' },
        { text: 'CloudWatch Synthetics.', isCorrect: false, explanation: 'Testa endpoints de fora; não instrumenta o código.' },
        { text: 'AWS CloudTrail.', isCorrect: false, explanation: 'Registra chamadas de API da conta.' },
        { text: 'Amazon Macie.', isCorrect: false, explanation: 'Descobre dados sensíveis no S3.' },
      ],
    },
    {
      prompt: 'Por que o percentil p99 costuma ser preferível à média para monitorar latência?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'A média esconde a cauda lenta: poucas requisições muito lentas quase não a movem. O p99 mostra a latência que 1% dos usuários experimenta ou supera.',
      options: [
        {
          text: 'Porque a média esconde as requisições mais lentas; o p99 mostra a cauda que afeta usuários reais.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Porque o p99 é mais barato de calcular.', isCorrect: false, explanation: 'Custo não é o motivo.' },
        { text: 'Porque a média não existe no CloudWatch.', isCorrect: false, explanation: 'Average existe como estatística.' },
        { text: 'Porque o p99 ignora as requisições lentas.', isCorrect: false, explanation: 'É o contrário: ele as destaca.' },
      ],
    },
  ];

  await seedQuestions(observabilityTopic.id, observabilityQuestionsToSeed);

  const observabilityFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Logging, monitoramento e observabilidade',
      conceptDescription: 'Diferença entre os três conceitos e os pilares da observabilidade.',
      serviceId: cloudWatchService.id,
      front: 'Qual a diferença entre monitoramento e observabilidade?',
      back: 'Monitoramento acompanha indicadores conhecidos e alerta. Observabilidade permite responder perguntas novas sem mudar o código, combinando logs, métricas e traces ligados por IDs comuns.',
    },
    {
      conceptName: 'Logs estruturados',
      conceptDescription: 'Boas práticas de logging em JSON.',
      serviceId: cloudWatchService.id,
      front: 'O que um log estruturado útil deve ter?',
      back: 'JSON com nível, ID de correlação (request ID/trace ID) e contexto de negócio — sem segredos nem dados sensíveis sem mascarar.',
    },
    {
      conceptName: 'Controles avançados de logging do Lambda',
      conceptDescription: 'Formato JSON, níveis de log e log group customizado no Lambda.',
      serviceId: lambdaService.id,
      front: 'O que os controles avançados de logging do Lambda permitem?',
      back: 'Formato JSON para logs da função e do sistema, nível de log da aplicação e do sistema configurável sem mudar código, e log group customizado.',
    },
    {
      conceptName: 'Embedded Metric Format',
      conceptDescription: 'Publicação de métricas customizadas a partir de logs.',
      serviceId: cloudWatchService.id,
      front: 'Por que usar o Embedded Metric Format (EMF) em vez de PutMetricData?',
      back: 'EMF é uma linha de log JSON com o bloco _aws; o CloudWatch extrai as métricas de forma assíncrona — sem chamada de API, latência ou throttling no caminho da requisição.',
    },
    {
      conceptName: 'Dimensões e cardinalidade',
      conceptDescription: 'Uso correto de dimensões em métricas customizadas.',
      serviceId: cloudWatchService.id,
      front: 'Por que não usar o ID do usuário como dimensão de uma métrica?',
      back: 'Cada combinação de dimensões é uma métrica separada e cobrada (até 30 dimensões por métrica). IDs de alta cardinalidade vão para os logs.',
    },
    {
      conceptName: 'Alta resolução e percentis',
      conceptDescription: 'Granularidade de métricas e estatísticas de latência.',
      serviceId: cloudWatchService.id,
      front: 'Quando usar métricas de alta resolução e por que olhar percentis?',
      back: 'Alta resolução (1 s) permite alarmes de 10/30 s. Percentis (p90/p99) mostram a cauda lenta que a média esconde. Memória/disco de EC2 exigem o CloudWatch agent.',
    },
    {
      conceptName: 'Instrumentação com o X-Ray SDK',
      conceptDescription: 'Patch de clientes, subsegments e annotations no código.',
      serviceId: xrayService.id,
      front: 'Como instrumentar código com o X-Ray SDK e onde colocar annotations no Lambda?',
      back: 'patch_all()/captureAWSv3Client cria subsegments para chamadas ao SDK; subsegments customizados marcam trechos. No Lambda, o segmento da função é um facade: annotations vão em subsegments do código.',
    },
    {
      conceptName: 'Alarmes sem ruído',
      conceptDescription: 'Configurações de alarmes do CloudWatch que evitam falsos positivos.',
      serviceId: cloudWatchService.id,
      front: 'Como evitar alarmes falsos no CloudWatch?',
      back: 'Datapoints to alarm (M de N), treat missing data (ex.: notBreaching em pouco tráfego), composite alarms (AND/OR) e anomaly detection.',
    },
    {
      conceptName: 'Notificações com EventBridge',
      conceptDescription: 'Notificação de eventos de serviços da AWS por regras.',
      serviceId: eventBridgeService.id,
      front: 'Como ser avisado quando um pipeline falha ou um deploy termina?',
      back: 'Regra do EventBridge com padrão para o evento de mudança de estado (ex.: CodePipeline FAILED), com destino SNS, Lambda ou fila.',
    },
    {
      conceptName: 'ADOT',
      conceptDescription: 'AWS Distro for OpenTelemetry.',
      serviceId: xrayService.id,
      front: 'O que é o AWS Distro for OpenTelemetry (ADOT)?',
      back: 'A distribuição da AWS do OpenTelemetry: instrumentação com padrão aberto que envia traces ao X-Ray e métricas ao CloudWatch.',
    },
  ];

  await seedFlashcards(observabilityTopic.id, observabilityFlashcardsToSeed);

  // ---------------------------------------------------------------------
  // Content-authoring push, topic 12 of 12: Domain 4 "Otimização de
  // aplicações", to the exam-readiness bar. Last of the skeleton topics.
  // ---------------------------------------------------------------------

  const optimizationTopic = await prisma.topic.findFirstOrThrow({
    where: { domainId: troubleshootingDomain.id, name: 'Otimização de aplicações' },
  });

  const cloudFrontServiceData = {
    shortName: 'CloudFront',
    category: 'Networking & Content Delivery',
    description: 'CDN que entrega conteúdo a partir de pontos de presença próximos aos usuários, com cache configurável por políticas.',
  };
  const cloudFrontService = await prisma.aWSService.upsert({
    where: { name: 'Amazon CloudFront' },
    update: cloudFrontServiceData,
    create: { name: 'Amazon CloudFront', ...cloudFrontServiceData },
  });

  const lambdaPerformanceLessonContent = `## Objetivo

Ao final desta lição você vai conseguir ajustar memória e concorrência de funções Lambda, reduzir cold starts e escolher entre reserved concurrency, provisioned concurrency e SnapStart.

## Memória é CPU

No Lambda, a memória (128 MB a 10.240 MB) também define a CPU. Para código limitado por CPU, dobrar a memória pode quase reduzir a duração pela metade — e, como o custo é **GB × segundo**, a função fica mais rápida praticamente pelo mesmo preço, até o ponto em que mais CPU deixa de ajudar (por exemplo, código de uma thread só depois de ~1.769 MB, ou código que passa o tempo esperando rede). Para achar esse ponto com dados, o **AWS Lambda Power Tuning** (uma máquina de estados do Step Functions de código aberto) executa a função em várias memórias e mostra duração e custo de cada uma; o **AWS Compute Optimizer** também recomenda memória a partir do uso real. A arquitetura **arm64 (Graviton)** costuma dar melhor preço-desempenho para código compatível.

## Cold starts

Um cold start acontece quando o Lambda precisa criar um ambiente de execução novo: baixar o código, iniciar o runtime e rodar o código de inicialização (fora do handler). Para reduzi-lo:

- Pacote pequeno e só as dependências necessárias.
- Criar clientes do SDK e conexões **fora do handler**, para serem reutilizados nas invocações seguintes do mesmo ambiente (warm starts).
- **Provisioned concurrency**: mantém um número de ambientes já inicializados para uma **versão ou alias** (não para \`$LATEST\`), eliminando cold starts nesse volume — com custo enquanto estiver configurada, e com escalonamento automático via Application Auto Scaling.
- **SnapStart**: tira um snapshot do ambiente já inicializado ao publicar uma versão e restaura a partir dele — disponível para Java, Python e .NET em versões recentes dos runtimes, sem o custo fixo da provisioned concurrency. Código de inicialização precisa lidar com unicidade (ex.: não gerar IDs ou conexões que serão "clonados" entre ambientes).

## Concorrência

Cada região tem uma cota de execuções concorrentes por conta (1.000 por padrão, ajustável). Acima dela, invocações síncronas recebem **429 (\`TooManyRequestsException\`)**; invocações assíncronas são repetidas pelo próprio Lambda por até 6 horas.

- **Reserved concurrency** garante uma parte da cota para uma função **e** limita a função a ela — protege tanto a função (sempre tem capacidade) quanto um recurso a jusante (ex.: um banco que não aguenta mais conexões). Com valor **0**, a função é totalmente bloqueada — um "desligador" de emergência.
- Em **event source mappings do SQS**, a **maximum concurrency** limita quantas funções consomem a fila ao mesmo tempo, sem precisar de reserved concurrency.
- **Batch size** e **batching window** controlam quantos registros cada invocação recebe; mais registros por invocação reduzem custo e overhead. Com **\`ReportBatchItemFailures\`**, a função informa só os itens que falharam, e apenas eles voltam para a fila — em vez de reprocessar o lote inteiro.
- O **visibility timeout** da fila deve ser maior que o timeout da função (a recomendação é pelo menos 6 vezes), para uma mensagem em processamento não ser entregue de novo.

## Relação com a prova DVA-C02

Espere cenários sobre memória/CPU e Power Tuning, clientes fora do handler, provisioned concurrency vs. SnapStart, reserved concurrency (inclusive 0), 429 por limite de concorrência, maximum concurrency no SQS e \`ReportBatchItemFailures\`.`;

  const cacheMessagingLessonContent = `## Objetivo

Ao final desta lição você vai conseguir escolher a camada de cache certa (CloudFront, API Gateway, ElastiCache/DAX), configurar a chave de cache para ter mais acertos, e usar SQS e SNS para reduzir custo e proteger o backend.

## Camadas de cache

- **CloudFront**: cache nas bordas, perto do usuário, para conteúdo estático e respostas de API cacheáveis. O que entra na **chave de cache** é definido por uma **cache policy** (quais headers, cookies e query strings) — cada item incluído multiplica as variações e **reduz a taxa de acertos**. O que o backend precisa receber, mas não deve variar o cache, vai numa **origin request policy**. Prefira nomes de arquivo versionados (\`app.3f2a.js\`) a invalidações, que têm custo e demoram a propagar.
- **Cache do API Gateway** (APIs REST): cache por stage, com TTL padrão de 300 segundos (até 3.600), cobrado por hora conforme o tamanho; parâmetros de requisição podem entrar na chave de cache. Clientes podem pedir para ignorar o cache com \`Cache-Control: max-age=0\` — o que deve ser restrito por permissão.
- **ElastiCache e DAX**: cache perto dos dados, com as estratégias de lazy loading e write-through (tópico de armazenamento).
- **No próprio Lambda**: variáveis globais e \`/tmp\` sobrevivem entre invocações do mesmo ambiente — bons para configurações e dados de referência.

## Mensageria para performance e custo

- **Filas como amortecedor**: uma fila SQS entre a API e um banco absorve picos, e o consumidor processa no ritmo que o banco aguenta.
- **Long polling**: \`ReceiveMessage\` com \`WaitTimeSeconds\` de até **20 segundos** (ou o atributo \`ReceiveMessageWaitTimeSeconds\` da fila) espera mensagens chegarem em vez de voltar vazio na hora — menos requisições vazias, menos custo e menos latência para ver mensagens novas. **Short polling** (0 s) responde imediatamente e pode voltar vazio mesmo com mensagens na fila.
- **Lotes**: \`SendMessageBatch\`, \`DeleteMessageBatch\` e \`ReceiveMessage\` com até 10 mensagens por chamada reduzem o número de requisições cobradas.
- **Mensagens grandes**: o SQS tem um tamanho máximo de mensagem (o limite era de 256 KB por muito tempo e foi ampliado para 1 MiB em 2025); para payloads maiores, guarde o conteúdo no S3 e envie só a referência (o padrão do Extended Client Library).
- **Filter policies do SNS**: uma assinatura pode receber só as mensagens que casam com uma política de filtro, sobre **message attributes** ou sobre o **corpo** da mensagem (\`FilterPolicyScope\`). Cada fila deixa de receber (e de pagar para processar) mensagens irrelevantes. Regras do EventBridge cumprem o mesmo papel para eventos.

## Relação com a prova DVA-C02

Espere cenários sobre a chave de cache do CloudFront (poucos headers → mais acertos), cache do API Gateway por stage e TTL, long polling de até 20 s, operações em lote, payloads grandes via S3, e filter policies do SNS para entregar só o que cada assinante precisa.`;

  const optimizationLessons: LessonSeed[] = [
    {
      order: 1,
      estimatedMinutes: 12,
      title: 'Performance do Lambda: memória, concorrência e cold starts',
      content: lambdaPerformanceLessonContent,
      resources: [
        {
          title: 'Concorrência do Lambda — documentação oficial',
          url: 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html',
        },
        {
          title: 'Lambda SnapStart — documentação oficial',
          url: 'https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html',
        },
      ],
    },
    {
      order: 2,
      estimatedMinutes: 11,
      title: 'Cache e mensageria para performance e custo',
      content: cacheMessagingLessonContent,
      resources: [
        {
          title: 'Chave de cache do CloudFront — documentação oficial',
          url: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-the-cache-key.html',
        },
        {
          title: 'Filter policies do SNS — documentação oficial',
          url: 'https://docs.aws.amazon.com/sns/latest/dg/sns-message-filtering.html',
        },
      ],
    },
  ];

  await seedLessons(optimizationTopic.id, optimizationLessons);

  const cpuFunctionInstructions = `No Console do Lambda, crie a função \`devlab-cpu\` com Python 3.13. Em "Configuration" > "General configuration", ajuste o **timeout para 30 segundos** (mantenha 128 MB de memória). Substitua o código por este, que faz um trabalho só de CPU, e clique em "Deploy":

\`\`\`python
import hashlib
import time


def lambda_handler(event, context):
    inicio = time.time()
    dado = b"devlab"
    for _ in range(300000):
        dado = hashlib.sha256(dado).digest()
    return {"segundos": round(time.time() - inicio, 3), "memoria_mb": int(context.memory_limit_in_mb)}
\`\`\``;

  const memoryMeasureInstructions = `No AWS CloudShell, meça a linha \`REPORT\` com 128 MB, depois com 512 MB e com 1769 MB (invoque duas vezes em cada memória e use a segunda, sem cold start):

\`\`\`bash
medir() {
  aws lambda invoke --function-name devlab-cpu --log-type Tail saida.json --query LogResult --output text | base64 -d | grep REPORT
}
medir; medir
for mem in 512 1769; do
  aws lambda update-function-configuration --function-name devlab-cpu --memory-size $mem > /dev/null
  aws lambda wait function-updated --function-name devlab-cpu
  echo "== $mem MB"; medir; medir
done
\`\`\`

Para cada memória, calcule o custo relativo: \`memória em GB × duração em segundos\` (ex.: 0,125 GB × 4 s = 0,5 GB-s).`;

  const snsFilterSetupInstructions = `No AWS CloudShell, crie o tópico e as duas filas:

\`\`\`bash
aws sns create-topic --name devlab-eventos
aws sqs create-queue --queue-name devlab-pagamentos
aws sqs create-queue --queue-name devlab-todos
\`\`\`

Depois, no Console do SQS, abra cada fila e use "Subscribe to Amazon SNS topic" escolhendo \`devlab-eventos\` (esse caminho já ajusta a access policy da fila para o SNS poder entregar).`;

  const snsPublishInstructions = `Publique três eventos com o atributo \`tipo\` (troque \`ARN-DO-TOPICO\` pelo ARN de \`devlab-eventos\`):

\`\`\`bash
for tipo in pagamento cadastro pagamento; do
  aws sns publish --topic-arn ARN-DO-TOPICO --message "evento de $tipo" --message-attributes "{\\"tipo\\": {\\"DataType\\": \\"String\\", \\"StringValue\\": \\"$tipo\\"}}"
done
\`\`\`

Leia as duas filas com **long polling** e em **lote** (até 10 mensagens por chamada):

\`\`\`bash
for fila in devlab-pagamentos devlab-todos; do
  URL=$(aws sqs get-queue-url --queue-name $fila --query QueueUrl --output text)
  echo "== $fila"
  aws sqs receive-message --queue-url $URL --max-number-of-messages 10 --wait-time-seconds 20 --query "length(Messages)"
done
\`\`\``;

  const longPollingInstructions = `Compare uma leitura de uma fila vazia com short polling e com long polling configurado na própria fila:

\`\`\`bash
URL=$(aws sqs get-queue-url --queue-name devlab-pagamentos --query QueueUrl --output text)
aws sqs purge-queue --queue-url $URL
time aws sqs receive-message --queue-url $URL --wait-time-seconds 0
aws sqs set-queue-attributes --queue-url $URL --attributes ReceiveMessageWaitTimeSeconds=20
time aws sqs receive-message --queue-url $URL
\`\`\``;

  const optimizationLabs: LabSeed[] = [
    {
      title: 'Memória, duração e custo do Lambda, e reserved concurrency',
      data: {
        level: 2,
        order: 1,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá medido como a memória de uma função Lambda muda a duração e o custo de um trabalho de CPU, e usado reserved concurrency igual a zero para bloquear a função numa emergência.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter lido a lição "Performance do Lambda: memória, concorrência e cold starts" ajuda.',
        context:
          'Uma função de processamento está lenta e alguém propôs "aumentar a memória", enquanto outra pessoa diz que isso vai ficar caro. Você vai decidir com números. De quebra, o time quer saber como desligar a função rapidamente se ela começar a sobrecarregar um sistema a jusante.',
        troubleshooting:
          '"Task timed out" com 128 MB: confira se o timeout foi ajustado para 30 segundos. \n\n`ResourceConflictException` ao mudar a memória: a atualização anterior ainda estava em andamento — o `aws lambda wait function-updated` do script evita isso; rode de novo. \n\nO `put-function-concurrency` falha dizendo que a concorrência não reservada ficaria abaixo do mínimo: isso só acontece com valores maiores que 0; reservar 0 é sempre permitido.',
        cleanup:
          'Rode `aws lambda delete-function-concurrency --function-name devlab-cpu` (se ainda não tiver rodado no passo 4) e exclua a função `devlab-cpu` e o log group `/aws/lambda/devlab-cpu`.',
        costWarning:
          'Algumas invocações de poucos segundos ficam dentro do Free Tier do Lambda (medido em GB-segundos).',
      },
      steps: [
        {
          order: 1,
          title: 'Criar a função de CPU',
          instructions: cpuFunctionInstructions,
          validation: 'Um teste no Console devolve `segundos` (alguns segundos com 128 MB) e `memoria_mb: 128`.',
        },
        {
          order: 2,
          title: 'Medir em três memórias',
          instructions: memoryMeasureInstructions,
          validation:
            'A duração cai bastante de 128 MB para 512 MB e de novo para 1769 MB (quase proporcional à memória), enquanto o custo em GB-s fica parecido — a função ficou muito mais rápida praticamente pelo mesmo preço.',
        },
        {
          order: 3,
          title: 'Interpretar o resultado',
          instructions:
            'Compare as três linhas `REPORT`: `Duration`, `Billed Duration` e `Max Memory Used`. Responda: a função precisava de mais memória para guardar dados, ou de mais CPU?',
          validation:
            '`Max Memory Used` fica baixo nas três medições — a função não precisava de memória, e sim da CPU que vem junto com ela. Em produção, o AWS Lambda Power Tuning automatiza essa comparação em várias memórias.',
        },
        {
          order: 4,
          title: 'Bloquear a função com reserved concurrency 0',
          instructions:
            'Rode `aws lambda put-function-concurrency --function-name devlab-cpu --reserved-concurrent-executions 0` e invoque a função com `aws lambda invoke --function-name devlab-cpu saida.json`. Depois remova o bloqueio com `aws lambda delete-function-concurrency --function-name devlab-cpu` e invoque de novo.',
          validation:
            'Com 0, a invocação falha com `TooManyRequestsException` (Rate Exceeded) — a função não roda em nenhuma hipótese. Depois de remover a reserva, ela volta a responder normalmente.',
        },
      ],
    },
    {
      title: 'Filter policies do SNS e long polling no SQS',
      data: {
        level: 2,
        order: 2,
        estimatedMinutes: 25,
        objective:
          'Ao final deste laboratório você terá usado uma filter policy do SNS para que uma fila receba só os eventos que lhe interessam, lido mensagens em lote com long polling, e comparado short e long polling numa fila vazia.',
        prerequisites:
          'Conta AWS com acesso ao Console e ao AWS CloudShell. Ter feito o laboratório de fanout do tópico "Padrões de arquitetura e tolerância a falhas" e lido a lição "Cache e mensageria para performance e custo" ajuda.',
        context:
          'Um tópico de eventos de uma loja entrega tudo para todas as filas, e o serviço de pagamentos gasta tempo e dinheiro descartando eventos de cadastro. Além disso, o consumidor faz milhares de leituras vazias por dia. Você vai resolver os dois desperdícios.',
        troubleshooting:
          'A fila `devlab-pagamentos` recebe os três eventos: a filter policy não foi salva, ou está no escopo errado — ela deve usar o escopo "Message attributes" e o JSON `{"tipo": ["pagamento"]}`. \n\nNenhuma fila recebe nada: confira se as duas assinaturas estão "Confirmed" e se foram criadas pela tela da fila (que ajusta a access policy). \n\n`length(Messages)` mostra `None` ou erro: a fila estava vazia no momento — rode o `receive-message` de novo. \n\nO `purge-queue` reclama de purge recente: só é permitido um purge por fila a cada 60 segundos — espere e rode de novo.',
        cleanup:
          'Exclua o tópico com `aws sns delete-topic --topic-arn ARN-DO-TOPICO` e as filas com `aws sqs delete-queue --queue-url` (use `aws sqs get-queue-url` para cada uma).',
        costWarning:
          'As poucas publicações no SNS e requisições ao SQS ficam dentro do Free Tier.',
      },
      steps: [
        {
          order: 1,
          title: 'Criar o tópico, as filas e as assinaturas',
          instructions: snsFilterSetupInstructions,
          validation: 'O tópico `devlab-eventos` mostra duas assinaturas SQS com status "Confirmed".',
        },
        {
          order: 2,
          title: 'Aplicar a filter policy',
          instructions:
            'No Console do SNS, abra a assinatura da fila `devlab-pagamentos`, clique em "Edit", abra "Subscription filter policy", escolha o escopo **Message attributes** e cole `{"tipo": ["pagamento"]}`. Salve. Não altere a assinatura de `devlab-todos`.',
          validation: 'A assinatura de `devlab-pagamentos` mostra a filter policy; a de `devlab-todos` continua sem filtro.',
        },
        {
          order: 3,
          title: 'Publicar eventos e ler em lote',
          instructions: snsPublishInstructions,
          validation:
            '`devlab-pagamentos` recebe **2** mensagens (só os pagamentos) e `devlab-todos` recebe **3** — o evento de cadastro nunca chegou à fila de pagamentos, e cada fila foi lida com uma única chamada em lote.',
        },
        {
          order: 4,
          title: 'Comparar short e long polling',
          instructions: longPollingInstructions,
          validation:
            'Com `--wait-time-seconds 0` (short polling), a chamada volta vazia na hora; com `ReceiveMessageWaitTimeSeconds=20` na fila, a mesma chamada espera cerca de 20 segundos antes de voltar vazia — num consumidor em laço, isso troca dezenas de requisições vazias cobradas por uma.',
        },
      ],
    },
  ];

  await seedLabs(optimizationTopic.id, optimizationLabs);

  const optimizationQuestionsToSeed: QuestionSeed[] = [
    {
      prompt: 'O que acontece com uma função Lambda configurada com reserved concurrency igual a 0?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Reserved concurrency define quantas execuções simultâneas a função pode ter. Com 0, todas as invocações são bloqueadas (throttled) — é um jeito de desligar a função numa emergência.',
      options: [
        { text: 'Todas as invocações são bloqueadas (throttled).', isCorrect: true, explanation: 'Correto.' },
        { text: 'A função passa a usar concorrência ilimitada.', isCorrect: false, explanation: 'É o contrário.' },
        { text: 'A função volta a usar a cota não reservada da conta.', isCorrect: false, explanation: 'Isso acontece ao remover a reserva, não ao defini-la como 0.' },
        { text: 'A função só roda em cold start.', isCorrect: false, explanation: 'Não tem relação com cold start.' },
      ],
    },
    {
      prompt: 'Qual recurso do Lambda mantém ambientes de execução já inicializados para eliminar cold starts num volume previsto de tráfego?',
      type: 'KNOWLEDGE',
      difficulty: 'EASY',
      explanation:
        'Provisioned concurrency mantém um número de ambientes pré-inicializados para uma versão ou alias, com custo enquanto estiver configurada.',
      options: [
        { text: 'Provisioned concurrency', isCorrect: true, explanation: 'Correto.' },
        { text: 'Reserved concurrency', isCorrect: false, explanation: 'Garante e limita capacidade, mas não pré-inicializa ambientes.' },
        { text: 'Aumentar o timeout', isCorrect: false, explanation: 'Não afeta cold starts.' },
        { text: 'Dead-letter queue', isCorrect: false, explanation: 'Trata falhas, não inicialização.' },
      ],
    },
    {
      prompt: 'Qual é o tempo máximo de espera de uma chamada ReceiveMessage com long polling no Amazon SQS?',
      type: 'KNOWLEDGE',
      difficulty: 'MEDIUM',
      explanation:
        'Long polling espera até 20 segundos por mensagens (WaitTimeSeconds ou ReceiveMessageWaitTimeSeconds), reduzindo respostas vazias e custo.',
      options: [
        { text: '20 segundos', isCorrect: true, explanation: 'Correto.' },
        { text: '60 segundos', isCorrect: false, explanation: 'O máximo é 20 segundos.' },
        { text: '12 horas', isCorrect: false, explanation: 'É o limite de visibility timeout.' },
        { text: '0 segundos', isCorrect: false, explanation: 'É short polling.' },
      ],
    },
    {
      prompt:
        'Uma função Lambda que processa imagens (uso intenso de CPU) está lenta com 256 MB de memória e usa só 90 MB. Qual é a primeira otimização a testar?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'No Lambda, a CPU é proporcional à memória. Aumentar a memória dá mais CPU e costuma reduzir a duração quase proporcionalmente, com custo parecido; o AWS Lambda Power Tuning ajuda a achar a melhor configuração.',
      options: [
        {
          text: 'Aumentar a memória para obter mais CPU, medindo duração e custo (ex.: com o Lambda Power Tuning).',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Reduzir a memória para 128 MB, já que usa só 90 MB.', isCorrect: false, explanation: 'Reduziria também a CPU, deixando a função mais lenta.' },
        { text: 'Aumentar o timeout.', isCorrect: false, explanation: 'Evita timeouts, mas não acelera a função.' },
        { text: 'Configurar reserved concurrency.', isCorrect: false, explanation: 'Não muda a velocidade de cada execução.' },
      ],
    },
    {
      prompt:
        'Uma função Lambda abre uma conexão com o banco de dados dentro do handler a cada invocação, e a latência e o número de conexões são altos. Qual é a otimização recomendada?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Clientes e conexões criados fora do handler, no código de inicialização, são reutilizados pelas invocações seguintes do mesmo ambiente de execução.',
      options: [
        {
          text: 'Criar a conexão fora do handler, para ser reutilizada entre invocações do mesmo ambiente.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Abrir duas conexões por invocação.', isCorrect: false, explanation: 'Piora o problema.' },
        { text: 'Aumentar o timeout da função.', isCorrect: false, explanation: 'Não reduz o custo de abrir conexões.' },
        { text: 'Usar invocação assíncrona.', isCorrect: false, explanation: 'Não muda onde a conexão é criada.' },
      ],
    },
    {
      prompt:
        'Um tópico SNS publica eventos de vários tipos, mas a fila do serviço de pagamentos só precisa dos eventos com o atributo tipo = pagamento. Qual é a solução mais eficiente?',
      type: 'APPLICATION',
      difficulty: 'MEDIUM',
      explanation:
        'Uma subscription filter policy faz o SNS entregar à assinatura só as mensagens que casam com o filtro, sem que o consumidor precise receber e descartar as demais.',
      officialReferences: 'https://docs.aws.amazon.com/sns/latest/dg/sns-message-filtering.html',
      options: [
        { text: 'Uma filter policy na assinatura da fila de pagamentos.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Filtrar no código do consumidor e descartar o resto.', isCorrect: false, explanation: 'Funciona, mas paga para receber e processar mensagens inúteis.' },
        { text: 'Criar um tópico por consumidor e publicar em todos.', isCorrect: false, explanation: 'Joga a responsabilidade de filtrar para o produtor.' },
        { text: 'Usar uma fila FIFO.', isCorrect: false, explanation: 'FIFO ordena mensagens, não filtra.' },
      ],
    },
    {
      prompt:
        'Uma função Lambda consome uma fila SQS e grava num banco que só aguenta 10 conexões simultâneas. Nos picos, a função escala e o banco cai. Qual é a forma mais direta de limitar os consumidores?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'A configuração maximum concurrency do event source mapping do SQS limita quantas invocações simultâneas a fila dispara; as mensagens excedentes esperam na fila.',
      options: [
        {
          text: 'Configurar maximum concurrency no event source mapping do SQS.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Aumentar a memória da função.', isCorrect: false, explanation: 'Não limita a concorrência.' },
        { text: 'Reduzir o período de retenção da fila.', isCorrect: false, explanation: 'Faria mensagens expirarem sem processamento.' },
        { text: 'Trocar a fila por um tópico SNS.', isCorrect: false, explanation: 'Perde o amortecimento que a fila oferece.' },
      ],
    },
    {
      prompt:
        'A taxa de acertos de cache de uma distribuição do CloudFront está muito baixa, e a cache policy inclui todos os headers, cookies e query strings na chave de cache. Qual é a correção?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Cada header, cookie ou query string na chave de cache multiplica as variações. Incluir só o que realmente muda a resposta aumenta os acertos; o que o backend precisa receber sem variar o cache vai numa origin request policy.',
      officialReferences:
        'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-the-cache-key.html',
      options: [
        {
          text: 'Incluir na chave de cache só os valores que mudam a resposta e usar uma origin request policy para o resto.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Invalidar o cache a cada minuto.', isCorrect: false, explanation: 'Reduz ainda mais os acertos e tem custo.' },
        { text: 'Reduzir o TTL para 0.', isCorrect: false, explanation: 'Desliga o cache.' },
        { text: 'Adicionar mais origens à distribuição.', isCorrect: false, explanation: 'Não muda a chave de cache.' },
      ],
    },
    {
      prompt:
        'Uma API REST recebe milhares de requisições GET idênticas por minuto para um relatório que muda uma vez por hora, e o backend está sobrecarregado. Qual é a solução mais simples no próprio API Gateway?',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      explanation:
        'Habilitar o cache do stage do API Gateway com um TTL adequado (até 3.600 segundos) faz as respostas repetidas saírem do cache, sem chegar ao backend.',
      options: [
        { text: 'Habilitar o cache do stage com um TTL adequado.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Aumentar o throttling do stage.', isCorrect: false, explanation: 'Rejeitaria requisições em vez de respondê-las.' },
        { text: 'Criar mais stages.', isCorrect: false, explanation: 'Não reduz as chamadas ao backend.' },
        { text: 'Trocar a integração por uma integração mock.', isCorrect: false, explanation: 'Deixaria de devolver o relatório real.' },
      ],
    },
    {
      prompt:
        'Uma função Lambda em Java tem cold starts de vários segundos, causados por uma inicialização pesada de frameworks. O time quer reduzi-los sem o custo fixo de manter ambientes sempre provisionados. Qual recurso atende?',
      type: 'SCENARIO',
      difficulty: 'HARD',
      explanation:
        'O Lambda SnapStart tira um snapshot do ambiente já inicializado ao publicar uma versão e restaura a partir dele nos cold starts, sem o custo fixo da provisioned concurrency.',
      officialReferences: 'https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html',
      options: [
        { text: 'Lambda SnapStart.', isCorrect: true, explanation: 'Correto.' },
        { text: 'Provisioned concurrency.', isCorrect: false, explanation: 'Elimina cold starts, mas com o custo fixo que o time quer evitar.' },
        { text: 'Reserved concurrency.', isCorrect: false, explanation: 'Não reduz o tempo de inicialização.' },
        { text: 'Aumentar o timeout.', isCorrect: false, explanation: 'Não reduz o cold start.' },
      ],
    },
    {
      prompt:
        'Um desenvolvedor tenta configurar provisioned concurrency na versão $LATEST de uma função e recebe um erro. Como resolver?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Provisioned concurrency só pode ser configurada numa versão publicada ou num alias que aponta para uma versão, nunca em $LATEST.',
      options: [
        {
          text: 'Publicar uma versão e configurar a provisioned concurrency nela ou num alias que aponte para ela.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Aumentar a cota de concorrência da conta.', isCorrect: false, explanation: 'O erro não é de cota.' },
        { text: 'Usar reserved concurrency em $LATEST antes.', isCorrect: false, explanation: 'Não habilita provisioned concurrency em $LATEST.' },
        { text: 'Trocar o runtime para Java.', isCorrect: false, explanation: 'A regra vale para qualquer runtime.' },
      ],
    },
    {
      prompt:
        'Nos picos de tráfego, chamadas síncronas a várias funções Lambda da mesma conta começam a receber TooManyRequestsException (429). Qual é a causa mais provável?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'A cota de execuções concorrentes da conta na região foi atingida. Soluções incluem pedir aumento de cota, reservar concorrência para funções críticas e reduzir a duração das funções.',
      options: [
        {
          text: 'A cota de execuções concorrentes da conta na região foi atingida.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'As funções estão sem memória.', isCorrect: false, explanation: 'Geraria erros de execução, não 429.' },
        { text: 'O timeout das funções é curto demais.', isCorrect: false, explanation: 'Geraria erros de timeout.' },
        { text: 'As funções não têm permissão para ser invocadas.', isCorrect: false, explanation: 'Geraria erro de permissão (403).' },
      ],
    },
    {
      prompt:
        'Uma função Lambda processa lotes de 10 mensagens de uma fila SQS. Quando uma mensagem falha, o lote inteiro volta para a fila e as 9 mensagens boas são reprocessadas. Como evitar isso?',
      type: 'EXAM_LEVEL',
      difficulty: 'HARD',
      explanation:
        'Habilitando ReportBatchItemFailures no event source mapping, a função devolve os IDs das mensagens que falharam, e só elas voltam para a fila.',
      options: [
        {
          text: 'Habilitar ReportBatchItemFailures e devolver só os IDs das mensagens que falharam.',
          isCorrect: true,
          explanation: 'Correto.',
        },
        { text: 'Reduzir o batch size para 1.', isCorrect: false, explanation: 'Resolve, mas aumenta muito o número de invocações e o custo.' },
        { text: 'Aumentar o visibility timeout.', isCorrect: false, explanation: 'Não evita o reprocessamento do lote inteiro.' },
        { text: 'Trocar a fila Standard por FIFO.', isCorrect: false, explanation: 'Não muda o tratamento de falhas parciais.' },
      ],
    },
    {
      prompt:
        'Um time quer reduzir o custo de funções Lambda escritas em Python puro, sem mudar o código. Qual opção costuma dar melhor preço-desempenho?',
      type: 'EXAM_LEVEL',
      difficulty: 'MEDIUM',
      explanation:
        'A arquitetura arm64 (processadores Graviton) costuma oferecer melhor preço-desempenho para código compatível, como Python puro.',
      options: [
        { text: 'Trocar a arquitetura da função para arm64 (Graviton).', isCorrect: true, explanation: 'Correto.' },
        { text: 'Aumentar o timeout.', isCorrect: false, explanation: 'Não reduz custo.' },
        { text: 'Configurar provisioned concurrency.', isCorrect: false, explanation: 'Adiciona custo fixo.' },
        { text: 'Mover as funções para o Elastic Beanstalk.', isCorrect: false, explanation: 'Muda toda a arquitetura, não é uma otimização sem código.' },
      ],
    },
  ];

  await seedQuestions(optimizationTopic.id, optimizationQuestionsToSeed);

  const optimizationFlashcardsToSeed: FlashcardSeed[] = [
    {
      conceptName: 'Memória, CPU e Power Tuning',
      conceptDescription: 'Ajuste de memória de funções Lambda com base em medições.',
      serviceId: lambdaService.id,
      front: 'Como achar a memória ideal de uma função Lambda?',
      back: 'Medindo duração e custo (GB × s) em várias memórias — o AWS Lambda Power Tuning automatiza isso. Código de CPU costuma ficar bem mais rápido com mais memória por um custo parecido.',
    },
    {
      conceptName: 'Cold start e código de inicialização',
      conceptDescription: 'Redução de cold starts e reutilização de recursos entre invocações.',
      serviceId: lambdaService.id,
      front: 'Como reduzir cold starts e o custo de cada invocação no Lambda?',
      back: 'Pacote pequeno e clientes/conexões criados fora do handler (reutilizados em warm starts); para eliminar cold starts: provisioned concurrency ou SnapStart.',
    },
    {
      conceptName: 'Provisioned concurrency vs. SnapStart',
      conceptDescription: 'As duas formas de combater cold starts no Lambda.',
      serviceId: lambdaService.id,
      front: 'Qual a diferença entre provisioned concurrency e SnapStart?',
      back: 'Provisioned: ambientes sempre inicializados numa versão/alias (não em $LATEST), com custo fixo. SnapStart: restaura um snapshot do ambiente inicializado (Java, Python, .NET), sem custo fixo.',
    },
    {
      conceptName: 'Reserved concurrency',
      conceptDescription: 'Reserva e limite de concorrência por função.',
      serviceId: lambdaService.id,
      front: 'O que a reserved concurrency faz e o que acontece com o valor 0?',
      back: 'Garante e limita a concorrência da função (protege a função e recursos a jusante). Com 0, todas as invocações são bloqueadas — um desligador de emergência.',
    },
    {
      conceptName: 'Event source mapping do SQS',
      conceptDescription: 'Ajustes de consumo de filas SQS pelo Lambda.',
      serviceId: sqsService.id,
      front: 'Quais ajustes otimizam uma função Lambda que consome SQS?',
      back: 'Maximum concurrency (limita consumidores), batch size e batching window, ReportBatchItemFailures (só as falhas voltam) e visibility timeout de pelo menos 6x o timeout da função.',
    },
    {
      conceptName: 'Long polling e lotes no SQS',
      conceptDescription: 'Redução de requisições e custo no SQS.',
      serviceId: sqsService.id,
      front: 'Como reduzir o custo de requisições ao SQS?',
      back: 'Long polling (WaitTimeSeconds até 20 s) evita respostas vazias; operações em lote (até 10 mensagens por chamada) reduzem o número de requisições.',
    },
    {
      conceptName: 'Filter policies do SNS',
      conceptDescription: 'Entrega seletiva de mensagens por assinatura.',
      serviceId: snsService.id,
      front: 'Como fazer um assinante do SNS receber só parte das mensagens?',
      back: 'Com uma subscription filter policy, sobre message attributes ou sobre o corpo da mensagem (FilterPolicyScope).',
    },
    {
      conceptName: 'Chave de cache do CloudFront',
      conceptDescription: 'Cache policies e origin request policies no CloudFront.',
      serviceId: cloudFrontService.id,
      front: 'Como aumentar a taxa de acertos de cache do CloudFront?',
      back: 'Incluir na cache policy só os headers, cookies e query strings que mudam a resposta; o que o backend precisa receber vai numa origin request policy. Prefira arquivos versionados a invalidações.',
    },
    {
      conceptName: 'Cache do API Gateway',
      conceptDescription: 'Cache por stage de APIs REST.',
      serviceId: apiGatewayService.id,
      front: 'Como funciona o cache do API Gateway?',
      back: 'É habilitado por stage (APIs REST), com TTL padrão de 300 s (até 3.600 s), cobrado por hora conforme o tamanho; parâmetros podem entrar na chave de cache.',
    },
    {
      conceptName: 'Throttling por concorrência',
      conceptDescription: 'Comportamento do Lambda ao atingir a cota de concorrência.',
      serviceId: lambdaService.id,
      front: 'O que acontece quando a cota de concorrência do Lambda é atingida?',
      back: 'Invocações síncronas recebem 429 (TooManyRequestsException); assíncronas são repetidas pelo Lambda por até 6 horas. Cota padrão: 1.000 por conta e região (ajustável).',
    },
  ];

  await seedFlashcards(optimizationTopic.id, optimizationFlashcardsToSeed);

  const domainCount = await prisma.domain.count({ where: { examVersionId: examVersion.id } });
  const topicCount = await prisma.topic.count({ where: { domain: { examVersionId: examVersion.id } } });

  console.log('Seed done:', {
    certification: certification.slug,
    examVersion: examVersion.code,
    topic: topic.name,
    domains: domainCount,
    topics: topicCount,
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
