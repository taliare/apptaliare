// Layout do menu lateral por papel de usuário.
// Cada categoria referencia keys do registro ALL_MENUS (menuPermissions.ts).
// Esta é uma camada PURAMENTE DE NAVEGAÇÃO/visibilidade — não afeta acesso.

import type { MenuKey } from "./menuPermissions";

export interface MenuLayoutCategory {
  /** id estável p/ persistir aberto/fechado */
  id: string;
  /** título exibido (uppercase) */
  label: string;
  /** ícone (nome lucide-react, resolvido via ICON_MAP do sidebar) */
  iconName: string;
  /** se true, vira link direto (sem accordion). Usa o primeiro item. */
  direct?: boolean;
  /** keys de ALL_MENUS, na ordem desejada */
  menuKeys: MenuKey[];
}

export type MenuLayoutRole = "admin" | "representante" | "producao";

export const MENU_LAYOUTS: Record<MenuLayoutRole, MenuLayoutCategory[]> = {
  admin: [
    { id: "inicio",       label: "INÍCIO",            iconName: "Home",         direct: true, menuKeys: ["dashboard_admin"] },
    { id: "kits-prod",    label: "KITS & PRODUÇÃO",   iconName: "Package",      menuKeys: ["catalogo_produtos", "montar_kit", "distribuicao_kits", "apuracao"] },
    { id: "revendedoras", label: "REVENDEDORAS",      iconName: "Users",        menuKeys: ["revendedoras", "crm", "garantias"] },
    { id: "comercial",    label: "COBRANÇA & VENDAS", iconName: "Calendar",     menuKeys: ["gerenciar_agenda", "fechamento_diario", "venda_externa", "metas"] },
    { id: "financeiro",   label: "FINANCEIRO",        iconName: "Wallet",       menuKeys: ["fluxo_caixa", "dre_resumo", "dre_despesas", "dre_categorias", "juridico"] },
    { id: "relatorios",   label: "RELATÓRIOS",        iconName: "BarChart3",    menuKeys: ["relatorio_kpis", "analise_comercial", "auditoria_geral"] },
    { id: "sistema",      label: "SISTEMA",           iconName: "Shield",       menuKeys: ["usuarios", "grupos_permissoes", "configuracao_pdf"] },
  ],
  representante: [
    { id: "inicio",  label: "INÍCIO",  iconName: "Home",            direct: true, menuKeys: ["dashboard"] },
    { id: "agenda",  label: "AGENDA",  iconName: "Calendar",        menuKeys: ["cobranca", "cobranca_diaria"] },
    { id: "kits",    label: "KITS",    iconName: "Package",         menuKeys: ["kits", "kits_entregues", "encomendas"] },
    { id: "gestao",  label: "GESTÃO",  iconName: "Users",           menuKeys: ["revendedoras_inativas", "garantias", "historico_acoes"] },
  ],
  producao: [
    { id: "inicio",     label: "INÍCIO",     iconName: "Home",      direct: true, menuKeys: ["producao"] },
    { id: "producao",   label: "PRODUÇÃO",   iconName: "Factory",   menuKeys: ["producao_diaria", "distribuicao_kits", "catalogo_produtos", "montar_kit"] },
    { id: "encomendas", label: "ENCOMENDAS", iconName: "ShoppingBag", menuKeys: ["encomendas_producao"] },
  ],
};

export function getLayoutForRole(role: string | undefined | null): MenuLayoutCategory[] {
  if (role === "admin") return MENU_LAYOUTS.admin;
  if (role === "producao") return MENU_LAYOUTS.producao;
  return MENU_LAYOUTS.representante;
}
