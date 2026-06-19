// Registro UNIFICADO de todos os módulos do sistema.
// Cada módulo é a fonte da verdade para sidebar + matriz de permissões.

export type MenuCategoryLabel =
  | "INÍCIO"
  | "AGENDA"
  | "KITS"
  | "GESTÃO"
  | "PRODUÇÃO"
  | "VISÃO GERAL"
  | "OPERACIONAL"
  | "FINANCEIRO"
  | "RELATÓRIOS";

export interface MenuModule {
  key: string;
  label: string;
  route: string;
  category: MenuCategoryLabel;
  iconName: string;
}

// Módulo /perfil é exceção fixa — sempre liberado, não entra na matriz.
export const ALWAYS_ALLOWED_ROUTES = ["/perfil"];

export const ALL_MENUS: MenuModule[] = [
  // Representante / operação de campo
  { key: "dashboard",             label: "Painel Geral",         route: "/dashboard",             category: "INÍCIO",      iconName: "Home" },
  { key: "cobranca",              label: "Agenda",               route: "/cobranca",              category: "AGENDA",      iconName: "Calendar" },
  { key: "cobranca_diaria",       label: "Fechamento do Dia",    route: "/cobranca-diaria",       category: "AGENDA",      iconName: "CalendarCheck" },
  { key: "kits",                  label: "Kits em Mãos",         route: "/kits",                  category: "KITS",        iconName: "Package" },
  { key: "kits_entregues",        label: "Kits Entregues",       route: "/kits-entregues",        category: "KITS",        iconName: "PackageCheck" },
  { key: "encomendas",            label: "Pedidos de Kit",       route: "/encomendas",            category: "KITS",        iconName: "ShoppingBag" },
  { key: "revendedoras_inativas", label: "Minhas Revendedoras",  route: "/revendedoras-inativas", category: "GESTÃO",      iconName: "Users" },
  { key: "historico_acoes",       label: "Histórico de Ações",   route: "/historico-acoes",       category: "GESTÃO",      iconName: "ClipboardList" },

  // Produção
  { key: "producao",              label: "Painel Produção",      route: "/producao",              category: "PRODUÇÃO",    iconName: "Factory" },
  { key: "producao_diaria",       label: "Produção Diária",      route: "/producao-diaria",       category: "PRODUÇÃO",    iconName: "Package" },
  { key: "catalogo_produtos",     label: "Catálogo de Produtos", route: "/catalogo-produtos",     category: "PRODUÇÃO",    iconName: "BookOpen" },
  { key: "montar_kit",            label: "Montar Kit",           route: "/montar-kit",            category: "PRODUÇÃO",    iconName: "ScanLine" },
  { key: "encomendas_producao",   label: "Encomendas Produção",  route: "/encomendas-producao",   category: "PRODUÇÃO",    iconName: "ShoppingBag" },

  // Admin — VISÃO GERAL
  { key: "dashboard_admin",       label: "Painel Admin",         route: "/dashboard-admin",       category: "VISÃO GERAL", iconName: "Home" },

  // Admin — OPERACIONAL
  { key: "usuarios",              label: "Usuários",             route: "/usuarios",              category: "OPERACIONAL", iconName: "Users" },
  { key: "grupos_permissoes",     label: "Grupos e Permissões",  route: "/grupos-permissoes",     category: "OPERACIONAL", iconName: "Shield" },
  { key: "revendedoras",          label: "Revendedoras",         route: "/revendedoras",          category: "OPERACIONAL", iconName: "Users" },
  { key: "venda_externa",         label: "Venda Externa",        route: "/venda-externa",         category: "OPERACIONAL", iconName: "Users" },
  { key: "crm",                   label: "CRM",                  route: "/leads-revendedoras",    category: "OPERACIONAL", iconName: "UserPlus" },
  { key: "distribuicao_kits",     label: "Distribuição de Kits", route: "/distribuicao-kits",     category: "OPERACIONAL", iconName: "Package" },
  { key: "garantias",             label: "Garantias",            route: "/garantias",             category: "OPERACIONAL", iconName: "Shield" },

  // Admin — FINANCEIRO
  { key: "fechamento_diario",     label: "Fechamento Diário",    route: "/fechamento-diario",     category: "FINANCEIRO",  iconName: "CalendarCheck" },
  { key: "metas",                 label: "Metas",                route: "/metas",                 category: "FINANCEIRO",  iconName: "Target" },
  { key: "gerenciar_agenda",      label: "Gerenciar Agenda",     route: "/gerenciar-agenda",      category: "FINANCEIRO",  iconName: "Calendar" },
  { key: "apuracao",              label: "Apuração de Kits",     route: "/apuracao",              category: "FINANCEIRO",  iconName: "PackageCheck" },
  { key: "juridico",              label: "Jurídico",             route: "/juridico",              category: "FINANCEIRO",  iconName: "Scale" },
  { key: "dre_resumo",            label: "Resumo DRE",           route: "/dre-resumo",            category: "FINANCEIRO",  iconName: "TrendingUp" },
  { key: "dre_despesas",          label: "Despesas",             route: "/dre-despesas",          category: "FINANCEIRO",  iconName: "Receipt" },
  { key: "dre_categorias",        label: "Categorias",           route: "/dre-categorias",        category: "FINANCEIRO",  iconName: "FolderOpen" },
  { key: "fluxo_caixa",           label: "Fluxo de Caixa",       route: "/fluxo-caixa",           category: "FINANCEIRO",  iconName: "Wallet" },
  { key: "configuracao_pdf",      label: "Configuração PDF",     route: "/configuracao-pdf",      category: "FINANCEIRO",  iconName: "FileText" },

  // Admin — RELATÓRIOS
  { key: "relatorio_kpis",        label: "Relatório KPIs",       route: "/relatorio-kpis",        category: "RELATÓRIOS",  iconName: "BarChart3" },
  { key: "analise_comercial",     label: "Análise de Desempenho",route: "/analise-comercial",     category: "RELATÓRIOS",  iconName: "LineChart" },
  { key: "auditoria_geral",       label: "Auditoria Geral",      route: "/auditoria-geral",       category: "RELATÓRIOS",  iconName: "ClipboardList" },
  { key: "importar_cobrancas",    label: "Importar Cobranças",   route: "/importar-cobrancas",    category: "RELATÓRIOS",  iconName: "Upload" },
];

export type MenuKey = (typeof ALL_MENUS)[number]["key"];

// Ordem das categorias no sidebar
export const CATEGORY_ORDER: MenuCategoryLabel[] = [
  "INÍCIO",
  "VISÃO GERAL",
  "AGENDA",
  "KITS",
  "PRODUÇÃO",
  "OPERACIONAL",
  "GESTÃO",
  "FINANCEIRO",
  "RELATÓRIOS",
];

export function getMenuByKey(key: string): MenuModule | undefined {
  return ALL_MENUS.find((m) => m.key === key);
}

export function getMenuByRoute(route: string): MenuModule | undefined {
  return ALL_MENUS.find((m) => m.route === route);
}

export function getMenuKeyFromRoute(route: string): MenuKey | null {
  return (getMenuByRoute(route)?.key as MenuKey) || null;
}

export function getRouteFromMenuKey(key: MenuKey): string | null {
  return getMenuByKey(key)?.route || null;
}

// === Compatibilidade com código existente ===
// Antes ASSIGNABLE_MENUS continha apenas menus extras atribuíveis a usuários
// não-admin. Agora qualquer módulo do sistema pode ser atribuído como exceção,
// então expomos a lista completa.
export const ASSIGNABLE_MENUS = ALL_MENUS.map(({ key, label, route }) => ({
  key,
  label,
  route,
}));

// Mantido para retro-compatibilidade com qualquer chamada externa.
// Os ícones e categorias agora vivem em ALL_MENUS.
export const MENU_EXTRA_CONFIG: Record<
  string,
  { iconName: string; category: string }
> = Object.fromEntries(
  ALL_MENUS.map((m) => [m.key, { iconName: m.iconName, category: m.category }]),
);
