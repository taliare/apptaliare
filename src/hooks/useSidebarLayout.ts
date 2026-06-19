import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import {
  ALL_MENUS,
  getMenuByKey,
  type MenuModule,
} from "@/lib/menuPermissions";
import {
  getLayoutForRole,
  type MenuLayoutCategory,
} from "@/lib/menuLayouts";

export interface ResolvedCategory {
  id: string;
  label: string;
  iconName: string;
  direct: boolean;
  items: MenuModule[];
}

/**
 * Produz a estrutura de categorias da sidebar para o usuário corrente,
 * combinando o layout do papel + permissões efetivas + extras individuais.
 * NÃO altera segurança/acesso — apenas decide o que aparece no menu.
 */
export function useSidebarLayout(): ResolvedCategory[] {
  const { profile } = useAuth();
  const { hasMenuAccess, permissions, isLoading } = useMenuPermissions();
  const role = profile?.role;
  const isAdmin = role === "admin";

  return useMemo(() => {
    if (isLoading && !isAdmin) return [];

    const layout: MenuLayoutCategory[] = getLayoutForRole(role);
    const layoutKeys = new Set(layout.flatMap((c) => c.menuKeys));

    // 1. Resolve cada categoria do layout do papel, filtrando por permissão
    const resolved: ResolvedCategory[] = layout.map((cat) => {
      const items = cat.menuKeys
        .map((k) => getMenuByKey(k))
        .filter((m): m is MenuModule => !!m)
        .filter((m) => hasMenuAccess(m.key));
      return {
        id: cat.id,
        label: cat.label,
        iconName: cat.iconName,
        direct: !!cat.direct,
        items,
      };
    });

    // 2. Para não-admin, injeta EXTRAS (módulos liberados que não estão no layout do papel)
    if (!isAdmin) {
      const extras = ALL_MENUS.filter(
        (m) => !layoutKeys.has(m.key) && permissions.includes(m.key),
      );
      if (extras.length) {
        const outros: ResolvedCategory = {
          id: "outros",
          label: "OUTROS",
          iconName: "Shield",
          direct: false,
          items: extras,
        };
        resolved.push(outros);
      }
    }

    // 3. Remove categorias vazias (e categorias diretas sem item resolvido)
    return resolved.filter((c) => c.items.length > 0);
  }, [role, isAdmin, isLoading, hasMenuAccess, permissions]);
}
