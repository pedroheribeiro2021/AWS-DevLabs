/**
 * Long lessons are studied in shorter parts: each part is its own lesson (a
 * node on the learning path with its own practice session). The content stays
 * written as one lesson in seed.ts; this file says where it's cut.
 *
 * Keyed by the lesson's title in seed.ts. Each part starts at a `## ` heading
 * of the original content (the first part starts at the top, so `startsAt` is
 * omitted) and gets its own "Objetivo" section in place of the original one.
 * The first part keeps the original database row (and its progress) by being
 * matched through the original title.
 */
export type LessonPart = {
  title: string;
  startsAt?: string;
  estimatedMinutes: number;
  objective: string;
};

export const lessonParts: Record<string, LessonPart[]> = {
  'Arquiteturas desacopladas e tolerantes a falhas': [
    {
      title: 'Arquiteturas desacopladas: eventos, fanout e coreografia',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir escolher entre monolito, microsserviços e arquitetura orientada a eventos, desacoplar componentes com filas e tópicos, montar um fanout com SNS + SQS e diferenciar coreografia de orquestração.',
    },
    {
      title: 'Tolerância a falhas: retry, dead-letter queues e idempotência',
      startsAt: 'Retry com backoff exponencial e jitter',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir aplicar as técnicas de tolerância a falhas que a prova DVA-C02 mais cobra: retry com backoff exponencial e jitter, dead-letter queues e consumidores idempotentes.',
    },
  ],
  'Modelagem e operações no Amazon DynamoDB': [
    {
      title: 'DynamoDB: chaves, partições e operações',
      estimatedMinutes: 7,
      objective:
        'Ao final desta parte você vai conseguir decidir entre um banco relacional e o DynamoDB, projetar a chave primária a partir dos padrões de acesso e usar Query, Scan e as operações de escrita do jeito que a prova espera.',
    },
    {
      title: 'DynamoDB: índices, consistência e capacidade',
      startsAt: 'Índices secundários: LSI e GSI',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir escolher entre LSI e GSI, calcular capacidade de leitura e escrita, decidir entre leitura forte e eventual, e usar TTL e Streams.',
    },
  ],
  'Estratégias de cache e ciclo de vida de dados no S3': [
    {
      title: 'Estratégias de cache: lazy loading, write-through e DAX',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir escolher uma estratégia de cache (lazy loading, write-through, read-through, TTL) e decidir entre ElastiCache e DAX.',
    },
    {
      title: 'Classes de armazenamento e ciclo de vida no S3',
      startsAt: 'Classes de armazenamento do S3',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir escolher a classe de armazenamento do Amazon S3 para cada padrão de acesso e definir regras de ciclo de vida que reduzem custo.',
    },
  ],
  'AWS KMS e criptografia envelope': [
    {
      title: 'AWS KMS: tipos de chave e rotação',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir explicar o que o AWS KMS faz, diferenciar os tipos de chave e entender o que acontece quando uma chave é rotacionada.',
    },
    {
      title: 'Criptografia envelope, key policies e cotas do KMS',
      startsAt: 'Criptografia envelope',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir aplicar criptografia envelope, controlar o acesso a chaves com key policies e grants, e reconhecer os limites do KMS que a prova DVA-C02 costuma cobrar.',
    },
  ],
  'Criptografia em repouso, em trânsito e certificados': [
    {
      title: 'Criptografia em repouso no S3 e em outros serviços',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir escolher o tipo de criptografia em repouso certo para o S3 (SSE-S3, SSE-KMS, SSE-C) e para os outros serviços que a prova cobra.',
    },
    {
      title: 'Criptografia em trânsito e certificados com o ACM',
      startsAt: 'Criptografia em trânsito',
      estimatedMinutes: 4,
      objective:
        'Ao final desta parte você vai conseguir exigir criptografia em trânsito e usar o AWS Certificate Manager para certificados TLS.',
    },
  ],
  'Secrets Manager e Parameter Store': [
    {
      title: 'Segredos fora do código: o Parameter Store',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir explicar por que segredos não ficam no código e usar o Parameter Store do AWS Systems Manager: tipos de parâmetro, hierarquias e níveis.',
    },
    {
      title: 'Secrets Manager e segredos em infraestrutura como código',
      startsAt: 'Secrets Manager',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir usar o AWS Secrets Manager e sua rotação, escolher entre ele e o Parameter Store, e injetar segredos em infraestrutura como código sem expô-los.',
    },
  ],
  'Dados sensíveis na aplicação: Lambda, cache e logs': [
    {
      title: 'Dados sensíveis: classificação e variáveis de ambiente do Lambda',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir classificar dados sensíveis e proteger o que vai nas variáveis de ambiente do Lambda.',
    },
    {
      title: 'Segredos em tempo de execução e dados sensíveis nos logs',
      startsAt: 'Buscando segredos com eficiência',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir buscar segredos em tempo de execução com eficiência (cache e extensão do Lambda) e evitar que dados sensíveis vazem em logs.',
    },
  ],
  'Pacotes de deploy do Lambda: zip, layers e imagens de container': [
    {
      title: 'Pacotes .zip do Lambda e dependências nativas',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir montar um pacote .zip do Lambda corretamente, respeitar os limites de tamanho e empacotar dependências nativas para o ambiente do Lambda.',
    },
    {
      title: 'Layers e imagens de container no Lambda',
      startsAt: 'Layers',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir usar layers para compartilhar dependências e decidir quando empacotar uma função como imagem de container.',
    },
  ],
  'Empacotamento e configuração: SAM, CloudFormation, Elastic Beanstalk e AppConfig': [
    {
      title: 'Configuração separada do código e estrutura de um projeto SAM',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir separar configuração de código (variáveis, Parameter Store, AppConfig) e organizar um projeto serverless com o AWS SAM.',
    },
    {
      title: 'Do código ao artefato: CloudFormation package e Elastic Beanstalk',
      startsAt: 'Do código local ao artefato no S3',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir explicar o que `package` e `deploy` fazem com os artefatos e preparar um source bundle do Elastic Beanstalk.',
    },
  ],
  'Versões, aliases e stages: ambientes de desenvolvimento na AWS': [
    {
      title: 'Versões e aliases do Lambda',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir publicar versões do Lambda, apontar aliases para elas e liberar uma versão nova para uma fração do tráfego.',
    },
    {
      title: 'Stages do API Gateway e ambientes separados',
      startsAt: 'Stages do API Gateway',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir usar stages e stage variables do API Gateway para manter ambientes de desenvolvimento, teste e produção separados.',
    },
  ],
  'Testando aplicações serverless: mocks, integração e SAM local': [
    {
      title: 'Testes serverless: a pirâmide de testes e eventos realistas',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir escolher entre testes unitários com mocks e testes de integração na nuvem, e testar funções com eventos realistas.',
    },
    {
      title: 'SAM CLI local e integração mock do API Gateway',
      startsAt: 'SAM CLI local',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir executar funções localmente com o SAM CLI e usar integrações mock do API Gateway para destravar o desenvolvimento.',
    },
  ],
  'Testes automatizados no pipeline: CodeBuild e buildspec': [
    {
      title: 'Testes no pipeline: o buildspec do CodeBuild',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir escrever um `buildspec.yml` que instala dependências, roda testes e publica relatórios no AWS CodeBuild.',
    },
    {
      title: 'Testes em cada stage do pipeline',
      startsAt: 'Testes em cada stage',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir posicionar testes unitários, de integração e aprovações manuais nos stages de um pipeline do AWS CodePipeline.',
    },
  ],
  'CodePipeline, CodeDeploy e estratégias de deploy': [
    {
      title: 'CodePipeline: como um pipeline é organizado',
      estimatedMinutes: 4,
      objective:
        'Ao final desta parte você vai conseguir montar um pipeline no AWS CodePipeline: stages, actions, artefatos e conexão com o repositório.',
    },
    {
      title: 'CodeDeploy: estratégias de deploy e rollback',
      startsAt: 'CodeDeploy: conceitos',
      estimatedMinutes: 8,
      objective:
        'Ao final desta parte você vai conseguir configurar deploys no AWS CodeDeploy para EC2, Lambda e ECS, e escolher a estratégia de deploy e de rollback certa para cada cenário.',
    },
  ],
  'Deploy com SAM, CDK, Elastic Beanstalk e Amplify': [
    {
      title: 'Deploys seguros com o SAM e o CDK',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir fazer deploys graduais e seguros com o AWS SAM e entender o ciclo do AWS CDK.',
    },
    {
      title: 'Deploy com Elastic Beanstalk e Amplify',
      startsAt: 'Políticas de deploy do Elastic Beanstalk',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir escolher a política de deploy do Elastic Beanstalk para cada cenário e usar o Amplify Hosting para frontends.',
    },
  ],
  'Investigando falhas com logs, métricas e códigos de erro': [
    {
      title: 'Investigando falhas com CloudWatch Logs e Logs Insights',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir encontrar a causa de uma falha nos logs do CloudWatch e escrever consultas no CloudWatch Logs Insights.',
    },
    {
      title: 'Métricas, códigos HTTP e exceções de SDK',
      startsAt: 'Métricas que apontam a causa',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir usar as métricas certas do Lambda e do API Gateway e interpretar os códigos HTTP e as exceções de SDK que a prova DVA-C02 cobra.',
    },
  ],
  'Rastreando requisições com X-Ray e diagnosticando deploys': [
    {
      title: 'Rastreando requisições com o X-Ray',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir usar o AWS X-Ray para encontrar qual serviço causa erros ou lentidão numa requisição distribuída.',
    },
    {
      title: 'Diagnosticando falhas de deploy',
      startsAt: 'Diagnosticando falhas de deploy',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir diagnosticar falhas de deploy com os eventos e logs de cada serviço, e descobrir quem mudou o quê com o CloudTrail.',
    },
  ],
  'Logs estruturados e métricas customizadas': [
    {
      title: 'Observabilidade e logs estruturados',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir diferenciar logging, monitoramento e observabilidade e escrever logs estruturados úteis.',
    },
    {
      title: 'Métricas customizadas no CloudWatch',
      startsAt: 'Métricas customizadas',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir publicar métricas customizadas no CloudWatch da forma mais eficiente e escolher dimensões e resolução.',
    },
  ],
  'Tracing, alarmes e notificações': [
    {
      title: 'Instrumentando traces com X-Ray e OpenTelemetry',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir instrumentar código com o X-Ray SDK (ou OpenTelemetry) e saber onde colocar annotations e metadata.',
    },
    {
      title: 'Alarmes e notificações sobre eventos',
      startsAt: 'Alarmes do CloudWatch',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir configurar alarmes que não disparam à toa e notificar o time sobre eventos como falhas de pipeline e cotas perto do limite.',
    },
  ],
  'Performance do Lambda: memória, concorrência e cold starts': [
    {
      title: 'Performance do Lambda: memória e cold starts',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir ajustar a memória de uma função Lambda e reduzir cold starts.',
    },
    {
      title: 'Concorrência no Lambda',
      startsAt: 'Concorrência',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir escolher entre reserved concurrency, provisioned concurrency e SnapStart, e prever o que acontece quando a cota de concorrência é atingida.',
    },
  ],
  'Cache e mensageria para performance e custo': [
    {
      title: 'Camadas de cache para performance',
      estimatedMinutes: 5,
      objective:
        'Ao final desta parte você vai conseguir escolher a camada de cache certa (CloudFront, API Gateway, ElastiCache/DAX) e configurar a chave de cache para ter mais acertos.',
    },
    {
      title: 'Mensageria para performance e custo',
      startsAt: 'Mensageria para performance e custo',
      estimatedMinutes: 6,
      objective:
        'Ao final desta parte você vai conseguir usar SQS e SNS para reduzir custo e proteger o backend.',
    },
  ],
};

type SplittableLesson = {
  title: string;
  estimatedMinutes: number;
  content: string;
  previousTitle?: string;
};

/**
 * Expands a lesson listed in lesson-parts.ts into its parts: each part is the
 * original content from its starting `## ` heading up to the next part's, with
 * its own "Objetivo" section in place of the original one. Throws if a
 * configured heading isn't in the content, so a renamed heading can't silently
 * produce a wrong split.
 */
export function splitIntoParts<T extends SplittableLesson>(lesson: T): T[] {
  const parts = lessonParts[lesson.title];
  if (!parts) {
    return [lesson];
  }

  const sections = lesson.content.split(/\n(?=## )/).map((section) => section.trim());
  if (!sections[0].startsWith('## Objetivo')) {
    throw new Error(`Lesson "${lesson.title}" must start with "## Objetivo" to be split into parts.`);
  }
  const starts = parts.map((part, index) => {
    if (index === 0) {
      return 1;
    }
    const start = sections.findIndex((section) => section.split('\n')[0] === `## ${part.startsAt}`);
    if (start <= 0) {
      throw new Error(`Lesson "${lesson.title}" has no "## ${part.startsAt}" heading to start a part at.`);
    }
    return start;
  });
  starts.forEach((start, index) => {
    if (index > 0 && start <= starts[index - 1]) {
      throw new Error(`Parts of lesson "${lesson.title}" are out of order.`);
    }
  });

  return parts.map((part, index) => ({
    ...lesson,
    title: part.title,
    estimatedMinutes: part.estimatedMinutes,
    previousTitle: index === 0 ? lesson.title : undefined,
    content: [`## Objetivo\n\n${part.objective}`, ...sections.slice(starts[index], starts[index + 1])].join('\n\n'),
  }));
}
