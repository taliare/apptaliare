// Definição dos menus que podem ser atribuídos a usuários não-admin

export const ASSIGNABLE_MENUS = [
  { key: 'crm', label: 'CRM', route: '/leads-revendedoras' },
  { key: 'revendedoras', label: 'Revendedoras', route: '/revendedoras' },
  { key: 'venda_externa', label: 'Venda Externa', route: '/venda-externa' },
  { key: 'garantias', label: 'Garantias', route: '/garantias' },
  { key: 'distribuicao_kits', label: 'Distribuição de Kits', route: '/distribuicao-kits' },
  { key: 'fechamento_diario', label: 'Fechamento Diário', route: '/fechamento-diario' },
  { key: 'metas', label: 'Metas', route: '/metas' },
  { key: 'gerenciar_agenda', label: 'Gerenciar Agenda', route: '/gerenciar-agenda' },
  { key: 'juridico', label: 'Jurídico', route: '/juridico' },
  { key: 'dre_resumo', label: 'Resumo DRE', route: '/dre-resumo' },
  { key: 'dre_despesas', label: 'Despesas', route: '/dre-despesas' },
  { key: 'dre_categorias', label: 'Categorias DRE', route: '/dre-categorias' },
  { key: 'relatorio_kpis', label: 'Relatório KPIs', route: '/relatorio-kpis' },
  { key: 'analise_comercial', label: 'Análise Comercial', route: '/analise-comercial' },
  { key: 'importar_cobrancas', label: 'Importar Cobranças', route: '/importar-cobrancas' },
  { key: 'relatorios', label: 'Relatórios', route: '/relatorios' },
  { key: 'usuarios', label: 'Usuários', route: '/usuarios' },
  { key: 'auditoria_geral', label: 'Auditoria Geral', route: '/auditoria-geral' },
  { key: 't2_producao', label: 'T2 Produção', route: '/t2-producao' },
  { key: 't2_revendedoras', label: 'T2 Revendedoras', route: '/t2-revendedoras' },
  { key: 't2_ciclos', label: 'T2 Ciclos', route: '/t2-ciclos' },
  { key: 't2_ranking', label: 'Ranking T2', route: '/t2-ranking' },
  { key: 't2_radar', label: 'Radar da Rede', route: '/t2-radar' },
  { key: 't2_inadimplencia', label: 'Inadimplência T2', route: '/t2-inadimplencia' },
] as const;

export type MenuKey = typeof ASSIGNABLE_MENUS[number]['key'];

// Mapa de ícones e categorias para injeção dinâmica de menus extras
// Usado quando um representante/produção recebe permissão para menus que não estão na sua lista base
export const MENU_EXTRA_CONFIG: Record<string, { iconName: string; category: string }> = {
  crm: { iconName: 'UserPlus', category: 'GESTÃO' },
  revendedoras: { iconName: 'Users', category: 'GESTÃO' },
  venda_externa: { iconName: 'Users', category: 'GESTÃO' },
  garantias: { iconName: 'Shield', category: 'GESTÃO' },
  distribuicao_kits: { iconName: 'Package', category: 'GESTÃO' },
  fechamento_diario: { iconName: 'CalendarCheck', category: 'FINANCEIRO' },
  metas: { iconName: 'Target', category: 'FINANCEIRO' },
  gerenciar_agenda: { iconName: 'Calendar', category: 'FINANCEIRO' },
  juridico: { iconName: 'Scale', category: 'FINANCEIRO' },
  dre_resumo: { iconName: 'TrendingUp', category: 'FINANCEIRO' },
  dre_despesas: { iconName: 'Receipt', category: 'FINANCEIRO' },
  dre_categorias: { iconName: 'FolderOpen', category: 'FINANCEIRO' },
  relatorio_kpis: { iconName: 'BarChart3', category: 'RELATÓRIOS' },
  analise_comercial: { iconName: 'LineChart', category: 'RELATÓRIOS' },
  importar_cobrancas: { iconName: 'Upload', category: 'RELATÓRIOS' },
  relatorios: { iconName: 'FileText', category: 'RELATÓRIOS' },
  usuarios: { iconName: 'Users', category: 'GESTÃO' },
  auditoria_geral: { iconName: 'ClipboardList', category: 'RELATÓRIOS' },
  t2_producao: { iconName: 'Package', category: 'TALIARE 2.0' },
  t2_revendedoras: { iconName: 'Users', category: 'TALIARE 2.0' },
  t2_ciclos: { iconName: 'Target', category: 'TALIARE 2.0' },
  t2_ranking: { iconName: 'TrendingUp', category: 'TALIARE 2.0' },
  t2_radar: { iconName: 'BarChart3', category: 'TALIARE 2.0' },
  t2_inadimplencia: { iconName: 'AlertTriangle', category: 'TALIARE 2.0' },
};

// Função para obter a chave do menu a partir da rota
export function getMenuKeyFromRoute(route: string): MenuKey | null {
  const menu = ASSIGNABLE_MENUS.find(m => m.route === route);
  return menu?.key || null;
}

// Função para obter a rota a partir da chave do menu
export function getRouteFromMenuKey(key: MenuKey): string | null {
  const menu = ASSIGNABLE_MENUS.find(m => m.key === key);
  return menu?.route || null;
}
