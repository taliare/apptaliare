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
] as const;

export type MenuKey = typeof ASSIGNABLE_MENUS[number]['key'];

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
