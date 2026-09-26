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
