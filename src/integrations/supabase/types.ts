export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cobrancas_agendadas: {
        Row: {
          criado_em: string | null
          data_agendada: string
          id: string
          observacoes: string | null
          representante_id: string
          revendedora: string
          status: Database["public"]["Enums"]["status_cobranca"] | null
          valor_previsto: number
        }
        Insert: {
          criado_em?: string | null
          data_agendada: string
          id?: string
          observacoes?: string | null
          representante_id: string
          revendedora: string
          status?: Database["public"]["Enums"]["status_cobranca"] | null
          valor_previsto: number
        }
        Update: {
          criado_em?: string | null
          data_agendada?: string
          id?: string
          observacoes?: string | null
          representante_id?: string
          revendedora?: string
          status?: Database["public"]["Enums"]["status_cobranca"] | null
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_agendadas_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_diarias: {
        Row: {
          criado_em: string | null
          data: string
          despesa_cobranca: number | null
          finalizado: boolean | null
          id: string
          representante_id: string
          total_cartao: number | null
          total_cobrado: number
          total_dinheiro: number | null
          total_pix: number | null
        }
        Insert: {
          criado_em?: string | null
          data: string
          despesa_cobranca?: number | null
          finalizado?: boolean | null
          id?: string
          representante_id: string
          total_cartao?: number | null
          total_cobrado: number
          total_dinheiro?: number | null
          total_pix?: number | null
        }
        Update: {
          criado_em?: string | null
          data?: string
          despesa_cobranca?: number | null
          finalizado?: boolean | null
          id?: string
          representante_id?: string
          total_cartao?: number | null
          total_cobrado?: number
          total_dinheiro?: number | null
          total_pix?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_diarias_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kits_entregues: {
        Row: {
          codigo_mostruario: string
          criado_em: string | null
          data_entrega: string
          data_vencimento: string
          id: string
          prestacao_id: string | null
          representante_id: string
          tipo: string | null
        }
        Insert: {
          codigo_mostruario: string
          criado_em?: string | null
          data_entrega: string
          data_vencimento: string
          id?: string
          prestacao_id?: string | null
          representante_id: string
          tipo?: string | null
        }
        Update: {
          codigo_mostruario?: string
          criado_em?: string | null
          data_entrega?: string
          data_vencimento?: string
          id?: string
          prestacao_id?: string | null
          representante_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kits_entregues_prestacao_id_fkey"
            columns: ["prestacao_id"]
            isOneToOne: false
            referencedRelation: "prestacoes_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_entregues_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_cobranca: {
        Row: {
          ano_mes: string
          ativo: boolean | null
          criado_em: string | null
          id: string
          meta_valor: number
          representante_id: string
        }
        Insert: {
          ano_mes: string
          ativo?: boolean | null
          criado_em?: string | null
          id?: string
          meta_valor: number
          representante_id: string
        }
        Update: {
          ano_mes?: string
          ativo?: boolean | null
          criado_em?: string | null
          id?: string
          meta_valor?: number
          representante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_cobranca_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_promissorias: {
        Row: {
          codigo_nota: string
          criado_em: string | null
          data: string
          forma_pagamento_1: Database["public"]["Enums"]["forma_pagamento"]
          forma_pagamento_2:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id: string
          representante_id: string
          valor_pagamento_1: number
          valor_pagamento_2: number | null
          valor_total: number
        }
        Insert: {
          codigo_nota: string
          criado_em?: string | null
          data: string
          forma_pagamento_1: Database["public"]["Enums"]["forma_pagamento"]
          forma_pagamento_2?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          representante_id: string
          valor_pagamento_1: number
          valor_pagamento_2?: number | null
          valor_total: number
        }
        Update: {
          codigo_nota?: string
          criado_em?: string | null
          data?: string
          forma_pagamento_1?: Database["public"]["Enums"]["forma_pagamento"]
          forma_pagamento_2?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          representante_id?: string
          valor_pagamento_1?: number
          valor_pagamento_2?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_promissorias_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prestacoes_contas: {
        Row: {
          cobranca_id: string | null
          codigo_mostruario: string | null
          comissao_percentual: number
          comissao_valor: number
          criado_em: string | null
          data_execucao: string
          data_vencimento_mostruario: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          houve_renovacao: boolean | null
          id: string
          representante_id: string
          revendedora: string
          saldo_devedor: number | null
          total_venda: number
          valor_devido_empresa: number
          valor_pago: number
        }
        Insert: {
          cobranca_id?: string | null
          codigo_mostruario?: string | null
          comissao_percentual: number
          comissao_valor: number
          criado_em?: string | null
          data_execucao: string
          data_vencimento_mostruario?: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          houve_renovacao?: boolean | null
          id?: string
          representante_id: string
          revendedora: string
          saldo_devedor?: number | null
          total_venda: number
          valor_devido_empresa: number
          valor_pago: number
        }
        Update: {
          cobranca_id?: string | null
          codigo_mostruario?: string | null
          comissao_percentual?: number
          comissao_valor?: number
          criado_em?: string | null
          data_execucao?: string
          data_vencimento_mostruario?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          houve_renovacao?: boolean | null
          id?: string
          representante_id?: string
          revendedora?: string
          saldo_devedor?: number | null
          total_venda?: number
          valor_devido_empresa?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestacoes_contas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_agendadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestacoes_contas_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          email: string | null
          habilitar_cobranca_diaria: boolean | null
          habilitar_dashboard: boolean | null
          habilitar_kanban: boolean | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string | null
          habilitar_cobranca_diaria?: boolean | null
          habilitar_dashboard?: boolean | null
          habilitar_kanban?: boolean | null
          id: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string | null
          habilitar_cobranca_diaria?: boolean | null
          habilitar_dashboard?: boolean | null
          habilitar_kanban?: boolean | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      repasses: {
        Row: {
          atualizado_em: string | null
          cobranca_id: string
          criado_em: string | null
          data_repasse: string
          id: string
          status: string
          valor_repasse: number
        }
        Insert: {
          atualizado_em?: string | null
          cobranca_id: string
          criado_em?: string | null
          data_repasse: string
          id?: string
          status?: string
          valor_repasse: number
        }
        Update: {
          atualizado_em?: string | null
          cobranca_id?: string
          criado_em?: string | null
          data_repasse?: string
          id?: string
          status?: string
          valor_repasse?: number
        }
        Relationships: [
          {
            foreignKeyName: "repasses_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_agendadas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "representante" | "producao"
      forma_pagamento: "pix" | "dinheiro" | "cartao" | "transferencia"
      status_cobranca: "pendente" | "pago" | "parcial" | "reagendado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "representante", "producao"],
      forma_pagamento: ["pix", "dinheiro", "cartao", "transferencia"],
      status_cobranca: ["pendente", "pago", "parcial", "reagendado"],
    },
  },
} as const
