// Definição dos menus que podem ser atribuídos a usuários não-admin

export const ASSIGNABLE_MENUS = [
  // VISÃO GERAL
  { key: "dashboard_admin", label: "Painel Admin", route: "/dashboard-admin" },
  // OPERACIONAL
  { key: "usuarios", label: "Usuários", route: "/usuarios" },
  { key: "revendedoras", label: "Revendedoras", route: "/revendedoras" },
  { key: "venda_externa", label: "Venda Externa", route: "/venda-externa" },
  { key: "crm", label: "CRM", route: "/leads-revendedoras" },
  { key: "distribuicao_kits", label: "Distribuição de Kits", route: "/distribuicao-kits" },
  { key: "garantias", label: "Garantias", route: "/garantias" },
  // FINANCEIRO
  { key: "fechamento_diario", label: "Fechamento Diário", route: "/fechamento-diario" },
  { key: "metas", label: "Metas", route: "/metas" },
  { key: "gerenciar_agenda", label: "Gerenciar Agenda", route: "/gerenciar-agenda" },
  { key: "apuracao", label: "Apuração de Kits", route: "/apuracao" },
  { key: "juridico", label: "Jurídico", route: "/juridico" },
  { key: "dre_resumo", label: "Resumo DRE", route: "/dre-resumo" },
  { key: "dre_despesas", label: "Despesas", route: "/dre-despesas" },
  { key: "dre_categorias", label: "Categorias DRE", route: "/dre-categorias" },
  // RELATÓRIOS
  { key: "relatorio_kpis", label: "Relatório KPIs", route: "/relatorio-kpis" },
  { key: "analise_comercial", label: "Análise Comercial", route: "/analise-comercial" },
  { key: "auditoria_geral", label: "Auditoria Geral", route: "/auditoria-geral" },
  { key: "importar_cobrancas", label: "Importar Cobranças", route: "/importar-cobrancas" },
  { key: "relatorios", label: "Relatórios", route: "/relatorios" },
] as const;

export type MenuKey = typeof ASSIGNABLE_MENUS[number]['key'];

export const MENU_EXTRA_CONFIG: Record<string, { iconName: string; category: string }> = {
  dashboard_admin:   { iconName: "Home",          category: "VISÃO GERAL" },
  usuarios:          { iconName: "Users",         category: "OPERACIONAL" },
  revendedoras:      { iconName: "Users",         category: "OPERACIONAL" },
  venda_externa:     { iconName: "Users",         category: "OPERACIONAL" },
  crm:               { iconName: "UserPlus",      category: "OPERACIONAL" },
  distribuicao_kits: { iconName: "Package",       category: "OPERACIONAL" },
  garantias:         { iconName: "Shield",        category: "OPERACIONAL" },
  fechamento_diario: { iconName: "CalendarCheck", category: "FINANCEIRO" },
  metas:             { iconName: "Target",        category: "FINANCEIRO" },
  gerenciar_agenda:  { iconName: "Calendar",      category: "FINANCEIRO" },
  apuracao:          { iconName: "PackageCheck",  category: "FINANCEIRO" },
  juridico:          { iconName: "Scale",         category: "FINANCEIRO" },
  dre_resumo:        { iconName: "TrendingUp",    category: "FINANCEIRO" },
  dre_despesas:      { iconName: "Receipt",       category: "FINANCEIRO" },
  dre_categorias:    { iconName: "FolderOpen",    category: "FINANCEIRO" },
  relatorio_kpis:    { iconName: "BarChart3",     category: "RELATÓRIOS" },
  analise_comercial: { iconName: "LineChart",     category: "RELATÓRIOS" },
  auditoria_geral:   { iconName: "ClipboardList", category: "RELATÓRIOS" },
  importar_cobrancas:{ iconName: "Upload",        category: "RELATÓRIOS" },
  relatorios:        { iconName: "FileText",      category: "RELATÓRIOS" },
};

// Função para obter a chave do menu a partir da rota
export function getMenuKeyFromRoute(route: string): MenuKey | null {
  const menu = ASSIGNABLE_MENUS.find(m => m.route === route);
  return (menu?.key as MenuKey) || null;
}

// Função para obter a rota a partir da chave do menu
export function getRouteFromMenuKey(key: MenuKey): string | null {
  const menu = ASSIGNABLE_MENUS.find(m => m.key === key);
  return menu?.route || null;
}
