// =============================================================================
// Todo o texto e os dados da experiência ficam aqui. Edite este arquivo para
// trocar conteúdo sem mexer no código. Trechos entre *asteriscos* saem em
// destaque (laranja).
// =============================================================================

export const CONFIG = {
  // Tópico do ntfy.sh que recebe os avisos para o closer. Quem souber o nome
  // consegue ler as mensagens, então use um nome difícil de adivinhar.
  // As mensagens nunca levam dados do cliente.
  ntfyTopico: 'e3-safe-closer-q7m4x9k2',
  estacaoPadrao: 'Estação 1',          // mude pela URL: ?estacao=2
  narracaoPadrao: true,                // o closer pode desligar na tela inicial ou no óculos
  // Cases: com false, o óculos mostra só a descrição anônima de cada case.
  // Troque para true apenas quando todos os clientes exibidos autorizarem por escrito.
  mostrarNomesReais: false,
  ociosoSegundos: 150,                 // sem interação: volta ao início
  fimSegundos: 45,                     // tempo na tela final até reiniciar para o próximo visitante
};

export const CONTEUDO = {
  intro: {
    eyebrow: 'Experiência imersiva',
    titulo: 'Bem-vindo à *E3 Company.*',
    texto: 'Em poucos minutos, você vai ver ao seu redor o caminho de um escritório que vive no escuro até um escritório com resultado previsível.',
    botao: 'Entrar no mundo da E3',
  },

  escuro: {
    eyebrow: 'Antes da E3',
    titulo: 'O escritório *sem método.*',
    palavras: ['Sem resultado', 'Sem acompanhamento', 'Sem tráfego', 'Sem previsibilidade', 'Dependendo de indicação',
      'Leads perdidos no WhatsApp', 'Anúncio que não vira contrato', 'Agenda vazia'],
    agenda: 'Agenda da semana',
    agendaVazia: 'Nenhuma reunião marcada',
    grafico: 'Contratos por mês',
    celular: '0 novas mensagens',
    vire: 'Existe outro caminho. *Vire-se.*',
    vireSub: 'A E3 está atrás de você.',
    botaoVirar: 'Virar para a luz',
  },

  luz: {
    eyebrow: 'E3 Company · Marketing jurídico',
    titulo: 'Do escuro ao *resultado previsível.*',
    numeros: [
      { prefixo: '+', valor: 1000, sufixo: '', rotulo: 'Escritórios atendidos' },
      { prefixo: 'R$ ', valor: 200, sufixo: 'M+', rotulo: 'Em honorários gerados' },
      { prefixo: 'R$ ', valor: 20, sufixo: 'M+', rotulo: 'Investidos em mídia paga' },
      { prefixo: '+', valor: 70, sufixo: '', rotulo: 'Pessoas no time E3' },
    ],
    dicaDireita: 'Depoimentos',
    dicaEsquerda: 'Resultados',
  },

  metodo: {
    eyebrow: 'Método E3 · CPP',
    titulo: 'Três alavancas para crescer *sem depender de indicação.*',
    dica: 'Pegue um pilar com o gatilho ou toque para abrir',
    pilares: [
      { n: '01', titulo: 'Aquisição', forma: 'funil', texto: 'Canais de aquisição no digital para gerar demanda e oportunidades todos os dias.' },
      { n: '02', titulo: 'Produto jurídico', forma: 'cristal', texto: 'Um produto jurídico definido, com uma ação que traz escala, lucro e previsibilidade.' },
      { n: '03', titulo: 'Comercial', forma: 'elos', texto: 'Um processo comercial: como atender, como qualificar e como usar a tecnologia a seu favor.' },
    ],
  },

  // Trajetória · modelo 1: como o cliente entra na E3
  entrada: {
    eyebrow: 'Como você entra na E3',
    titulo: 'Quatro portais entre você e o *seu novo comercial.*',
    passos: [
      { n: '01', titulo: 'Consultoria gratuita', quando: 'Hoje, aqui no evento',
        texto: 'Mapeamos seus canais de aquisição, seu produto jurídico e seu processo comercial, e mostramos onde está travando o crescimento.' },
      { n: '02', titulo: 'Plano sob medida', quando: 'Na mesma conversa',
        texto: 'Você recebe o programa certo para o momento do escritório: do primeiro anúncio à aceleração do comercial.' },
      { n: '03', titulo: 'Contrato digital', quando: 'Em minutos',
        texto: 'Assinatura eletrônica pelo tablet do nosso time, sem papel e sem espera.' },
      { n: '04', titulo: 'Onboarding', quando: 'Dia 1',
        texto: 'Reunião de kick-off, acessos e início da estratégia. A partir daqui, o time E3 trabalha com você.' },
    ],
  },

  estrutura: {
    eyebrow: 'O que você recebe',
    titulo: 'Um time completo para *escalar a sua receita.*',
    dica: 'Toque em um módulo para explorar',
    modulos: [
      { n: '01', id: 'midia', titulo: 'Mídia paga', chamada: 'Anúncios direcionados para a sua área de atuação.',
        texto: 'Demanda entrando todo dia, no volume e no perfil de caso que o seu escritório consegue atender.',
        itens: ['Atrai clientes qualificados, não curiosos', 'Campanhas para a sua área de atuação', 'Mais de R$ 20 milhões já investidos pelo nosso time'] },
      { n: '02', id: 'crm', titulo: 'CRM', chamada: 'Cada oportunidade com dono, etapa e prazo.',
        texto: 'Nenhum lead esquecido em conversa de WhatsApp. Você enxerga o funil inteiro.',
        itens: ['Do primeiro contato ao contrato', 'Comercial metrificado para expansão', 'Entrada, atendimento, proposta e fechamento'] },
      { n: '03', id: 'landing', titulo: 'Landing page', chamada: 'Páginas que transformam clique em conversa.',
        texto: 'Cada página é construída para uma coisa só: levar quem clicou no anúncio até o seu escritório.',
        itens: ['Melhores práticas do mercado digital', 'Fáceis de implementar e editar', 'Feitas com as melhores ferramentas'] },
      { n: '04', id: 'vendas', titulo: 'Vendas', chamada: 'Uma máquina de fechar contratos no seu escritório.',
        texto: 'Treinamos sua equipe para que o lead que chegou não morra na primeira mensagem.',
        itens: ['Vendedores que qualificam e fecham', 'Você não precisa treiná-los', 'Script, follow-up e reunião de metas documentados'] },
      { n: '05', id: 'ia', titulo: 'Inteligência artificial', chamada: 'A qualificação acontece sozinha, dia e noite.',
        texto: 'A IA qualifica cada potencial cliente antes que alguém do seu time gaste tempo com o caso.',
        itens: ['Atenda só os casos que fazem sentido', 'Resposta na hora, até fora do expediente', 'Lead qualificado chega pronto'] },
      { n: '06', id: 'criativos', titulo: 'Criativos', chamada: 'Anúncios feitos pelos copywriters e designers da E3.',
        texto: 'Peça feita para performar, não para ganhar prêmio.',
        itens: ['Foco em conversão, não só em estética', 'Baseados em mais de 1.000 escritórios', 'Profissionais em treinamento constante'] },
    ],
  },

  diagnostico: {
    eyebrow: 'Diagnóstico rápido',
    titulo: 'Três perguntas para achar o *seu ponto de partida.*',
    perguntas: [
      { id: 'area', texto: 'Qual é a principal área do seu escritório?',
        opcoes: ['Previdenciário', 'Trabalhista', 'Família', 'Cível e consumidor', 'Tributário e empresarial', 'Outra área'] },
      { id: 'canal', texto: 'Hoje, de onde vêm seus clientes?',
        opcoes: ['Indicação', 'Anúncios', 'Redes sociais', 'Parcerias'] },
      { id: 'desafio', texto: 'Qual é o seu maior desafio agora?',
        opcoes: ['Quase não chegam contatos novos', 'Os contatos chegam, mas não fecham', 'Quero começar a captar rápido', 'Meu escritório não é conhecido no digital'] },
    ],
    // Desafio → programa recomendado. Validar com o time comercial.
    recomendacao: {
      'Quase não chegam contatos novos': 'estruturacao',
      'Os contatos chegam, mas não fecham': 'aceleracao',
      'Quero começar a captar rápido': 'light',
      'Meu escritório não é conhecido no digital': 'evolucao-pro',
    },
    resultadoTitulo: 'Seu ponto de partida',
    botaoJornada: 'Ver minha jornada →',
  },

  // Trajetória · modelo 2: o que acontece depois de entrar (cronogramas reais de onboarding).
  // Descrições marcadas com "(validar)" foram escritas a partir do título da etapa.
  programas: [
    {
      id: 'light', nome: 'Assessoria Light & Pro', duracao: '17 dias', unidade: 'dias',
      resumo: 'Do onboarding ao primeiro alinhamento comercial, com anúncios no ar a partir do 8º dia.',
      etapas: [
        { quando: 'Dia 1', titulo: 'Reunião de onboarding', texto: 'Acessos e envio do curso.', icone: 'pessoas' },
        { quando: 'Dias 2–5', titulo: 'Alinhamento interno', texto: 'Desenvolvimento da estratégia.', icone: 'alvo' },
        { quando: 'Dia 6 · Pro', titulo: 'Landing page: copy e design', texto: 'Formulário da página preenchido e criação de copy e design gráfico.', icone: 'caneta' },
        { quando: 'Dia 7', titulo: 'Script de vendas', texto: 'Script de vendas e roteiro para gravar os anúncios.', icone: 'balao' },
        { quando: 'Dias 8–15', titulo: 'Campanhas no ar', texto: 'Anúncios rodando e captando leads.', icone: 'megafone' },
        { quando: 'Dias 13–15 · Pro', titulo: 'Página de vendas', texto: 'Finalização da página de vendas.', icone: 'camadas' },
        { quando: 'Dia 17 · Pro', titulo: '1º alinhamento comercial', texto: 'Revisão do funil e ajuste fino do processo.', icone: 'aperto' },
      ],
    },
    {
      id: 'evolucao', nome: 'Evolução Jurídica', duracao: '4 semanas', unidade: 'semanas',
      resumo: 'Posicionamento e presença digital para o escritório ser encontrado e lembrado.',
      etapas: [
        { quando: 'Semana 0', titulo: 'Kick-off e onboarding', texto: 'Reunião de início, acessos e alinhamento de metas. (validar)', icone: 'megafone' },
        { quando: 'Semana 1', titulo: 'Posicionamento', texto: 'Como o escritório quer ser percebido e para quem ele fala. (validar)', icone: 'alvo' },
        { quando: 'Semana 2', titulo: 'Presença digital', texto: 'Perfis e canais organizados para atrair o cliente certo. (validar)', icone: 'sol' },
        { quando: 'Semana 3', titulo: 'Capacitação e vitrine', texto: 'Time capacitado e escritório pronto para ser encontrado. (validar)', icone: 'insta' },
        { quando: 'Semana 4', titulo: 'Resultados', texto: 'Primeiros resultados medidos e próximos passos definidos. (validar)', icone: 'grafico' },
      ],
    },
    {
      id: 'evolucao-pro', nome: 'Evolução Pro', duracao: '8 semanas', unidade: 'semanas',
      resumo: 'Tudo da Evolução Jurídica, mais prospecção ativa, live estratégica e otimização comercial.',
      etapas: [
        { quando: 'Semana 0', titulo: 'Kick-off e onboarding', texto: 'Reunião de início, acessos e alinhamento de metas. (validar)', icone: 'megafone' },
        { quando: 'Semana 1', titulo: 'Posicionamento', texto: 'Como o escritório quer ser percebido e para quem ele fala. (validar)', icone: 'alvo' },
        { quando: 'Semana 2', titulo: 'Presença digital', texto: 'Perfis e canais organizados para atrair o cliente certo. (validar)', icone: 'sol' },
        { quando: 'Semana 3', titulo: 'Capacitação e vitrine', texto: 'Time capacitado e escritório pronto para ser encontrado. (validar)', icone: 'insta' },
        { quando: 'Semana 4', titulo: 'Resultados', texto: 'Primeiros resultados medidos e ajustados. (validar)', icone: 'grafico' },
        { quando: 'Semana 5', titulo: 'Prospecção ativa', texto: 'O escritório indo atrás dos clientes certos. (validar)', icone: 'pessoas' },
        { quando: 'Semana 6', titulo: 'Live estratégica no TikTok', texto: 'Autoridade ao vivo, onde o seu cliente está. (validar)', icone: 'telefone' },
        { quando: 'Semana 7', titulo: 'Otimização comercial', texto: 'Ajuste fino do atendimento e do fechamento. (validar)', icone: 'engrenagem' },
        { quando: 'Semana 8', titulo: 'Resultados e escala', texto: 'Consolidação do que funciona e plano para escalar. (validar)', icone: 'medalha' },
      ],
    },
    {
      id: 'estruturacao', nome: 'Estruturação Digital', duracao: '6 semanas', unidade: 'semanas',
      resumo: 'Toda a estrutura de captação montada: diagnóstico, comercial, landing page, CRM com IA e mídia paga.',
      etapas: [
        { quando: 'Semana 0', titulo: 'Onboarding', texto: 'Diagnóstico 360°, CRM com IA, landing page e acessos às ferramentas de tráfego.', icone: 'aperto' },
        { quando: 'Semana 1', titulo: 'Direcionamento', texto: 'Diagnóstico 360° concluído e apresentado em reunião estratégica.', icone: 'alvo' },
        { quando: 'Semana 2', titulo: 'Orgânico', texto: 'Auditoria criativa das redes sociais e do posicionamento orgânico.', icone: 'insta' },
        { quando: 'Semana 3', titulo: 'Comercial', texto: 'Treinamento comercial, ICP, scripts de atendimento e cadência de follow-up.', icone: 'grafico' },
        { quando: 'Semana 4', titulo: 'Entregáveis', texto: 'Landing page, CRM com IA e Google Meu Negócio publicados e funcionando.', icone: 'camadas' },
        { quando: 'Semana 5', titulo: 'Auditoria de mídia paga', texto: 'Estratégia de captação, roteiros de vídeo e direção de arte dos criativos.', icone: 'megafone' },
        { quando: 'Semana 6', titulo: 'Assessoria', texto: 'Entrega dos criativos e início das campanhas de mídia paga.', icone: 'raio' },
      ],
    },
    {
      id: 'aceleracao', nome: 'Aceleração Comercial', duracao: '8 semanas', unidade: 'semanas',
      resumo: 'Para quem já recebe contatos: CRM, scripts, treinamento e conversão medida no detalhe.',
      etapas: [
        { quando: 'Semana 1', titulo: 'Diagnóstico e ICP', texto: 'Mapeamos seu cliente ideal e os gargalos de conversão.', icone: 'alvo' },
        { quando: 'Semana 2', titulo: 'Setup de CRM', texto: 'CRM configurado e integrado à sua mídia paga ativa.', icone: 'sol' },
        { quando: 'Semana 3', titulo: 'Engenharia de scripts', texto: 'Abordagem, triagem e quebra de objeção no WhatsApp.', icone: 'balao' },
        { quando: 'Semana 4', titulo: 'Treinamento do time', texto: 'Sua equipe treinada no SLA de resposta rápida.', icone: 'pessoas' },
        { quando: 'Semana 5', titulo: 'Go-live assistido', texto: 'Lançamento com leads reais, sob supervisão técnica.', icone: 'raio' },
        { quando: 'Semana 6', titulo: 'Ajuste de conversão', texto: 'Refino das abordagens com base nos dados do CRM.', icone: 'grafico' },
        { quando: 'Semana 7', titulo: 'Métricas e performance', texto: 'Auditoria da conversão comercial da sua mídia.', icone: 'barras' },
        { quando: 'Semana 8', titulo: 'Consolidação e plano 90 dias', texto: 'Relatório final e plano de escala comercial.', icone: 'medalha' },
      ],
    },
  ],
  jornada: {
    eyebrow: 'Sua jornada',
    titulo: 'Cada etapa é um degrau *em direção à luz.*',
    escolha: 'Escolha um programa',
  },

  acompanhamento: {
    eyebrow: 'Depois do onboarding',
    titulo: 'A jornada não termina: *acompanhamento contínuo.*',
    itens: ['Reuniões de resultado', 'Relatórios de métricas', 'Campanhas otimizadas toda semana', 'CRM com IA respondendo 24 h', 'Treinamento do time comercial', 'Grupo no WhatsApp com o seu time E3'],
    texto: 'Um time que acompanha os números com você, ajusta o que não está funcionando e mantém o escritório crescendo.',
  },

  simulador: {
    eyebrow: 'Simulador ilustrativo',
    titulo: 'Do anúncio ao *contrato assinado.*',
    rotulo: 'Investimento mensal em anúncios',
    min: 2000, max: 30000, passo: 1000, inicial: 8000,
    // Premissas ilustrativas: ajuste com números reais do time E3.
    custoPorContato: 35, taxaQualificacao: 0.35, taxaAtendimento: 0.7, taxaFechamento: 0.25,
    etapas: ['Contatos', 'Qualificados pela IA', 'Atendimentos', 'Contratos'],
    aviso: 'Simulação ilustrativa, sem promessa de resultado. Os números reais dependem da área, da região e do comercial do escritório.',
  },

  depoimentos: {
    eyebrow: 'À sua direita',
    titulo: 'Quem já está *na luz.*',
    dica: 'Olhe para um vídeo ou toque nele para ouvir',
    // Arquivos em media/depoimentos/<arquivo>.mp4 e .jpg (fora do repositório público).
    videos: [
      { arquivo: '12', nome: 'Pablo Oliveira' },
      { arquivo: 'rayrison-lopes', nome: 'Rayrison Lopes' },
      { arquivo: '3', nome: 'Leandro' },
      { arquivo: 'allan-ramos', nome: 'Allan Ramos' },
      { arquivo: 'jefferson', nome: 'Jefferson' },
      { arquivo: 'bruna-soares', nome: 'Bruna Soares' },
      { arquivo: 'heliton-hirt', nome: 'Heliton Hirt' },
      { arquivo: 'heloisa-gabriela', nome: 'Heloísa Gabriela' },
      { arquivo: 'jose-antonio', nome: 'José Antônio' },
      { arquivo: '2', nome: 'Ana Isabel' },
      { arquivo: '5', nome: 'Fernando' },
      { arquivo: '6', nome: 'Paulo Tenório' },
      { arquivo: '9', nome: 'Aline' },
    ],
  },

  cases: {
    eyebrow: 'À sua esquerda',
    titulo: 'Antes e depois *da E3.*',
    // Fonte: depoimentos em vídeo (Drive e site), ditos pelos próprios clientes. Conferir números antes do evento.
    lista: [
      { nome: 'Pablo Oliveira · Oliveira e Camilo Advogados', anonimo: 'Escritório de passivo bancário',
        metrica: 'Faturamento mensal', antes: 100, depois: 1000, antesTxt: 'R$ 100 mil', depoisTxt: 'R$ 1 mi+', antesRotulo: 'jan/2025', depoisRotulo: 'jan/2026',
        frase: 'Se comigo deu certo, por que com você não daria?' },
      { nome: 'Rayrison Lopes', anonimo: 'Escritório no Maranhão',
        metrica: 'Contratos por mês, em 3 meses', antes: 6, depois: 26, antesTxt: '6', depoisTxt: '26', antesRotulo: '1º mês', depoisRotulo: '3º mês',
        frase: 'Em 3 meses, a E3 revolucionou o nosso escritório.' },
      { nome: 'Leandro · Godoy Almeida e Bueno', anonimo: 'Escritório de direito bancário',
        metrica: 'Contratos fechados em um mês', antes: 0, depois: 250, antesTxt: '—', depoisTxt: '250+', depoisRotulo: '~R$ 350 mil no mês',
        frase: 'Toda semana o time entra em contato para alinhar as estratégias.' },
      { nome: 'Fernando', anonimo: 'Advogado com 20 anos de carreira',
        metrica: 'Contratos no 1º mês', antes: 0, depois: 15, antesTxt: '—', depoisTxt: '15', antesRotulo: 'já tinha tentado agências',
        frase: 'O retorno foi imediato, com investimento em tráfego muito baixo.' },
      { nome: 'Ana Isabel · Paiva Lobo Advogadas', anonimo: 'Escritório tributário para empresas',
        metrica: 'Contratos na 1ª quinzena do mês', antes: 0, depois: 7, antesTxt: '—', depoisTxt: '7', depoisRotulo: 'R$ 120 mil em 15 dias',
        frase: 'O principal diferencial é a qualificação dos leads.' },
      { nome: 'Rui Rodrigues · Nacional Soluções Corporativas', anonimo: 'Escritório empresarial',
        metrica: 'Contratos por mês', antes: 2.5, depois: 5, antesTxt: '2 a 3', depoisTxt: '5+',
        frase: 'Eu mais que dobrei os contratos que a gente estava fechando por mês.' },
      { nome: 'Camila · Advogada', anonimo: 'Advogada recomeçando no Brasil',
        metrica: 'Contratos por mês', antes: 7, depois: 14, antesTxt: '7', depoisTxt: '14', antesRotulo: '1º mês',
        frase: 'Eles dão a mão e levam a gente.' },
      { nome: 'Oesley', anonimo: 'Escritório trabalhista e imobiliário',
        metrica: 'Contratos em 2 semanas', antes: 0, depois: 14, antesTxt: '—', depoisTxt: '14', antesRotulo: 'campanhas próprias',
        frase: 'Só a semana passada talvez tenha pagado o ano.' },
      { nome: 'Miguel Filipe · ABR Advogados', anonimo: 'Escritório de reestruturação de dívidas',
        metrica: 'Contratos por mês vindos do digital', antes: 0, depois: 4, antesTxt: '0', depoisTxt: '4', depoisRotulo: 'ticket de ~R$ 30 mil',
        frase: 'Se você também não acreditava no digital, recomendo o trabalho da E3.' },
      { nome: 'Felipe Deneka', anonimo: 'Escritório parceiro desde 2022',
        metrica: 'Leads em cerca de 3 meses', antes: 0, depois: 500, antesTxt: '—', depoisTxt: '500+',
        frase: 'Podem confiar no trabalho. Vocês não vão se arrepender.' },
    ],
  },

  cta: {
    eyebrow: 'Próximo passo',
    titulo: 'Você já viu o caminho. *Vamos começar?*',
    texto: 'Escolha agora: o nosso time traz o contrato até você, ou um atendente vem conversar.',
    assinar: 'Assinar contrato',
    atendente: 'Falar com atendente',
    okAssinar: 'Perfeito! *O closer já está vindo* com o contrato.',
    okAtendente: 'Combinado! *Um atendente já está vindo* falar com você.',
    tireOculos: 'Pode tirar o óculos com calma.',
    erroAviso: 'Não consegui avisar o time pela internet. Acene para um atendente, por favor.',
    voltar: 'Voltar ao estande',
  },

  fim: {
    titulo: 'Obrigado por conhecer a *E3 Company.*',
    texto: 'Pode tirar o óculos com calma. O time E3 está do seu lado.',
  },
};
