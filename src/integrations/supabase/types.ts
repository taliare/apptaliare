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
      acrescimos_pedido: {
        Row: {
          cobranca_id: string | null
          criado_em: string | null
          data_lancamento: string
          descricao: string | null
          id: string
          kit_entregue_id: string
          representante_id: string
          revendedora: string
          status: string
          valor: number
        }
        Insert: {
          cobranca_id?: string | null
          criado_em?: string | null
          data_lancamento?: string
          descricao?: string | null
          id?: string
          kit_entregue_id: string
          representante_id: string
          revendedora: string
          status?: string
          valor: number
        }
        Update: {
          cobranca_id?: string | null
          criado_em?: string | null
          data_lancamento?: string
          descricao?: string | null
          id?: string
          kit_entregue_id?: string
          representante_id?: string
          revendedora?: string
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "acrescimos_pedido_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_agendadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acrescimos_pedido_kit_entregue_id_fkey"
            columns: ["kit_entregue_id"]
            isOneToOne: false
            referencedRelation: "kits_entregues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acrescimos_pedido_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acrescimos_pedido_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      ajustes_representantes: {
        Row: {
          cobranca_id: string
          criado_em: string | null
          diferenca: number
          id: string
          motivo: string | null
          quitado_em: string | null
          representante_id: string
          status: string
          valor_conferido: number
          valor_registrado: number
        }
        Insert: {
          cobranca_id: string
          criado_em?: string | null
          diferenca: number
          id?: string
          motivo?: string | null
          quitado_em?: string | null
          representante_id: string
          status?: string
          valor_conferido: number
          valor_registrado: number
        }
        Update: {
          cobranca_id?: string
          criado_em?: string | null
          diferenca?: number
          id?: string
          motivo?: string | null
          quitado_em?: string | null
          representante_id?: string
          status?: string
          valor_conferido?: number
          valor_registrado?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_representantes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_agendadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_representantes_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_representantes_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cobrancas_agendadas: {
        Row: {
          codigo_nota: string | null
          contagem_reagendamentos: number | null
          criado_em: string | null
          data_agendada: string
          data_encaminhado_juridico: string | null
          data_quitacao: string | null
          id: string
          kit_entregue_id: string | null
          observacoes: string | null
          representante_id: string
          revendedora: string
          status: Database["public"]["Enums"]["status_cobranca"] | null
          tipo: string | null
          valor_adiantado: number | null
          valor_pago_acumulado: number | null
          valor_previsto: number
          vendedora: string | null
          vendedora_id: string | null
        }
        Insert: {
          codigo_nota?: string | null
          contagem_reagendamentos?: number | null
          criado_em?: string | null
          data_agendada: string
          data_encaminhado_juridico?: string | null
          data_quitacao?: string | null
          id?: string
          kit_entregue_id?: string | null
          observacoes?: string | null
          representante_id: string
          revendedora: string
          status?: Database["public"]["Enums"]["status_cobranca"] | null
          tipo?: string | null
          valor_adiantado?: number | null
          valor_pago_acumulado?: number | null
          valor_previsto: number
          vendedora?: string | null
          vendedora_id?: string | null
        }
        Update: {
          codigo_nota?: string | null
          contagem_reagendamentos?: number | null
          criado_em?: string | null
          data_agendada?: string
          data_encaminhado_juridico?: string | null
          data_quitacao?: string | null
          id?: string
          kit_entregue_id?: string | null
          observacoes?: string | null
          representante_id?: string
          revendedora?: string
          status?: Database["public"]["Enums"]["status_cobranca"] | null
          tipo?: string | null
          valor_adiantado?: number | null
          valor_pago_acumulado?: number | null
          valor_previsto?: number
          vendedora?: string | null
          vendedora_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_agendadas_kit_entregue_id_fkey"
            columns: ["kit_entregue_id"]
            isOneToOne: false
            referencedRelation: "kits_entregues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_agendadas_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_agendadas_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_agendadas_vendedora_id_fkey"
            columns: ["vendedora_id"]
            isOneToOne: false
            referencedRelation: "vendedoras"
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
          observacoes: string | null
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
          observacoes?: string | null
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
          observacoes?: string | null
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
          {
            foreignKeyName: "cobrancas_diarias_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_categorias_despesas: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      dre_despesas: {
        Row: {
          ano_mes: string
          atualizado_em: string | null
          categoria_id: string | null
          criado_em: string | null
          criado_por: string | null
          data_despesa: string | null
          id: string
          observacao: string | null
          valor: number
        }
        Insert: {
          ano_mes: string
          atualizado_em?: string | null
          categoria_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_despesa?: string | null
          id?: string
          observacao?: string | null
          valor: number
        }
        Update: {
          ano_mes?: string
          atualizado_em?: string | null
          categoria_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_despesa?: string | null
          id?: string
          observacao?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "dre_despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "dre_categorias_despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      encomendas_kits: {
        Row: {
          atualizado_em: string
          codigo_kit: string | null
          criado_em: string
          descricao_pedido: string
          id: string
          producao_id: string | null
          representante_id: string
          status: string
          tipo_kit: string
        }
        Insert: {
          atualizado_em?: string
          codigo_kit?: string | null
          criado_em?: string
          descricao_pedido: string
          id?: string
          producao_id?: string | null
          representante_id: string
          status?: string
          tipo_kit: string
        }
        Update: {
          atualizado_em?: string
          codigo_kit?: string | null
          criado_em?: string
          descricao_pedido?: string
          id?: string
          producao_id?: string | null
          representante_id?: string
          status?: string
          tipo_kit?: string
        }
        Relationships: [
          {
            foreignKeyName: "encomendas_kits_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomendas_kits_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomendas_kits_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomendas_kits_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
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
          kit_estoque_id: string | null
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
          kit_estoque_id?: string | null
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
          kit_estoque_id?: string | null
          prestacao_id?: string | null
          representante_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kits_entregues_kit_estoque_id_fkey"
            columns: ["kit_estoque_id"]
            isOneToOne: false
            referencedRelation: "kits_estoque"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "kits_entregues_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      kits_estoque: {
        Row: {
          codigo: string
          criado_em: string
          encomenda_id: string | null
          id: string
          origem_producao_id: string | null
          representante_id: string | null
          status: string
          tipo: string
          valor: number | null
        }
        Insert: {
          codigo: string
          criado_em?: string
          encomenda_id?: string | null
          id?: string
          origem_producao_id?: string | null
          representante_id?: string | null
          status: string
          tipo: string
          valor?: number | null
        }
        Update: {
          codigo?: string
          criado_em?: string
          encomenda_id?: string | null
          id?: string
          origem_producao_id?: string | null
          representante_id?: string | null
          status?: string
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kits_estoque_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_estoque_origem_producao_id_fkey"
            columns: ["origem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_diaria"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_external_deletados: {
        Row: {
          deletado_em: string
          deletado_por: string | null
          external_id: string
          id: string
        }
        Insert: {
          deletado_em?: string
          deletado_por?: string | null
          external_id: string
          id?: string
        }
        Update: {
          deletado_em?: string
          deletado_por?: string | null
          external_id?: string
          id?: string
        }
        Relationships: []
      }
      leads_observacoes: {
        Row: {
          autor_id: string
          autor_nome: string
          conteudo: string
          criado_em: string
          id: string
          lead_id: string
        }
        Insert: {
          autor_id: string
          autor_nome: string
          conteudo: string
          criado_em?: string
          id?: string
          lead_id: string
        }
        Update: {
          autor_id?: string
          autor_nome?: string
          conteudo?: string
          criado_em?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_observacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_revendedoras"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_revendedoras: {
        Row: {
          bairro: string | null
          capital_inicial: string | null
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado_civil: string | null
          expectativa_venda: string | null
          experiencia_vendas: string | null
          external_id: string | null
          id: string
          idade: string | null
          instagram: string | null
          motivacao: string | null
          nome: string
          objetivo_financeiro_outro: string | null
          observacao: string | null
          origem: string | null
          possui_veiculo: string | null
          profissao: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          restricao_serasa: string | null
          status: string
          telefone_alternativo: string | null
          tempo_disponivel: string | null
          tentativas: number | null
          ultimo_envio: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string
        }
        Insert: {
          bairro?: string | null
          capital_inicial?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          expectativa_venda?: string | null
          experiencia_vendas?: string | null
          external_id?: string | null
          id?: string
          idade?: string | null
          instagram?: string | null
          motivacao?: string | null
          nome: string
          objetivo_financeiro_outro?: string | null
          observacao?: string | null
          origem?: string | null
          possui_veiculo?: string | null
          profissao?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          restricao_serasa?: string | null
          status?: string
          telefone_alternativo?: string | null
          tempo_disponivel?: string | null
          tentativas?: number | null
          ultimo_envio?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp: string
        }
        Update: {
          bairro?: string | null
          capital_inicial?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          expectativa_venda?: string | null
          experiencia_vendas?: string | null
          external_id?: string | null
          id?: string
          idade?: string | null
          instagram?: string | null
          motivacao?: string | null
          nome?: string
          objetivo_financeiro_outro?: string | null
          observacao?: string | null
          origem?: string | null
          possui_veiculo?: string | null
          profissao?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          restricao_serasa?: string | null
          status?: string
          telefone_alternativo?: string | null
          tempo_disponivel?: string | null
          tentativas?: number | null
          ultimo_envio?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_revendedoras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_revendedoras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_status_historico: {
        Row: {
          alterado_por: string | null
          alterado_por_nome: string | null
          criado_em: string | null
          id: string
          lead_id: string
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          criado_em?: string | null
          id?: string
          lead_id: string
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          criado_em?: string | null
          id?: string
          lead_id?: string
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_status_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_revendedoras"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_operacionais: {
        Row: {
          criado_em: string
          descricao: string
          id: string
          nome_usuario: string
          papel: string
          pedido_id: string | null
          tipo_acao: string
          usuario_id: string
          valor_antes: number | null
          valor_depois: number | null
        }
        Insert: {
          criado_em?: string
          descricao: string
          id?: string
          nome_usuario: string
          papel: string
          pedido_id?: string | null
          tipo_acao: string
          usuario_id: string
          valor_antes?: number | null
          valor_depois?: number | null
        }
        Update: {
          criado_em?: string
          descricao?: string
          id?: string
          nome_usuario?: string
          papel?: string
          pedido_id?: string | null
          tipo_acao?: string
          usuario_id?: string
          valor_antes?: number | null
          valor_depois?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "metas_cobranca_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_producao: {
        Row: {
          ano_mes: string
          criado_em: string | null
          id: string
          meta_kits: number
          observacao: string | null
        }
        Insert: {
          ano_mes: string
          criado_em?: string | null
          id?: string
          meta_kits?: number
          observacao?: string | null
        }
        Update: {
          ano_mes?: string
          criado_em?: string | null
          id?: string
          meta_kits?: number
          observacao?: string | null
        }
        Relationships: []
      }
      notas_promissorias: {
        Row: {
          cobranca_id: string | null
          codigo_nota: string
          criado_em: string | null
          data: string
          devolveu_tudo: boolean
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
          cobranca_id?: string | null
          codigo_nota: string
          criado_em?: string | null
          data: string
          devolveu_tudo?: boolean
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
          cobranca_id?: string | null
          codigo_nota?: string
          criado_em?: string | null
          data?: string
          devolveu_tudo?: boolean
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
          {
            foreignKeyName: "notas_promissorias_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      prestacoes_contas: {
        Row: {
          cobranca_id: string | null
          codigo_mostruario: string | null
          codigo_nota_referencia: string | null
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
          codigo_nota_referencia?: string | null
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
          codigo_nota_referencia?: string | null
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
          {
            foreignKeyName: "prestacoes_contas_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_diaria: {
        Row: {
          codigo: string
          criado_em: string
          criado_por: string
          data: string
          id: string
          tipo: string
          valor: number | null
        }
        Insert: {
          codigo: string
          criado_em?: string
          criado_por: string
          data: string
          id?: string
          tipo: string
          valor?: number | null
        }
        Update: {
          codigo?: string
          criado_em?: string
          criado_por?: string
          data?: string
          id?: string
          tipo?: string
          valor?: number | null
        }
        Relationships: []
      }
      produtos_taliare: {
        Row: {
          categoria: string | null
          codigo_barras: string
          criado_em: string | null
          descricao: string
          id: string
          preco_varejo: number | null
          referencia: string | null
          status: string | null
        }
        Insert: {
          categoria?: string | null
          codigo_barras: string
          criado_em?: string | null
          descricao: string
          id?: string
          preco_varejo?: number | null
          referencia?: string | null
          status?: string | null
        }
        Update: {
          categoria?: string | null
          codigo_barras?: string
          criado_em?: string | null
          descricao?: string
          id?: string
          preco_varejo?: number | null
          referencia?: string | null
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean | null
          avatar_url: string | null
          criado_em: string | null
          email: string | null
          habilitar_cobranca_diaria: boolean | null
          habilitar_dashboard: boolean | null
          habilitar_kanban: boolean | null
          id: string
          idioma: string | null
          nome: string
          tema: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          criado_em?: string | null
          email?: string | null
          habilitar_cobranca_diaria?: boolean | null
          habilitar_dashboard?: boolean | null
          habilitar_kanban?: boolean | null
          id: string
          idioma?: string | null
          nome: string
          tema?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          criado_em?: string | null
          email?: string | null
          habilitar_cobranca_diaria?: boolean | null
          habilitar_dashboard?: boolean | null
          habilitar_kanban?: boolean | null
          id?: string
          idioma?: string | null
          nome?: string
          tema?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          criado_em: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          criado_em?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          criado_em?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
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
      revendedoras: {
        Row: {
          ativo: boolean
          atualizado_em: string | null
          criado_em: string | null
          id: string
          nome: string
          representante_id: string | null
          ultima_atividade: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          representante_id?: string | null
          ultima_atividade?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          representante_id?: string | null
          ultima_atividade?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      t2_adiantamentos: {
        Row: {
          ciclo_id: string
          data_pagamento: string
          forma_pagamento: string | null
          id: string
          observacao: string | null
          registrado_por: string
          representante_id: string
          revendedora_id: string
          valor: number
        }
        Insert: {
          ciclo_id: string
          data_pagamento?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          registrado_por: string
          representante_id: string
          revendedora_id: string
          valor: number
        }
        Update: {
          ciclo_id?: string
          data_pagamento?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          registrado_por?: string
          representante_id?: string
          revendedora_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "t2_adiantamentos_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "t2_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t2_adiantamentos_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_previsao_recebimentos"
            referencedColumns: ["ciclo_id"]
          },
        ]
      }
      t2_apuracoes: {
        Row: {
          apurado_por: string
          ciclo_id: string
          comissao_percentual: number
          data_apuracao: string
          id: string
          saldo_a_receber: number
          status: string
          valor_comissao: number
          valor_devolvido: number
          valor_empresa: number
          valor_kit: number
          valor_vendido: number
        }
        Insert: {
          apurado_por: string
          ciclo_id: string
          comissao_percentual: number
          data_apuracao?: string
          id?: string
          saldo_a_receber: number
          status?: string
          valor_comissao: number
          valor_devolvido: number
          valor_empresa: number
          valor_kit: number
          valor_vendido: number
        }
        Update: {
          apurado_por?: string
          ciclo_id?: string
          comissao_percentual?: number
          data_apuracao?: string
          id?: string
          saldo_a_receber?: number
          status?: string
          valor_comissao?: number
          valor_devolvido?: number
          valor_empresa?: number
          valor_kit?: number
          valor_vendido?: number
        }
        Relationships: [
          {
            foreignKeyName: "t2_apuracoes_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: true
            referencedRelation: "t2_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t2_apuracoes_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: true
            referencedRelation: "t2_vw_previsao_recebimentos"
            referencedColumns: ["ciclo_id"]
          },
        ]
      }
      t2_ciclo_pedidos: {
        Row: {
          ciclo_id: string
          criado_em: string | null
          id: string
          pedido_id: string
        }
        Insert: {
          ciclo_id: string
          criado_em?: string | null
          id?: string
          pedido_id: string
        }
        Update: {
          ciclo_id?: string
          criado_em?: string | null
          id?: string
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "t2_ciclo_pedidos_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "t2_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t2_ciclo_pedidos_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_previsao_recebimentos"
            referencedColumns: ["ciclo_id"]
          },
          {
            foreignKeyName: "t2_ciclo_pedidos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "t2_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      t2_ciclos: {
        Row: {
          comissao_percentual: number | null
          data_cobranca: string | null
          data_inicio: string
          data_vencimento: string
          id: string
          pedido_id: string | null
          representante_id: string
          revendedora_id: string
          status: string
          valor_empresa: number | null
          valor_kit: number
          valor_pago: number
          valor_restante: number | null
          valor_vendido: number | null
        }
        Insert: {
          comissao_percentual?: number | null
          data_cobranca?: string | null
          data_inicio?: string
          data_vencimento: string
          id?: string
          pedido_id?: string | null
          representante_id: string
          revendedora_id: string
          status?: string
          valor_empresa?: number | null
          valor_kit: number
          valor_pago?: number
          valor_restante?: number | null
          valor_vendido?: number | null
        }
        Update: {
          comissao_percentual?: number | null
          data_cobranca?: string | null
          data_inicio?: string
          data_vencimento?: string
          id?: string
          pedido_id?: string | null
          representante_id?: string
          revendedora_id?: string
          status?: string
          valor_empresa?: number | null
          valor_kit?: number
          valor_pago?: number
          valor_restante?: number | null
          valor_vendido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t2_ciclos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "t2_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t2_ciclos_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "t2_revendedoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t2_ciclos_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_historico_revendedoras"
            referencedColumns: ["revendedora_id"]
          },
          {
            foreignKeyName: "t2_ciclos_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_radar_revendedoras"
            referencedColumns: ["revendedora_id"]
          },
          {
            foreignKeyName: "t2_ciclos_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_ranking_revendedoras"
            referencedColumns: ["revendedora_id"]
          },
        ]
      }
      t2_interacoes: {
        Row: {
          ciclo_id: string
          created_at: string | null
          id: string
          observacao: string
          registrado_por: string
        }
        Insert: {
          ciclo_id: string
          created_at?: string | null
          id?: string
          observacao: string
          registrado_por: string
        }
        Update: {
          ciclo_id?: string
          created_at?: string | null
          id?: string
          observacao?: string
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "t2_interacoes_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "t2_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t2_interacoes_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_previsao_recebimentos"
            referencedColumns: ["ciclo_id"]
          },
        ]
      }
      t2_pagamentos: {
        Row: {
          apuracao_id: string
          data_pagamento: string
          forma_pagamento: string | null
          id: string
          observacao: string | null
          registrado_por: string
          valor_pago: number
        }
        Insert: {
          apuracao_id: string
          data_pagamento?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          registrado_por: string
          valor_pago: number
        }
        Update: {
          apuracao_id?: string
          data_pagamento?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          registrado_por?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "t2_pagamentos_apuracao_id_fkey"
            columns: ["apuracao_id"]
            isOneToOne: false
            referencedRelation: "t2_apuracoes"
            referencedColumns: ["id"]
          },
        ]
      }
      t2_pedidos: {
        Row: {
          codigo_pedido: string
          data_criacao: string
          id: string
          observacao: string | null
          representante_id: string | null
          status: string
          valor_total: number
        }
        Insert: {
          codigo_pedido: string
          data_criacao?: string
          id?: string
          observacao?: string | null
          representante_id?: string | null
          status?: string
          valor_total: number
        }
        Update: {
          codigo_pedido?: string
          data_criacao?: string
          id?: string
          observacao?: string | null
          representante_id?: string | null
          status?: string
          valor_total?: number
        }
        Relationships: []
      }
      t2_revendedoras: {
        Row: {
          categoria_atual: string | null
          cidade: string | null
          cpf: string
          data_cadastro: string
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          id: string
          instagram: string | null
          nome_completo: string
          nome_exibicao: string | null
          representante_id: string | null
          score: number
          status: string
          telefone: string
        }
        Insert: {
          categoria_atual?: string | null
          cidade?: string | null
          cpf: string
          data_cadastro?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          instagram?: string | null
          nome_completo: string
          nome_exibicao?: string | null
          representante_id?: string | null
          score?: number
          status?: string
          telefone: string
        }
        Update: {
          categoria_atual?: string | null
          cidade?: string | null
          cpf?: string
          data_cadastro?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          instagram?: string | null
          nome_completo?: string
          nome_exibicao?: string | null
          representante_id?: string | null
          score?: number
          status?: string
          telefone?: string
        }
        Relationships: []
      }
      user_menu_permissions: {
        Row: {
          created_at: string | null
          id: string
          menu_key: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          menu_key: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          menu_key?: string
          user_id?: string
        }
        Relationships: []
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
      vendedoras: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_limited: {
        Row: {
          ativo: boolean | null
          avatar_url: string | null
          criado_em: string | null
          habilitar_cobranca_diaria: boolean | null
          habilitar_dashboard: boolean | null
          habilitar_kanban: boolean | null
          id: string | null
          idioma: string | null
          nome: string | null
          tema: string | null
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          criado_em?: string | null
          habilitar_cobranca_diaria?: boolean | null
          habilitar_dashboard?: boolean | null
          habilitar_kanban?: boolean | null
          id?: string | null
          idioma?: string | null
          nome?: string | null
          tema?: string | null
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          criado_em?: string | null
          habilitar_cobranca_diaria?: boolean | null
          habilitar_dashboard?: boolean | null
          habilitar_kanban?: boolean | null
          id?: string | null
          idioma?: string | null
          nome?: string | null
          tema?: string | null
        }
        Relationships: []
      }
      t2_vw_historico_revendedoras: {
        Row: {
          categoria_atual: string | null
          cidade: string | null
          data_primeiro_ciclo: string | null
          data_ultimo_ciclo: string | null
          nome_revendedora: string | null
          representante_id: string | null
          revendedora_id: string | null
          score: number | null
          ticket_medio: number | null
          total_ciclos: number | null
          total_pago_empresa: number | null
          total_vendido: number | null
        }
        Relationships: []
      }
      t2_vw_performance_representantes: {
        Row: {
          inadimplencia_total: number | null
          representante_id: string | null
          revendedoras_atencao: number | null
          revendedoras_ativas: number | null
          revendedoras_em_risco: number | null
          ticket_medio: number | null
          total_ciclos: number | null
          total_recebido_empresa: number | null
          total_revendedoras: number | null
          total_vendido: number | null
        }
        Relationships: []
      }
      t2_vw_previsao_recebimentos: {
        Row: {
          ciclo_id: string | null
          cidade: string | null
          data_vencimento: string | null
          nome_revendedora: string | null
          representante_id: string | null
          revendedora_id: string | null
          saldo_restante: number | null
          status_ciclo: string | null
          status_financeiro: string | null
          valor_empresa: number | null
          valor_pago: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t2_ciclos_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "t2_revendedoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t2_ciclos_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_historico_revendedoras"
            referencedColumns: ["revendedora_id"]
          },
          {
            foreignKeyName: "t2_ciclos_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_radar_revendedoras"
            referencedColumns: ["revendedora_id"]
          },
          {
            foreignKeyName: "t2_ciclos_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "t2_vw_ranking_revendedoras"
            referencedColumns: ["revendedora_id"]
          },
        ]
      }
      t2_vw_radar_revendedoras: {
        Row: {
          categoria_atual: string | null
          cidade: string | null
          dias_sem_vender: number | null
          nome_revendedora: string | null
          representante_id: string | null
          revendedora_id: string | null
          score: number | null
          status_radar: string | null
          total_ciclos: number | null
          total_vendido: number | null
          ultimo_ciclo_data: string | null
        }
        Relationships: []
      }
      t2_vw_ranking_representantes: {
        Row: {
          inadimplencia_total: number | null
          representante_id: string | null
          revendedoras_ativas: number | null
          ticket_medio: number | null
          total_ciclos: number | null
          total_vendido: number | null
        }
        Relationships: []
      }
      t2_vw_ranking_revendedoras: {
        Row: {
          categoria_atual: string | null
          cidade: string | null
          nome_revendedora: string | null
          representante_id: string | null
          revendedora_id: string | null
          score: number | null
          total_ciclos: number | null
          total_vendido: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      atualizar_status_kit_entrega: {
        Args: { p_kit_id: string; p_user_id: string }
        Returns: boolean
      }
      delete_lead_with_history: { Args: { p_lead_id: string }; Returns: Json }
      entregar_kit_para_revendedora: {
        Args: {
          p_data_vencimento: string
          p_kit_id: string
          p_revendedora: string
          p_user_id: string
          p_vendedora_id?: string
          p_vendedora_nome?: string
        }
        Returns: Json
      }
      get_valor_original_kit: {
        Args: { p_kit_entregue_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      registrar_acrescimo_pedido: {
        Args: {
          p_data_vencimento?: string
          p_descricao?: string
          p_kit_entregue_id: string
          p_revendedora: string
          p_user_id: string
          p_valor: number
        }
        Returns: Json
      }
      reverter_entrega_kit: {
        Args: { p_codigo_kit: string; p_user_id: string }
        Returns: boolean
      }
      reverter_entrega_kit_atomico: {
        Args: { p_kit_entregue_id: string; p_user_id: string }
        Returns: Json
      }
      t2_cancelar_apuracao: { Args: { p_ciclo_id: string }; Returns: Json }
      t2_reverter_ciclo_desistencia: {
        Args: { p_ciclo_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "representante" | "producao"
      forma_pagamento: "pix" | "dinheiro" | "cartao" | "transferencia"
      status_cobranca:
        | "pendente"
        | "pago"
        | "parcial"
        | "reagendado"
        | "juridico"
        | "cancelado"
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
      status_cobranca: [
        "pendente",
        "pago",
        "parcial",
        "reagendado",
        "juridico",
        "cancelado",
      ],
    },
  },
} as const
