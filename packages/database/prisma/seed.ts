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

  const authQuestionsToSeed: {
    prompt: string;
    type: 'KNOWLEDGE' | 'APPLICATION' | 'SCENARIO' | 'EXAM_LEVEL';
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    explanation: string;
    officialReferences?: string;
    options: { text: string; isCorrect: boolean; explanation: string }[];
  }[] = [
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

  for (const q of authQuestionsToSeed) {
    const questionData = {
      type: q.type,
      difficulty: q.difficulty,
      explanation: q.explanation,
      officialReferences: q.officialReferences,
    };

    const existingQuestion = await prisma.question.findFirst({
      where: { topicId: authTopic.id, prompt: q.prompt },
    });

    if (existingQuestion) {
      await prisma.question.update({ where: { id: existingQuestion.id }, data: questionData });
    } else {
      await prisma.question.create({
        data: {
          topicId: authTopic.id,
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

  const authFlashcardsToSeed: { conceptName: string; conceptDescription: string; front: string; back: string }[] = [
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

  for (const card of authFlashcardsToSeed) {
    const existingConcept = await prisma.concept.findFirst({
      where: { topicId: authTopic.id, name: card.conceptName },
    });

    const concept = existingConcept
      ? await prisma.concept.update({
          where: { id: existingConcept.id },
          data: { description: card.conceptDescription },
        })
      : await prisma.concept.create({
          data: {
            topicId: authTopic.id,
            name: card.conceptName,
            description: card.conceptDescription,
            awsServices: { connect: { id: cognitoService.id } },
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

  const architectureQuestionsToSeed: {
    prompt: string;
    type: 'KNOWLEDGE' | 'APPLICATION' | 'SCENARIO' | 'EXAM_LEVEL';
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    explanation: string;
    officialReferences?: string;
    options: { text: string; isCorrect: boolean; explanation: string }[];
  }[] = [
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

  for (const q of architectureQuestionsToSeed) {
    const questionData = {
      type: q.type,
      difficulty: q.difficulty,
      explanation: q.explanation,
      officialReferences: q.officialReferences,
    };

    const existingQuestion = await prisma.question.findFirst({
      where: { topicId: architectureTopic.id, prompt: q.prompt },
    });

    if (existingQuestion) {
      await prisma.question.update({ where: { id: existingQuestion.id }, data: questionData });
    } else {
      await prisma.question.create({
        data: {
          topicId: architectureTopic.id,
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

  const architectureFlashcardsToSeed: {
    conceptName: string;
    conceptDescription: string;
    serviceId: string;
    front: string;
    back: string;
  }[] = [
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

  for (const card of architectureFlashcardsToSeed) {
    const existingConcept = await prisma.concept.findFirst({
      where: { topicId: architectureTopic.id, name: card.conceptName },
    });

    const concept = existingConcept
      ? await prisma.concept.update({
          where: { id: existingConcept.id },
          data: { description: card.conceptDescription },
        })
      : await prisma.concept.create({
          data: {
            topicId: architectureTopic.id,
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
