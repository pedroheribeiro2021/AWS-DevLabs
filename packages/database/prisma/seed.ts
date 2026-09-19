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
        code: 'DVA-C02',
      },
    },
    update: {},
    create: {
      certificationId: certification.id,
      code: 'DVA-C02',
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

## Relação com a prova DVA-C02

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

  const existingLab = await prisma.lab.findFirst({
    where: { topicId: topic.id, title: 'Criar e invocar sua primeira função Lambda' },
  });

  if (!existingLab) {
    await prisma.lab.create({
      data: {
        topicId: topic.id,
        title: 'Criar e invocar sua primeira função Lambda',
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
    const existingQuestion = await prisma.question.findFirst({
      where: { topicId: topic.id, prompt: q.prompt },
    });

    if (!existingQuestion) {
      await prisma.question.create({
        data: {
          topicId: topic.id,
          type: q.type,
          difficulty: q.difficulty,
          prompt: q.prompt,
          explanation: q.explanation,
          officialReferences: q.officialReferences,
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
    const concept =
      (await prisma.concept.findFirst({
        where: { topicId: topic.id, name: card.conceptName },
      })) ??
      (await prisma.concept.create({
        data: {
          topicId: topic.id,
          name: card.conceptName,
          description: card.conceptDescription,
          awsServices: { connect: { id: lambdaService.id } },
        },
      }));

    const existingFlashcard = await prisma.flashcard.findFirst({
      where: { conceptId: concept.id, front: card.front },
    });

    if (!existingFlashcard) {
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
    const existingTopic = await prisma.topic.findFirst({
      where: { domainId: domain.id, name: def.name },
    });
    if (!existingTopic) {
      await prisma.topic.create({
        data: {
          domainId: domain.id,
          name: def.name,
          order: index + 2,
          learningObjectives: { create: [{ description: def.objective, order: 1 }] },
        },
      });
    }
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
    const newDomain = await prisma.domain.upsert({
      where: {
        examVersionId_code: { examVersionId: examVersion.id, code: domainDef.code },
      },
      update: {},
      create: {
        examVersionId: examVersion.id,
        code: domainDef.code,
        // Nome oficial do domínio no exam guide da AWS (mantido em inglês), como
        // no domain-1 acima; o conteúdo dentro dele é ensinado em português.
        name: domainDef.name,
        weightPercent: domainDef.weightPercent,
        order: domainDef.order,
      },
    });

    for (const [index, topicDef] of domainDef.topics.entries()) {
      const existingTopic = await prisma.topic.findFirst({
        where: { domainId: newDomain.id, name: topicDef.name },
      });
      if (!existingTopic) {
        await prisma.topic.create({
          data: {
            domainId: newDomain.id,
            name: topicDef.name,
            order: index + 1,
            learningObjectives: { create: [{ description: topicDef.objective, order: 1 }] },
          },
        });
      }
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
