/**
 * Wrong answers for each flashcard, keyed by its front. Practice sessions used
 * to draw wrong options from other cards' backs, which answer a different
 * question and can be ruled out without thinking. These are near misses to the
 * same question instead: a swapped pair, a wrong number or limit, the right
 * idea with one wrong detail, or a common misconception — written in the same
 * style and length as the real answer, so picking the right one takes knowing it.
 */
export const flashcardDistractors: Record<string, [string, string, string]> = {
  // Fundamentos do AWS Lambda
  'Para que serve a execution role de uma função Lambda?': [
    'É a policy baseada em recurso que define quem pode invocar a função (ex.: permitir que o S3 ou o API Gateway a chamem); o acesso da função a outros serviços vem da policy de quem fez o deploy.',
    'É a role que o serviço Lambda usa só para criar e escalar os ambientes de execução; o código da função acessa outros serviços com chaves de acesso configuradas nas variáveis de ambiente.',
    'É a role do IAM que o CloudFormation assume para criar a função no deploy; depois de criada, a função acessa outros serviços com as permissões da conta que a invocou.',
  ],
  'Qual é o tempo máximo de execução permitido para uma função Lambda?': [
    'quinze minutos (900 segundos) por padrão, mas o limite pode ser ampliado para até 1 hora com um pedido de aumento de cota no Service Quotas.',
    'cinco minutos (300 segundos). Esse limite é fixo; cargas mais longas precisam ser divididas em invocações encadeadas ou ir para o Step Functions.',
    'quinze minutos para invocações assíncronas e 29 segundos para invocações síncronas, que seguem o mesmo limite do API Gateway.',
  ],
  'O que acontece quando você aumenta a memória alocada para uma função Lambda?': [
    'Só a RAM disponível aumenta; a CPU é fixa em 1 vCPU em qualquer configuração, então mais memória só ajuda funções que estão estourando a memória.',
    'A CPU aumenta proporcionalmente, mas o custo por invocação sempre sobe na mesma proporção, porque a cobrança é pela memória alocada, independentemente da duração.',
    'A memória e o tempo máximo de execução aumentam juntos: cada 128 MB adicionais liberam mais um minuto de timeout, até o teto de 15 minutos.',
  ],
  'O que é um event source mapping no Lambda?': [
    'É a configuração em que a fonte (SQS, Kinesis, DynamoDB Streams) invoca a função de forma assíncrona, um registro por invocação, sem que o Lambda faça polling.',
    'É a policy baseada em recurso que autoriza serviços como S3, SNS e EventBridge a invocar a função quando um evento acontece.',
    'É o recurso que envia o resultado de cada invocação assíncrona para um destino (SQS, SNS, EventBridge), separando sucessos e falhas.',
  ],
  'O que é um cold start no AWS Lambda?': [
    'É o atraso que ocorre quando a função atinge o limite de concorrência e a invocação espera numa fila interna até um ambiente "warm" ser liberado.',
    'É a latência extra só da primeira invocação após um deploy; depois disso todas as invocações reaproveitam o mesmo ambiente, mesmo com tráfego simultâneo.',
    'É o tempo para baixar o pacote do S3 a cada invocação; acontece em toda chamada de funções conectadas a uma VPC e nunca nas demais.',
  ],
  'Quais são os três modelos de invocação do Lambda e um exemplo de cada?': [
    'Síncrona (S3, SNS), assíncrona (API Gateway, ALB) e event source mapping, em que a fonte (SQS, Kinesis) empurra os registros para o Lambda.',
    'Síncrona (API Gateway, ALB), assíncrona (SQS, Kinesis, DynamoDB Streams) e agendada, em que o EventBridge faz polling da função periodicamente.',
    'Síncrona (API Gateway, SQS), assíncrona (S3, EventBridge) e streaming, em que o Kinesis invoca a função uma vez por registro, sem lotes.',
  ],
  'Qual a diferença entre destinations e uma DLQ em invocações assíncronas do Lambda?': [
    'São equivalentes: ambos recebem só falhas e guardam só o evento original; a diferença é que destinations aceitam apenas SQS, enquanto a DLQ aceita SQS e SNS.',
    'A DLQ aceita on-success e on-failure e guarda o evento com o erro; destinations recebem só falhas e enviam apenas o evento original, sem o contexto da invocação.',
    'Destinations só existem em event source mappings (SQS, Kinesis); para invocações assíncronas, como as do S3 e do SNS, a DLQ é a única opção.',
  ],
  'Como uma função Lambda em sub-redes privadas de uma VPC acessa a internet?': [
    'Atribuindo um IP público à ENI do Lambda e colocando a função numa sub-rede com rota 0.0.0.0/0 para um Internet Gateway.',
    'Por um Internet Gateway anexado à VPC, com rota 0.0.0.0/0 nas sub-redes privadas; VPC endpoints só servem para acessar outras VPCs.',
    'Automaticamente: o Lambda mantém a saída para a internet pela rede gerenciada da AWS mesmo conectado à VPC; basta liberar a saída no security group.',
  ],
  'Quanto espaço o /tmp de uma função Lambda tem, e ele é durável?': [
    '512 MB fixos. É durável e compartilhado entre todos os ambientes da função, então serve para guardar estado entre invocações paralelas.',
    'Até 10 GB, mas é limpo ao final de cada invocação, então nada gravado nele sobrevive, nem mesmo num ambiente warm.',
    '250 MB, o mesmo limite do pacote descompactado; o conteúdo é salvo no S3 quando o ambiente é descartado e restaurado no próximo cold start.',
  ],
  'Como evitar que um registro ruim bloqueie um shard do Kinesis consumido pelo Lambda?': [
    'Configurando uma DLQ no próprio stream do Kinesis com maxReceiveCount, como no SQS, para o registro sair do shard após N tentativas.',
    'Aumentando o batch size e o número de shards: com mais paralelismo, o registro ruim deixa de bloquear os outros, mesmo falhando indefinidamente.',
    'Capturando o erro no handler e relançando-o: o Lambda descarta o lote sozinho após duas tentativas, como faz nas invocações assíncronas.',
  ],

  // Padrões de arquitetura e tolerância a falhas
  'Como entregar o mesmo evento a vários consumidores independentes, isolando falhas de cada um?': [
    'Com uma única fila SQS lida por vários consumidores: cada consumidor recebe sua própria cópia de cada mensagem e falha sem afetar os outros.',
    'Publicar num tópico SNS com cada consumidor assinando por HTTP; se um consumidor falhar, o SNS guarda a mensagem indefinidamente até ele voltar.',
    'Com uma fila SQS FIFO e um MessageGroupId por consumidor: cada grupo entrega uma cópia da mensagem ao seu consumidor, isolando as falhas.',
  ],
  'O que faz uma mensagem SQS ser movida para a dead-letter queue?': [
    'Ficar na fila mais tempo que o retention period: antes de expirar, o SQS a move para a DLQ, que pode ser de qualquer tipo (Standard ou FIFO).',
    'Ser recebida mais vezes que o maxReceiveCount sem ser excluída. A DLQ pode ser de outro tipo (uma FIFO pode usar uma Standard) e de outra região.',
    'O consumidor retornar um erro uma única vez: o SQS move a mensagem imediatamente para a DLQ, sem nova tentativa, para não travar a fila.',
  ],
  'Qual a estratégia recomendada para repetir chamadas que falharam por throttling?': [
    'Retry imediato com intervalo fixo e curto, para recuperar a vazão o quanto antes. Os AWS SDKs não repetem chamadas; isso fica a cargo da aplicação.',
    'Retry com backoff exponencial sem jitter, para todos os clientes repetirem nos mesmos instantes previsíveis. Jitter só é usado para erros 5xx.',
    'Não repetir: throttling indica um erro permanente de cota, então a chamada deve ir para uma DLQ e só ser reprocessada após um aumento de limite.',
  ],
  'Qual a diferença entre coreografia e orquestração de microsserviços?': [
    'Coreografia: um coordenador central define a ordem e trata erros (ex.: Step Functions). Orquestração: cada serviço reage a eventos, sem coordenador (ex.: EventBridge).',
    'Coreografia: os serviços se chamam de forma síncrona em cadeia (ex.: API Gateway). Orquestração: os serviços trocam eventos por uma fila compartilhada (ex.: SQS).',
    'São o mesmo padrão com nomes diferentes: a única diferença é que a coreografia usa SNS e a orquestração usa SQS para trocar mensagens.',
  ],
  'Por que consumidores de uma fila SQS Standard devem ser idempotentes?': [
    'Porque a fila Standard entrega cada mensagem exatamente uma vez, mas fora de ordem, e processar em outra ordem pode corromper o estado.',
    'Porque a fila Standard não tem visibility timeout, então todas as instâncias consumidoras sempre leem a mesma mensagem ao mesmo tempo.',
    'Não precisam: a fila Standard garante exactly-once. Idempotência só é necessária em filas FIFO, que repetem as mensagens de cada grupo.',
  ],
  'Para que servem o MessageGroupId e o MessageDeduplicationId numa fila SQS FIFO?': [
    'MessageGroupId: descarta repetições dentro de 5 minutos. MessageDeduplicationId: define a ordem, garantida só entre mensagens com o mesmo ID.',
    'MessageGroupId: garante a ordem da fila inteira, processando um grupo de cada vez. MessageDeduplicationId: descarta repetições por 24 horas.',
    'MessageGroupId: define a ordem dentro de cada grupo. MessageDeduplicationId: obrigatório em toda mensagem, mesmo com content-based deduplication, e vale por 1 hora.',
  ],
  'Qual deve ser o visibility timeout de uma fila SQS consumida por uma função Lambda?': [
    'Igual ao timeout da função. Se o processamento passa do visibility timeout, a mensagem é excluída automaticamente para evitar duplicatas.',
    'Pelo menos 6 vezes o timeout da função. Se o processamento passa do visibility timeout, a mensagem vai direto para a DLQ.',
    'Menor que o timeout da função, para que mensagens de execuções lentas voltem logo à fila e sejam processadas em paralelo por outra instância.',
  ],
  'Qual a diferença entre workflows Standard e Express no Step Functions?': [
    'Standard: até 5 minutos, at-least-once, cobrado por requisição e duração. Express: até 1 ano, exactly-once, cobrado por transição de estado.',
    'Standard: até 1 ano, at-least-once, cobrado por requisição. Express: até 5 minutos, exactly-once, cobrado por transição de estado.',
    'Standard: até 15 minutos, como o Lambda, exactly-once. Express: até 1 hora, at-least-once, indicado para fluxos longos com aprovação humana.',
  ],
  'Quando escolher EventBridge em vez de SNS?': [
    'Quando precisa do maior throughput possível e de entrega por e-mail, SMS e push. O SNS é a opção para eventos de SaaS, schema registry e replay.',
    'Quando precisa de fanout para filas SQS, já que o SNS não entrega mensagens a filas, só a e-mail, SMS e endpoints HTTP.',
    'Quando precisa de ordenação garantida e exactly-once, ou de filtrar mensagens — o SNS não tem filtragem nem tópicos FIFO.',
  ],
  'Quando usar Kinesis Data Streams em vez de SQS?': [
    'Quando cada mensagem deve ser processada por um único consumidor e excluída depois. No SQS vários consumidores leem os mesmos dados, com replay.',
    'Quando as mensagens precisam de atraso individual (delay) e de uma DLQ nativa com maxReceiveCount, recursos que o SQS não oferece.',
    'Quando precisa de ordem global entre todos os registros do stream, independentemente da partition key, com retenção fixa de 14 dias.',
  ],

  // Armazenamento de dados em aplicações
  'Qual a diferença entre lazy loading e write-through?': [
    'Lazy loading: atualiza o cache a cada escrita (nunca desatualizado, mas write penalty). Write-through: grava no cache só num miss (pode ficar desatualizado).',
    'Lazy loading: carrega o banco inteiro no cache na inicialização. Write-through: grava primeiro no cache e só depois, de forma assíncrona, no banco.',
    'Lazy loading: cacheia só o que é lido e nunca fica desatualizado, porque o TTL é obrigatório. Write-through: cacheia tudo o que é escrito e dispensa TTL.',
  ],
  'O que causa uma hot partition no DynamoDB e como evitar?': [
    'Uma sort key com valores repetidos. Evite trocando a sort key por um timestamp, já que é ela que define em qual partição o item fica.',
    'Uma tabela com muitos itens grandes. Evite com o modo on-demand, que distribui automaticamente os acessos concentrados numa única chave.',
    'Uma partition key de alta cardinalidade (ex.: clienteId). Evite com uma chave de poucos valores (ex.: status), que agrupa os acessos.',
  ],
  'Quando usar o DAX em vez do ElastiCache?': [
    'Quando o cache é para qualquer fonte (RDS, DynamoDB, APIs externas): o DAX é genérico e exige reescrever a lógica de cache na aplicação.',
    'Quando o cache é para o DynamoDB e precisa incluir leituras fortemente consistentes, que o DAX cacheia com latência de microssegundos.',
    'Quando a aplicação precisa de sorted sets e pub/sub sobre os dados do DynamoDB, estruturas que o DAX oferece nativamente.',
  ],
  'Quais ações uma lifecycle rule do S3 pode executar?': [
    'Transition e expiration, e também replicar objetos para outra região e recriptografar objetos antigos com SSE-KMS.',
    'Só expiration (excluir após N dias); mover para classes mais baratas exige o S3 Intelligent-Tiering ou um job do S3 Batch Operations.',
    'Transition para classes mais baratas, mas não exclusão: objetos só podem ser excluídos pela aplicação ou por S3 Object Lock.',
  ],
  'Quanto vale 1 RCU e 1 WCU no DynamoDB?': [
    '1 RCU = 1 leitura fortemente consistente/s de até 1 KB (ou 2 eventualmente consistentes). 1 WCU = 1 escrita/s de até 4 KB. Tamanhos arredondam para cima.',
    '1 RCU = 2 leituras fortemente consistentes/s de até 4 KB (ou 1 eventualmente consistente). 1 WCU = 1 escrita/s de até 1 KB. Tamanhos arredondam para cima.',
    '1 RCU = 1 leitura/s de até 4 KB, com o mesmo custo para leitura forte ou eventual. 1 WCU = 1 escrita/s de até 4 KB. Tamanhos arredondam para baixo.',
  ],
  'Como evitar que escritas concorrentes no DynamoDB se sobrescrevam sem bloquear o item?': [
    'Pessimistic locking: gravar um atributo de lock no item antes de alterá-lo; o DynamoDB bloqueia outras escritas até o atributo ser removido.',
    'Fazer uma leitura fortemente consistente antes de cada escrita: isso garante que nenhuma outra escrita aconteça entre a leitura e o PutItem.',
    'Usar BatchWriteItem: o lote é atômico e rejeita automaticamente os itens que mudaram desde a última leitura.',
  ],
  'Como o TTL do DynamoDB funciona e qual o cuidado ao usá-lo?': [
    'Exclui itens no exato segundo do atributo de expiração (em milissegundos), consumindo WCU como um DeleteItem comum.',
    'Exclui itens cujo atributo de expiração já passou, sem consumir WCU. A exclusão é imediata, então itens expirados nunca aparecem nas leituras.',
    'Arquiva os itens expirados no S3 e os remove da tabela; o cuidado é que o atributo precisa ser uma data em texto no formato ISO 8601.',
  ],
  'Por que preferir Query a Scan no DynamoDB?': [
    'Query usa índices em todos os atributos automaticamente; Scan só usa a partition key, por isso é mais lento.',
    'Scan aplica o filtro antes de ler e cobra só pelos itens retornados; Query é preferível apenas porque retorna os itens ordenados.',
    'Query e Scan consomem a mesma capacidade; a única diferença é que Query retorna os itens ordenados pela sort key.',
  ],
  'Quais as diferenças entre um LSI e um GSI no DynamoDB?': [
    'LSI: chaves diferentes, criado a qualquer momento, capacidade própria. GSI: mesma partition key, só na criação da tabela, permite leitura fortemente consistente.',
    'LSI: mesma partition key, outra sort key, criado a qualquer momento, só eventualmente consistente. GSI: chaves diferentes, só na criação da tabela.',
    'LSI: outra partition key e mesma sort key, só na criação da tabela. GSI: mesma partition key, compartilha a capacidade da tabela e permite leitura forte.',
  ],

  // Autenticação e autorização de aplicações
  'Qual a diferença entre um Cognito User Pool e um Identity Pool?': [
    'Identity Pool autentica usuários e emite tokens JWT (ID, access, refresh). User Pool troca esses tokens por credenciais temporárias da AWS via STS.',
    'User Pool autentica e já entrega credenciais temporárias da AWS ao cliente. Identity Pool é só o diretório de grupos e atributos dos usuários.',
    'User Pool é para usuários internos (funcionários, via IAM Identity Center). Identity Pool é para usuários externos, que entram com e-mail e senha.',
  ],
  'Qual API do STS um Identity Pool usa por trás dos panos para gerar credenciais temporárias?': [
    'AssumeRole — troca um token de identidade (de um User Pool ou provedor externo) por credenciais temporárias associadas a uma IAM role.',
    'GetSessionToken — gera credenciais temporárias a partir do access token do User Pool, sem precisar de uma IAM role.',
    'AssumeRoleWithSAML — usada para qualquer provedor, inclusive User Pools, Google e Facebook, que emitem asserções SAML.',
  ],
  'Quais três tokens um Cognito User Pool emite após um login bem-sucedido?': [
    'ID token (autoriza chamadas a APIs), access token (identifica o usuário) e refresh token (renova os outros sem novo login).',
    'ID token, access token e session token — este último é a credencial temporária da AWS para o cliente chamar serviços diretamente.',
    'Access token, refresh token e uma asserção SAML, que o backend usa para validar a identidade do usuário em cada chamada.',
  ],
  'Como aplicar o princípio do menor privilégio a usuários de um Identity Pool sem criar uma IAM role por usuário?': [
    'Criando um grupo no User Pool para cada usuário, cada grupo associado à sua própria IAM role com permissões restritas.',
    'Com uma resource-based policy em cada bucket ou tabela listando os IDs de usuário do User Pool que podem acessá-los.',
    'Usando variáveis de política como ${aws:username}, que o Identity Pool preenche com o e-mail do usuário autenticado.',
  ],
  'Qual authorizer nativo do API Gateway valida tokens de um Cognito User Pool automaticamente?': [
    'O Lambda authorizer do tipo TOKEN — é o único que aceita tokens de um User Pool, com código próprio para verificar a assinatura.',
    'O IAM authorizer — converte o token do User Pool numa assinatura SigV4 antes de invocar a integração (ex.: uma função Lambda).',
    'O Cognito User Pool authorizer — valida só o ID token, nunca o access token, por isso o cliente precisa enviar os dois.',
  ],
  'Cite 4 Lambda triggers de um Cognito User Pool e para que servem.': [
    'Pre sign-up (criar perfil no banco após a confirmação), Post confirmation (validar o cadastro antes de criar o usuário), Pre token generation (renovar o refresh token) e Migrate user (exportar usuários).',
    'Pre authentication (emitir tokens customizados), Post authentication (bloquear logins antes de validar a senha), Custom message (validar o cadastro) e Migrate user (copiar o pool para outra região).',
    'Pre sign-up (enviar o e-mail de verificação), Post confirmation (gerar o access token), Pre token generation (validar a senha) e Define auth challenge (migrar usuários antigos).',
  ],
  'Qual fluxo OAuth uma SPA ou app mobile deve usar com o Cognito?': [
    'Implicit grant: o token vem direto na URL, sem troca no backend, o que é o mais seguro para apps que não guardam client secret.',
    'Client credentials com o client secret embutido no app, já que SPAs e apps mobile não conseguem fazer o redirecionamento do login.',
    'Authorization code grant com o client secret embutido no app; PKCE é para comunicação máquina a máquina.',
  ],
  'Como um backend valida por conta própria um token de um Cognito User Pool?': [
    'Chamando o endpoint /oauth2/userInfo do User Pool em cada requisição; tokens do Cognito não podem ser validados localmente.',
    'Verificando a assinatura HS256 com o client secret do app client e conferindo só o exp; iss e aud são opcionais.',
    'Decodificando o JWT em Base64 e conferindo exp e email; a assinatura não precisa ser verificada se a conexão usa HTTPS.',
  ],
  'Quando usar IAM, Cognito authorizer ou Lambda authorizer no API Gateway?': [
    'IAM: tokens de um User Pool. Cognito authorizer: chamadores com credenciais da AWS (SigV4). Lambda authorizer: só para APIs WebSocket.',
    'IAM: qualquer lógica customizada, via policy. Cognito authorizer: tokens de qualquer provedor OIDC, como o Auth0. Lambda authorizer: só chamadores de dentro da VPC.',
    'IAM: chamadores com credenciais da AWS (SigV4). Cognito authorizer: tokens de terceiros e headers customizados. Lambda authorizer: só tokens de um User Pool.',
  ],
  'O que é preciso para uma função na conta A assumir uma role na conta B?': [
    'Só na conta B: uma trust policy na role permitindo o principal da conta A. A conta A não precisa conceder nada à identidade da função.',
    'Só na conta A: permissão sts:AssumeRole na identidade da função. A trust policy da role na conta B é criada automaticamente na primeira chamada.',
    'Compartilhar a role da conta B com a conta A pelo AWS RAM; depois disso, a função a usa como se fosse uma role local.',
  ],

  // Criptografia com serviços AWS
  'Como funciona a criptografia envelope com o KMS?': [
    'Encrypt envia todos os dados ao KMS, que devolve o texto criptografado e uma chave de dados. Para ler, Decrypt envia os dados de volta ao KMS.',
    'GenerateDataKey devolve só a chave de dados em claro, guardada junto dos dados criptografados para ser reutilizada na leitura, sem chamar o KMS de novo.',
    'GenerateDataKey devolve uma chave de dados em claro e criptografada. Guarda-se a versão em claro junto dos dados e descarta-se a criptografada.',
  ],
  'O que muda quando uma chave do KMS é rotacionada?': [
    'O KMS cria uma chave nova, com novo ID e ARN; as aplicações precisam trocar o ARN e recriptografar os dados antigos.',
    'Todo o material é substituído e o KMS recriptografa os dados antigos em segundo plano, sem mudança de ID ou ARN.',
    'Só o ARN muda; o ID e o material são mantidos, e os dados antigos só são lidos enquanto o alias apontar para a chave antiga.',
  ],
  'Qual o tamanho máximo que a API Encrypt do KMS aceita?': [
    '64 KB. Para dados maiores, usa-se criptografia envelope (GenerateDataKey).',
    '1 MB. Para dados maiores, divide-se o conteúdo em partes e chama-se Encrypt para cada uma.',
    'Não há limite: Encrypt aceita qualquer tamanho, mas cobra por KB, por isso o envelope é usado só para economizar.',
  ],
  'Qual a diferença entre AWS managed keys e customer managed keys no KMS?': [
    'AWS managed: US$ 1/mês, key policy editável, sem rotação. Customer managed: sem custo mensal, rotação anual obrigatória e sem uso entre contas.',
    'AWS managed: sem custo mensal, key policy editável e uso entre contas. Customer managed: US$ 1/mês; a única diferença é que a rotação é manual.',
    'AWS managed: sem custo mensal, rotação anual automática, compartilháveis entre contas via grants. Customer managed: US$ 1/mês, key policy definida pela AWS.',
  ],
  'O que é necessário para uma role de outra conta usar uma chave do KMS?': [
    'Só uma policy do IAM na outra conta permitindo kms:Decrypt no ARN da chave; a key policy não participa do acesso entre contas.',
    'Só a key policy na conta dona permitindo a outra conta; as roles dela passam a usar a chave sem precisar de policy do IAM.',
    'Compartilhar a chave pelo AWS RAM e copiar o material para a outra conta, já que uma chave do KMS não é usada fora da conta dona.',
  ],
  'Quando usar SSE-S3, SSE-KMS e SSE-C no S3?': [
    'SSE-S3: o cliente mantém a chave. SSE-KMS: padrão, sem configuração. SSE-C: controle de acesso pela key policy e auditoria no CloudTrail.',
    'SSE-S3: auditoria de cada uso da chave no CloudTrail. SSE-KMS: o cliente envia a chave em cada requisição. SSE-C: padrão do bucket.',
    'SSE-S3: padrão, sem configuração. SSE-KMS: o cliente mantém a chave e a envia em cada requisição. SSE-C: chaves do KMS com rotação automática.',
  ],
  'Como exigir que todo acesso a um bucket S3 use TLS?': [
    'Bucket policy com Allow em s3:* só quando aws:SecureTransport for true; sem Deny explícito, isso já bloqueia qualquer acesso por HTTP.',
    'Habilitando a criptografia padrão do bucket com SSE-KMS, que faz o S3 recusar requisições por HTTP.',
    'Bucket policy com Deny em s3:* quando o header s3:x-amz-server-side-encryption estiver ausente.',
  ],
  'Como reduzir o custo e o throttling do KMS num bucket com SSE-KMS?': [
    'Trocando SSE-KMS por SSE-C: o S3 deixa de chamar o KMS, e o custo e o throttling somem sem mudar o controle de acesso.',
    'Pedindo aumento da cota de requisições do KMS, já que o S3 não tem otimização própria para reduzir as chamadas ao KMS.',
    'Habilitando a rotação automática da chave do KMS, porque chaves rotacionadas geram menos chamadas por objeto.',
  ],
  'Quais são as duas regras do ACM mais cobradas na prova?': [
    'Certificados para o CloudFront precisam estar na mesma região da origem. A renovação automática depende da validação por e-mail.',
    'Certificados para o CloudFront podem estar em qualquer região, desde que a distribuição use HTTPS. A renovação automática funciona igual com validação por DNS ou por e-mail.',
    'Certificados para o CloudFront precisam estar em us-east-1. A renovação é sempre manual: o ACM só avisa 45 dias antes do vencimento.',
  ],

  // Dados sensíveis no código da aplicação
  'Quando usar o Secrets Manager e quando usar o Parameter Store?': [
    'Parameter Store: rotação automática nativa, replicação entre regiões, pago. Secrets Manager: configurações sem rotação, hierarquias, nível gratuito.',
    'Secrets Manager: só para senhas de RDS. Parameter Store: qualquer outro segredo, inclusive com rotação automática nativa no nível Advanced.',
    'Secrets Manager: gratuito até 10.000 segredos, sem rotação. Parameter Store: pago, com rotação automática e replicação entre regiões.',
  ],
  'O que significam AWSCURRENT, AWSPENDING e AWSPREVIOUS?': [
    'AWSCURRENT: versão em criação durante a rotação. AWSPENDING: versão atual (padrão do GetSecretValue). AWSPREVIOUS: versão excluída, mantida para auditoria.',
    'AWSCURRENT: versão atual. AWSPENDING: versão agendada para exclusão em 7 dias. AWSPREVIOUS: versão anterior, apagada assim que a rotação termina.',
    'São as regiões de replicação do segredo: AWSCURRENT é a primária, AWSPENDING a réplica em criação e AWSPREVIOUS a réplica desativada.',
  ],
  'Por que não guardar segredos diretamente em variáveis de ambiente do Lambda?': [
    'Porque elas não são criptografadas em repouso; basta criptografá-las com uma customer managed key do KMS e qualquer valor pode ficar nelas com segurança.',
    'Porque o Lambda limita cada variável de ambiente a 256 bytes; segredos maiores precisam ir para o Secrets Manager.',
    'Porque mudar uma variável exige publicar uma nova versão; com o Secrets Manager, o valor é injetado nas variáveis automaticamente, sem redeploy.',
  ],
  'Como evitar chamar o Secrets Manager a cada invocação de uma função Lambda?': [
    'Buscando o segredo dentro do handler e guardando-o no /tmp, que é compartilhado entre todos os ambientes da função.',
    'Usando provisioned concurrency: com ambientes pré-inicializados, o Secrets Manager deixa de ser chamado nas invocações seguintes.',
    'Usando a AWS Parameters and Secrets Lambda Extension, que injeta o segredo como variável de ambiente no deploy, sem endpoint local nem TTL.',
  ],
  'O que é preciso para ler um SecureString em claro?': [
    'Só ssm:GetParameter no parâmetro; o SSM descriptografa automaticamente sempre que a identidade tem acesso ao parâmetro.',
    'Chamar com --with-decryption e ter kms:Decrypt na chave; ssm:GetParameter não é necessário quando a decriptação é explícita.',
    'Chamar kms:Decrypt sobre o valor retornado pelo GetParameter, já que a API do SSM nunca devolve um SecureString em claro.',
  ],
  'Quais as diferenças entre os níveis Standard e Advanced do Parameter Store?': [
    'Standard: gratuito, até 100.000 parâmetros, 8 KB. Advanced: pago, até 10.000 parâmetros, 4 KB, com parameter policies.',
    'Standard: gratuito, até 10.000 parâmetros, 4 KB, com parameter policies. Advanced: pago, sem limite de parâmetros, 64 KB e rotação automática.',
    'Standard: só String e StringList. Advanced: necessário para SecureString, com até 8 KB e criptografia pelo KMS.',
  ],
  'Como ler toda a configuração de /app/prod do Parameter Store numa chamada?': [
    'GetParameters com Names=/app/prod/*, que aceita curingas e retorna todos os parâmetros abaixo do caminho de uma vez.',
    'GetParametersByPath com Path=/app/prod; por padrão já é recursivo, descriptografa SecureString e não pagina.',
    'DescribeParameters com o filtro Path=/app/prod, que retorna nomes e valores de todos os parâmetros do caminho.',
  ],
  'Como usar um segredo do Secrets Manager num template do CloudFormation sem expô-lo?': [
    'Com um parâmetro NoEcho recebendo o ARN do segredo; o CloudFormation lê o valor no Secrets Manager automaticamente.',
    'Com Fn::GetAtt no recurso do segredo: !GetAtt MeuSegredo.SecretString devolve o valor sem expô-lo nos eventos da stack.',
    'Com uma dynamic reference {{resolve:ssm:nome:SecretString:chave}}; o prefixo secretsmanager só funciona para parâmetros SecureString.',
  ],
  'Qual serviço encontra PII armazenada em buckets S3?': [
    'O Amazon GuardDuty, que analisa objetos com machine learning e gera findings de PII por bucket e objeto.',
    'O Amazon Inspector, que examina o conteúdo dos objetos S3 e classifica dados sensíveis como PII e números de cartão.',
    'O AWS Config, com regras gerenciadas que leem o conteúdo de cada objeto e marcam buckets com PII como não conformes.',
  ],
  'Como mascarar e-mails e números de cartão que aparecem no CloudWatch Logs?': [
    'Com um metric filter no log group: os valores que casam com o padrão são trocados por asteriscos antes de serem gravados.',
    'Criptografando o log group com uma chave do KMS: os valores sensíveis ficam mascarados para quem não tem kms:Decrypt.',
    'Apontando o Amazon Macie para o log group: ele mascara os valores e só os mostra a principais com macie:Unmask.',
  ],

  // Preparação de artefatos de deploy
  'O que fazem aws cloudformation package e aws cloudformation deploy?': [
    'package: cria e executa um change set. deploy: envia o código local (CodeUri) ao S3 e gera um template com URIs s3://.',
    'package: compila o código num .zip local. deploy: envia o .zip direto para a função, sem CloudFormation nem capabilities.',
    'package: envia o código ao S3 e gera o template final. deploy: cria a stack sem change set; capabilities só são exigidas para nested stacks.',
  ],
  'Por que um pacote com bibliotecas compiladas montado no Windows/macOS falha no Lambda?': [
    'Porque o Lambda só aceita bibliotecas em Python ou JavaScript puro; dependências compiladas precisam ir numa imagem de container.',
    'Porque o .zip criado no Windows perde as permissões de execução; basta recompactar com outra ferramenta, sem trocar os binários.',
    'O binário precisa ser para Amazon Linux; a arquitetura não importa, porque o Lambda traduz x86_64 para arm64 automaticamente.',
  ],
  'O que identifica um template SAM e para que servem Globals e CodeUri?': [
    'Transform: AWS::Serverless-2016-10-31. Globals define variáveis de ambiente da conta inteira; CodeUri aponta para a imagem da função no ECR.',
    'AWSTemplateFormatVersion: SAM-2016-10-31. Globals define propriedades comuns às funções; CodeUri aponta para o handler de cada função.',
    'Transform: AWS::Include. Globals define parâmetros compartilhados entre stacks; CodeUri é o ARN da versão publicada de cada função.',
  ],
  'Quais as regras do source bundle do Elastic Beanstalk e para que serve .ebextensions?': [
    'Um único .zip de até 50 MB, com uma pasta-pai com o nome da aplicação. Em .ebextensions/ ficam os logs do ambiente.',
    'Vários .zip, um por instância, de até 500 MB cada. Arquivos .config em .ebextensions/ só são aplicados na criação do ambiente.',
    'Um único .zip/.war de até 500 MB, sem pasta-pai. .ebextensions/ só define variáveis de ambiente; pacotes e comandos exigem um Dockerfile.',
  ],
  'O que o AWS AppConfig oferece além de guardar configuração?': [
    'Nada além de armazenamento versionado: validação e rollback precisam ser montados com CodePipeline e CloudFormation.',
    'Validação por JSON Schema e deploy imediato para todos os alvos; a aplicação precisa ser reimplantada para ler a configuração nova.',
    'Rotação automática de segredos e criptografia com KMS, substituindo o Secrets Manager para configurações sensíveis.',
  ],
  'Como aumentar a CPU disponível para uma função Lambda?': [
    'Configurando o número de vCPUs (1 a 6) separadamente da memória, nas configurações gerais da função.',
    'Aumentando o timeout: funções com timeout maior recebem uma fatia maior de CPU em cada invocação.',
    'Habilitando provisioned concurrency, que reserva vCPUs dedicadas para cada ambiente de execução.',
  ],
  'Quando empacotar uma função Lambda como imagem de container, e qual a restrição?': [
    'Quando as dependências passam de 50 MB (até 250 MB). A imagem fica no S3 e pode combinar até 5 layers.',
    'Quando a função precisa rodar mais de 15 minutos: como imagem de container, o timeout vai até 1 hora. A imagem fica no ECR.',
    'Quando as dependências passam de 250 MB (até 10 GB). A imagem pode vir do Docker Hub ou do ECR e usa layers como as funções .zip.',
  ],
  'Quais são os limites de tamanho de pacote no Lambda?': [
    '.zip: 250 MB no upload direto e 50 MB descompactados somando as layers. Imagem de container: até 10 GB.',
    '.zip: 50 MB no upload direto e 250 MB descompactados, sem contar as layers. Imagem de container: até 250 MB.',
    '.zip: 10 MB pelo console, 50 MB via S3 e 500 MB descompactados. Imagem de container: até 1 GB.',
  ],
  'Onde uma layer é extraída e qual pasta uma layer Python precisa ter?': [
    'Em /tmp. Para Python, a pasta lib/ na raiz do zip; para Node.js, node_modules/ direto na raiz.',
    'Em /var/task, junto do código da função. Para Python, os pacotes ficam direto na raiz do zip, sem pasta.',
    'Em /opt. Para Python, a pasta site-packages/ na raiz do zip (vira /opt/site-packages); para Node.js, a pasta node/.',
  ],
  'Publicar uma nova versão de uma layer atualiza as funções que a usam?': [
    'Sim. As funções apontam para o nome da layer e passam a usar a versão mais recente no próximo cold start. Máximo de 5 layers por função.',
    'Sim, se a função referenciar a layer pelo qualificador $LATEST. Máximo de 10 layers por função.',
    'Não, mas basta republicar a função ($LATEST) sem mudar a configuração para ela pegar a versão nova. Não há limite de layers por função.',
  ],

  // Testes de aplicações em ambientes de desenvolvimento
  'Como testar um deployment novo de uma API REST com parte do tráfego de produção?': [
    'Com um stage novo (ex.: canary) e um registro ponderado no Route 53 dividindo o tráfego entre as URLs dos dois stages.',
    'Com um weighted alias do Lambda, porque o API Gateway não tem recurso próprio para dividir o tráfego entre deployments.',
    'Com throttling reduzido no stage: o API Gateway limita as requisições ao deployment novo até ele ser aprovado manualmente.',
  ],
  'Para que serve uma integração Mock no API Gateway?': [
    'Para simular localmente, com Docker, uma função Lambda de backend e testá-la antes do deploy.',
    'Para gerar dados aleatórios contra o backend real, permitindo testes de carga sem impactar produção.',
    'Para encaminhar as requisições a um endpoint HTTP de teste definido por stage variable, isolando dev de produção.',
  ],
  'Como testar unitariamente código que chama serviços da AWS sem recursos reais?': [
    'Com sam local invoke, que intercepta as chamadas do SDK e devolve respostas simuladas para cada serviço.',
    'Apontando o SDK para uma conta de desenvolvimento: testes unitários sempre usam recursos reais, só que fora de produção.',
    'Com o X-Ray em modo de teste, que grava as chamadas do SDK numa execução e as reproduz nas execuções seguintes.',
  ],
  'Quais comandos do SAM CLI testam uma função localmente?': [
    'sam local invoke (emula o API Gateway), sam local start-api (uma execução) e sam local generate-event (gera o template). Não exigem Docker.',
    'sam build --local (uma execução), sam deploy --local (emula o API Gateway) e sam test. Rodam DynamoDB e S3 localmente.',
    'sam local invoke -e evento.json, sam local start-api e sam local generate-event. Não exigem Docker e emulam também DynamoDB e S3 localmente.',
  ],
  'Como iterar rápido na nuvem sem esperar deploys completos do CloudFormation?': [
    'sam deploy --no-confirm-changeset: pula o CloudFormation e envia o código direto às funções; recomendado também em produção.',
    'sam local start-lambda: executa a função na nuvem a partir da máquina local, refletindo as mudanças em segundos.',
    'sam sync --watch: envia mudanças em segundos e é o jeito recomendado de implantar em produção, porque evita drift.',
  ],
  'Qual a diferença entre $LATEST e uma versão publicada do Lambda?': [
    '$LATEST é um snapshot imutável do último deploy. Uma versão publicada pode ser editada até ser associada a um alias.',
    '$LATEST é mutável. Uma versão publicada tem código imutável, mas variáveis de ambiente e memória ainda podem ser alteradas nela.',
    '$LATEST é mutável. Uma versão publicada é imutável, mas usa o mesmo ARN de $LATEST, diferenciada só por um header na invocação.',
  ],
  'Para que servem os aliases do Lambda?': [
    'São nomes amigáveis para $LATEST: todo alias aponta sempre para o código mais recente e muda a cada deploy.',
    'Dão um ARN estável que aponta para uma versão, mas gatilhos e o API Gateway não podem usar aliases, só versões numeradas.',
    'São cópias independentes da função, com código e configuração próprios, usadas para separar dev e prod.',
  ],
  'Como mandar uma porcentagem do tráfego de uma função para uma versão nova?': [
    'Com uma stage variable no API Gateway mandando 10% das requisições para a versão nova; o Lambda não divide tráfego sozinho.',
    'Com um weighted alias entre $LATEST e a versão nova. É a base dos deploys all-at-once do CodeDeploy para Lambda.',
    'Com reserved concurrency: reservar 10% da concorrência para a versão nova faz o Lambda mandar essa fração do tráfego para ela.',
  ],
  'Quando uma mudança numa API REST do API Gateway chega aos clientes?': [
    'Assim que é salva: o API Gateway propaga mudanças em recursos e métodos para todos os stages automaticamente.',
    'Depois de um deployment, que vale para todos os stages de uma vez; os stages compartilham a mesma URL e configurações.',
    'Depois de publicar uma nova versão da função Lambda integrada, já que o API Gateway segue o $LATEST da integração.',
  ],
  'Como fazer cada stage do API Gateway invocar um alias diferente da mesma função?': [
    'Integração apontando para minha-funcao:${stageVariables.lambdaAlias}; a permissão lambda:InvokeFunction dada à função sem qualificador já cobre os aliases.',
    'Criando uma API separada por stage, porque stage variables não podem ser usadas no ARN de uma integração Lambda.',
    'Integração apontando para minha-funcao:$LATEST e um header X-Alias enviado pelo cliente, que o Lambda usa para escolher a versão.',
  ],

  // Automação de testes de deploy
  'Como criar um recurso só em produção usando o mesmo template?': [
    'Um mapping por ambiente com Fn::FindInMap; o recurso recebe DependsOn: prod e só é criado quando o mapping existe.',
    'Parâmetro Ambiente + condition EhProd; o recurso recebe DeletionPolicy: EhProd, e os valores variam com !Sub.',
    'Dois templates separados, um por ambiente, porque conditions só controlam propriedades, nunca a criação de recursos.',
  ],
  'Como ver o que uma atualização de stack vai mudar antes de aplicá-la?': [
    'Com a detecção de drift: ela lista o que a atualização vai adicionar, modificar e substituir antes de aplicá-la.',
    'Com uma stack policy: ela mostra os recursos que serão substituídos e bloqueia a atualização até alguém aprovar.',
    'Com um change set: lista os recursos alterados, mas aplica as mudanças assim que é criado, permitindo só rollback depois.',
  ],
  'Como uma stack usa um valor criado por outra stack?': [
    'A stack de origem declara um Parameter com Export; a outra usa Fn::GetAtt. A exportadora pode ser excluída a qualquer momento.',
    'A stack de origem declara um Output com Export; a outra usa Fn::ImportValue. O valor exportado pode ser alterado livremente enquanto é importado.',
    'A outra stack usa Ref no nome lógico do recurso da stack de origem, desde que as duas estejam na mesma região.',
  ],
  'Como impedir que o CloudFormation apague dados ao excluir uma stack?': [
    'UpdateReplacePolicy: Retain protege o recurso na exclusão da stack; DeletionPolicy só vale quando uma atualização substitui o recurso.',
    'Com termination protection no recurso: o CloudFormation exclui a stack, mas mantém todos os recursos que guardam dados.',
    'DeletionPolicy: Snapshot em qualquer recurso, inclusive buckets S3 e funções Lambda, que viram backups automáticos.',
  ],
  'Como reverter automaticamente uma atualização de stack que aumentou os erros?': [
    'Com detecção de drift agendada: se o drift aumentar depois da atualização, o CloudFormation reverte a stack.',
    'Com rollback triggers que leem os logs da aplicação no CloudWatch Logs e revertem a stack quando encontram exceções.',
    'Com DeletionPolicy: Retain: se a atualização aumentar os erros, o CloudFormation restaura os recursos retidos.',
  ],
  'Como ter um ambiente com URL própria para cada pull request de um frontend?': [
    'Com o CodePipeline: cada pull request gera automaticamente um pipeline e um ambiente com URL própria.',
    'Com o Elastic Beanstalk: ambientes por branch e previews de pull request são criados automaticamente.',
    'Com stages do API Gateway: cada pull request vira um stage com URL própria para o frontend.',
  ],
  'Quais são as fases de um buildspec e onde fica o arquivo por padrão?': [
    'source → build → test → deploy. O arquivo padrão é buildspec.json na pasta .codebuild/. Falhas na fase build só geram alerta.',
    'install → pre_build → build → post_build. O arquivo padrão é appspec.yml na raiz do código-fonte.',
    'install → pre_build → build → post_build, em buildspec.yml na raiz. Um comando que falha em build não interrompe nada; só post_build decide o status.',
  ],
  'Para que servem as seções env, reports, artifacts e cache do buildspec?': [
    'env: credenciais da AWS do build. reports: logs do CloudWatch. artifacts: dependências baixadas. cache: saídas para os próximos stages.',
    'env: só variáveis em texto plano (segredos não são suportados). reports: resultados de testes. artifacts: caminhos guardados entre builds. cache: saídas para os próximos stages.',
    'env: variáveis. reports: notificações SNS sobre o build. artifacts: saídas para os próximos stages. cache: a imagem Docker do ambiente de build.',
  ],
  'O que é preciso para construir imagens Docker dentro do CodeBuild?': [
    'Usar uma imagem de build customizada do ECR; com ela o daemon do Docker fica disponível automaticamente.',
    'Dar à service role do projeto a permissão ecr:*; sem ela, o comando docker build falha.',
    'Usar o CodeBuild com compute Lambda, que já vem com o Docker instalado.',
  ],
  'Qual a sequência típica de testes num pipeline até produção?': [
    'Deploy em produção → testes de integração → aprovação manual → rollback se falhar, com um artefato novo construído para cada ambiente.',
    'Build com testes unitários → aprovação manual → deploy em teste → deploy em produção → testes de integração, reconstruindo o artefato antes de produção.',
    'Testes de integração no build → deploy em teste → testes unitários no ambiente de teste → deploy em produção, sem aprovação manual.',
  ],

  // Deploy de código com serviços de CI/CD da AWS
  'Como um pipeline do CodePipeline é organizado?': [
    'Em jobs paralelos definidos num buildspec; artefatos passam por um repositório do ECR. GitHub entra por webhook com token pessoal, sem autorização.',
    'Em stages com actions; artefatos passam direto entre as actions, sem armazenamento. GitHub entra via CodeConnections, ativa assim que é criada.',
    'Em stages com actions; artefatos passam por um bucket S3. GitHub entra via CodeCommit, que espelha o repositório automaticamente.',
  ],
  'O que um deploy blue/green do ECS com CodeDeploy exige?': [
    'Um ALB com um único target group e duas task definitions no mesmo serviço; o tráfego é dividido por peso no serviço.',
    'Registros ponderados no Route 53 para dois serviços ECS; o CodeDeploy só altera os pesos do DNS.',
    'Um ALB ou NLB com dois target groups; o tráfego é trocado sempre de uma vez, sem opção canary ou linear no ECS.',
  ],
  'Como o CodeDeploy desfaz um deploy ruim automaticamente?': [
    'Pelo CodePipeline: o CodeDeploy não tem rollback próprio e depende do pipeline reexecutar a revisão anterior.',
    'Com rollback automático por falha do deploy; alarmes do CloudWatch só notificam e não podem disparar rollback.',
    'Com DeletionPolicy na revisão: se o deploy falha, o CodeDeploy exclui a revisão nova e as instâncias voltam sozinhas à anterior.',
  ],
  'Como liberar gradualmente cada versão de uma função no SAM?': [
    'AutoPublishAlias e DeploymentPreference com Type (canary/linear); o rollback é configurado à parte no CodePipeline, e hooks não são suportados.',
    'Um weighted alias criado à mão e um script no pipeline que ajusta o peso, porque o SAM não tem suporte nativo a deploys graduais.',
    'DeploymentPreference com Type blue/green apontando para $LATEST; Alarms disparam o rollback e os Hooks rodam no CodeBuild.',
  ],
  'Para que servem cdk bootstrap, synth, diff e deploy?': [
    'bootstrap: gera o template. synth: prepara a conta/região. diff: compara branches do código. deploy: publica sem CloudFormation.',
    'bootstrap: roda a cada deploy para instalar dependências. synth: publica a stack. diff: mostra o histórico de deploys. deploy: gera o template.',
    'bootstrap: prepara conta/região, uma vez. synth: gera e já aplica o template. diff: mostra o drift dos recursos. deploy: só valida o template.',
  ],
  'Qual a ordem dos hooks do appspec.yml num deploy em EC2?': [
    'BeforeInstall → ApplicationStop → ApplicationStart → AfterInstall → ValidateService. Funciona sem agente, via Systems Manager.',
    'ApplicationStart → BeforeInstall → AfterInstall → ApplicationStop → ValidateService. Exige o agente do CodeDeploy e um instance profile com acesso à revisão no S3.',
    'BeforeAllowTraffic → AfterInstall → ApplicationStart → AfterAllowTraffic. Exige o agente do CodeDeploy e um instance profile.',
  ],
  'Qual a diferença entre Canary10Percent5Minutes e Linear10PercentEvery1Minute?': [
    'Canary: +10% a cada 5 minutos até 100%. Linear: 10% por 1 minuto, depois o resto de uma vez.',
    'Canary: 10% por 5 minutos, depois o resto de uma vez. Linear: +10% a cada minuto até 100%. Hooks: BeforeInstall e AfterInstall.',
    'Canary: os mesmos 10% dos usuários por 5 minutos. Linear: 10% das instâncias por minuto. Ambos só existem para EC2.',
  ],
  'O que são constructs L1, L2 e L3 no CDK?': [
    'L1: patterns que combinam vários recursos. L2: recursos com padrões sensatos. L3: Cfn*, um para um com o CloudFormation.',
    'L1: recursos com padrões sensatos (ex.: lambda.Function). L2: Cfn*, um para um. L3: stacks inteiras importadas de templates existentes.',
    'L1: constructs de rede. L2: constructs de computação. L3: constructs de dados — o nível indica o tipo de serviço.',
  ],
  'Quando usar cada política de deploy do Elastic Beanstalk?': [
    'All at once: mantém capacidade. Rolling: instâncias novas, rollback mais seguro. Immutable: rápido, com indisponibilidade. Traffic splitting: blue/green por DNS.',
    'All at once: rápido, sem indisponibilidade. Rolling: mantém capacidade. Rolling with additional batch: capacidade reduzida. Immutable: atualiza as instâncias existentes.',
    'All at once: rápido, com indisponibilidade. Rolling: mantém capacidade com um lote extra. Immutable: capacidade reduzida. Traffic splitting: troca de CNAME.',
  ],
  'Como fazer blue/green no Elastic Beanstalk?': [
    'Usar a política de deploy Immutable: ela já é o blue/green do Elastic Beanstalk, com troca de CNAME automática.',
    'Criar um segundo ambiente e mudar os pesos de um registro ponderado no Route 53; Swap environment URLs só existe para ambientes worker.',
    'Atualizar o ambiente atual com Rolling with additional batch e, se der errado, usar Swap environment URLs para voltar à versão anterior.',
  ],

  // Análise de causa raiz
  'Quais comandos principais do CloudWatch Logs Insights?': [
    'select, where, group by, order by e limit, em SQL padrão. Para o Lambda: select avg(duration) where type = "REPORT".',
    'fields, filter, stats, sort, limit e parse, mas filter não aceita regex. Para o Lambda: stats avg(@duration) by @logStream.',
    'search, grep, count e tail. Para o Lambda: search "REPORT" | count by @requestId.',
  ],
  'Como gerar um alarme a partir de um texto que aparece nos logs?': [
    'Subscription filter no log group mandando o texto para o CloudWatch Alarms, que dispara quando o padrão aparece.',
    'Alarme do CloudWatch apontando direto para o log group, com o padrão de texto como condição.',
    'Contributor Insights no log group, que transforma cada linha com o texto numa notificação do SNS.',
  ],
  'O que a linha REPORT do Lambda mostra e como ela ajuda no diagnóstico?': [
    'Duration, Billed Duration, Memory Size, Max Memory Used e Init Duration, que aparece em toda invocação. Max Memory Used = Memory Size é o esperado.',
    'Request ID, status HTTP e corpo da resposta. Status 500 na linha REPORT indica uma exceção no handler.',
    'Duration, Billed Duration, CPU Used e Concurrency. CPU Used = 100% indica falta de memória.',
  ],
  'Qual a diferença entre Latency e IntegrationLatency no API Gateway?': [
    'Latency: só o backend. IntegrationLatency: tempo total no API Gateway. IntegrationLatency alta com Latency baixa → tempo gasto no autorizador.',
    'Latency: tempo total. IntegrationLatency: tempo de rede até o cliente. Latency alta com IntegrationLatency baixa → backend lento.',
    'Latency: tempo total no API Gateway. IntegrationLatency: só o backend. Latency alta com IntegrationLatency baixa → backend lento ou cold start.',
  ],
  'Quais exceções de SDK devem ser repetidas e quais não?': [
    'Repetir com backoff: AccessDenied, ValidationException, ResourceNotFound. Não repetir: ThrottlingException, ProvisionedThroughputExceededException.',
    'Repetir todas com backoff, inclusive AccessDenied e ValidationException, porque podem ser transitórias enquanto o IAM propaga.',
    'Repetir com backoff: ThrottlingException e ValidationException. Não repetir: ProvisionedThroughputExceededException (exige mais capacidade) e AccessDenied.',
  ],
  'Qual a diferença entre annotations e metadata no X-Ray?': [
    'Annotations: qualquer dado extra, não indexado. Metadata: chave-valor indexados, usados em filter expressions.',
    'Annotations: dados enviados ao CloudWatch como métricas. Metadata: chave-valor indexados para busca no X-Ray.',
    'Annotations: chave-valor indexados que aceitam objetos aninhados e não têm limite. Metadata: só strings, também indexadas.',
  ],
  'Como o X-Ray recebe traces de EC2/ECS e quantas requisições grava por padrão?': [
    'Via X-Ray daemon (TCP 443), com permissão xray:PutTraceSegments. Sampling padrão: 5% de todas as requisições, sem reservatório.',
    'Direto pelo SDK, sem daemon, com permissão xray:GetTraceSummaries. Sampling padrão: 100% das requisições.',
    'Via CloudWatch agent (UDP 2000), com permissão cloudwatch:PutMetricData. Sampling padrão: a primeira requisição de cada minuto + 10% das demais.',
  ],
  'O que costuma causar 502 e 504 no API Gateway?': [
    '502: a integração passou do timeout (29 s por padrão). 504: resposta mal formada da integração Lambda proxy.',
    '502: o limite de requisições do stage foi atingido (throttling). 504: o autorizador negou a requisição.',
    '502: resposta mal formada da integração Lambda proxy. 504: a função passou do timeout de 15 minutos configurado no Lambda.',
  ],
  'O que indicam as métricas Errors, Throttles e IteratorAge do Lambda?': [
    'Errors: só exceções do código (timeouts não contam). Throttles: memória insuficiente. IteratorAge: duração do cold start.',
    'Errors: exceções e timeouts. Throttles: chamadas da função a outros serviços que sofreram throttling. IteratorAge: idade da versão publicada.',
    'Errors: exceções e timeouts. Throttles: limite de concorrência atingido. IteratorAge: tempo que as mensagens esperam numa fila SQS.',
  ],
  'Onde procurar a causa de uma stack que falhou e de algo que "parou de funcionar sozinho"?': [
    'Stack: o último evento da lista, ROLLBACK_COMPLETE. Mudança misteriosa: o AWS Config, que registra quem chamou qual API e quando.',
    'Stack: os logs do CloudFormation no CloudWatch Logs. Mudança misteriosa: o X-Ray, que guarda o histórico de chamadas de API da conta.',
    'Stack: o primeiro evento CREATE_FAILED. Mudança misteriosa: o CloudWatch Logs da função, que registra todas as chamadas de API feitas na conta.',
  ],

  // Instrumentação de código para observabilidade
  'Como ser avisado quando um pipeline falha ou um deploy termina?': [
    'Alarme do CloudWatch na métrica PipelineFailed do CodePipeline, com ação para um tópico SNS.',
    'Um post_build no buildspec enviando e-mail pelo SES, porque o CodePipeline não emite eventos de mudança de estado.',
    'Um metric filter nos logs do CodePipeline com um alarme apontando para o SNS.',
  ],
  'O que é o AWS Distro for OpenTelemetry (ADOT)?': [
    'Um agente proprietário da AWS que substitui o X-Ray SDK e envia dados só para o CloudWatch Logs.',
    'Um serviço gerenciado de dashboards baseado em OpenTelemetry, que dispensa instrumentar o código.',
    'A distribuição da AWS do OpenTelemetry, que envia traces só ao CloudWatch Logs e não é compatível com o X-Ray.',
  ],
  'Qual a diferença entre monitoramento e observabilidade?': [
    'Observabilidade acompanha indicadores conhecidos e alerta. Monitoramento permite responder perguntas novas combinando logs, métricas e traces.',
    'São sinônimos: observabilidade é só um nome mais recente para monitoramento com dashboards.',
    'Monitoramento usa métricas e logs; observabilidade usa só traces, e por isso depende do X-Ray.',
  ],
  'O que um log estruturado útil deve ter?': [
    'Texto livre com o stack trace e todos os parâmetros da requisição, inclusive tokens, para facilitar a depuração.',
    'JSON com nível e timestamp; IDs de correlação ficam fora do log, só nos traces do X-Ray.',
    'CSV com colunas fixas por função, porque o Logs Insights só indexa campos em posições fixas.',
  ],
  'O que os controles avançados de logging do Lambda permitem?': [
    'Enviar logs direto para o S3, sem passar pelo CloudWatch, e definir a retenção por invocação.',
    'Formato JSON, mas o nível de log só muda alterando o código e reimplantando a função.',
    'Mascarar dados sensíveis automaticamente e filtrar os logs por request ID no console.',
  ],
  'Por que usar o Embedded Metric Format (EMF) em vez de PutMetricData?': [
    'EMF é uma API assíncrona do SDK que agrupa várias chamadas PutMetricData num lote, reduzindo o custo.',
    'EMF grava as métricas no /tmp e um agente as envia ao fim da invocação, evitando throttling.',
    'EMF é uma linha de log JSON com o bloco _aws, mas só funciona com o CloudWatch agent instalado, por isso não serve no Lambda.',
  ],
  'Por que não usar o ID do usuário como dimensão de uma métrica?': [
    'Porque dimensões só aceitam valores numéricos; IDs de usuário em texto são descartados pelo CloudWatch.',
    'Porque o CloudWatch agrega todas as dimensões numa única métrica, misturando os usuários; não há impacto no custo.',
    'Porque métricas com mais de 3 dimensões não podem ter alarmes; IDs de usuário devem ir em tags da métrica.',
  ],
  'Quando usar métricas de alta resolução e por que olhar percentis?': [
    'Alta resolução (1 s) é o padrão de toda métrica customizada. Percentis só existem para métricas do Lambda. Memória de EC2 vem por padrão.',
    'Alta resolução (1 minuto) permite alarmes de 10 s. A média já mostra a cauda lenta. Memória e disco de EC2 são métricas padrão.',
    'Alta resolução (1 s) permite alarmes de 10/30 s. Percentis são só uma média ponderada. Memória/disco de EC2 vêm com o detailed monitoring.',
  ],
  'Como instrumentar código com o X-Ray SDK e onde colocar annotations no Lambda?': [
    'patch_all() cria um segmento novo para cada chamada; no Lambda, annotations vão direto no segmento da função, que é editável.',
    'O X-Ray SDK só funciona fora do Lambda; no Lambda, o tracing ativo captura tudo sozinho e annotations não são suportadas.',
    'patch_all()/captureAWSv3Client cria subsegments; no Lambda, annotations vão em metadata do segmento da função, porque subsegments não aceitam annotations.',
  ],
  'Como evitar alarmes falsos no CloudWatch?': [
    'Alarmes de alta resolução (10 s) e treat missing data como breaching, para reagir a qualquer variação.',
    'Aumentar o período para 1 dia e usar só a estatística Average, que elimina os picos.',
    'Datapoints to alarm (M de N) e treat missing data como breaching em pouco tráfego; composite alarms não aceitam AND.',
  ],

  // Otimização de aplicações
  'Como achar a memória ideal de uma função Lambda?': [
    'Usar sempre a memória mínima (128 MB), que tem o menor custo por invocação independentemente da duração.',
    'Usar sempre a memória máxima (10 GB): o preço por milissegundo é o mesmo em qualquer configuração.',
    'Deixar o Compute Optimizer ajustar a memória da função automaticamente em produção, sem medições.',
  ],
  'Como reduzir cold starts e o custo de cada invocação no Lambda?': [
    'Pacote grande com todas as dependências pré-carregadas e clientes criados dentro do handler; para eliminar cold starts: reserved concurrency.',
    'Clientes criados dentro do handler, para evitar conexões obsoletas; para eliminar cold starts: aumentar o timeout.',
    'Pacote pequeno e clientes fora do handler; para eliminar cold starts: colocar a função numa VPC, que mantém os ambientes aquecidos.',
  ],
  'Qual a diferença entre provisioned concurrency e SnapStart?': [
    'Provisioned: restaura um snapshot do ambiente, sem custo fixo. SnapStart: ambientes sempre inicializados numa versão/alias, com custo fixo.',
    'Provisioned: ambientes sempre inicializados em $LATEST, sem custo fixo. SnapStart: snapshot disponível para todos os runtimes, com custo fixo.',
    'Provisioned: limita a concorrência máxima da função. SnapStart: mantém os ambientes aquecidos com invocações agendadas.',
  ],
  'O que a reserved concurrency faz e o que acontece com o valor 0?': [
    'Mantém ambientes pré-inicializados para evitar cold starts. Com 0, a função usa a concorrência da conta sem limite.',
    'Só limita a concorrência, sem garantir nada. Com 0, a função volta a usar a cota não reservada da conta.',
    'Garante e limita a concorrência. Com 0, as invocações esperam numa fila e são processadas quando o valor aumentar.',
  ],
  'Quais ajustes otimizam uma função Lambda que consome SQS?': [
    'Reserved concurrency igual ao número de mensagens na fila, batch size 1 e visibility timeout igual ao timeout da função.',
    'Batch size máximo com ReportBatchItemFailures desligado, para o lote inteiro voltar à fila quando qualquer mensagem falha.',
    'Maximum concurrency, batch size e batching window, ReportBatchItemFailures e visibility timeout menor que o timeout da função.',
  ],
  'Como reduzir o custo de requisições ao SQS?': [
    'Short polling (WaitTimeSeconds = 0), que responde mais rápido e só cobra pelas mensagens recebidas.',
    'Long polling (WaitTimeSeconds até 60 s) e operações em lote de até 100 mensagens por chamada.',
    'Usar filas FIFO, que cobram por grupo de mensagens em vez de por requisição.',
  ],
  'Como fazer um assinante do SNS receber só parte das mensagens?': [
    'Com uma subscription filter policy, que só filtra pelo corpo da mensagem; message attributes não podem ser filtrados.',
    'Com uma regra do EventBridge entre o SNS e o assinante, porque o SNS não filtra mensagens.',
    'Com um tópico FIFO: cada MessageGroupId é entregue só aos assinantes daquele grupo.',
  ],
  'Como aumentar a taxa de acertos de cache do CloudFront?': [
    'Incluir na cache policy todos os headers, cookies e query strings, para o cache ser mais preciso; prefira invalidações a arquivos versionados.',
    'Usar uma origin request policy com todos os headers e reduzir o TTL a zero, para o CloudFront revalidar sempre.',
    'Pôr na origin request policy só o que muda a resposta e na cache policy o que o backend precisa receber; invalidações são gratuitas e ilimitadas.',
  ],
  'Como funciona o cache do API Gateway?': [
    'É habilitado por método em APIs HTTP, com TTL padrão de 3.600 s e sem custo; a chave de cache é sempre a URL completa.',
    'É habilitado por stage (APIs REST), com TTL padrão de 60 s (até 300 s), cobrado por requisição atendida pelo cache.',
    'É habilitado por stage (APIs REST e HTTP), com TTL padrão de 300 s, gratuito até 1 GB; parâmetros não podem entrar na chave de cache.',
  ],
  'O que acontece quando a cota de concorrência do Lambda é atingida?': [
    'Invocações síncronas esperam numa fila por até 6 horas; assíncronas recebem 429. Cota padrão: 1.000 por função, fixa.',
    'Invocações síncronas recebem 429; assíncronas vão direto para a DLQ, sem nova tentativa. Cota padrão: 10.000 por conta (ajustável).',
    'Todas as invocações recebem 503 (ServiceUnavailable) e não são repetidas. Cota padrão: 1.000 por região, fixa.',
  ],
};
