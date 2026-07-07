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
          apurado: boolean | null
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
          valor_kit_original: number | null
          valor_pago_acumulado: number | null
          valor_previsto: number
          vendedora: string | null
          vendedora_id: string | null
          vigente: boolean
        }
        Insert: {
          apurado?: boolean | null
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
          valor_kit_original?: number | null
          valor_pago_acumulado?: number | null
          valor_previsto: number
          vendedora?: string | null
          vendedora_id?: string | null
          vigente?: boolean
        }
        Update: {
          apurado?: boolean | null
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
          valor_kit_original?: number | null
          valor_pago_acumulado?: number | null
          valor_previsto?: number
          vendedora?: string | null
          vendedora_id?: string | null
          vigente?: boolean
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
      contas_bancarias: {
        Row: {
          ativo: boolean
          banco: string | null
          criado_em: string
          id: string
          nome: string
          saldo_inicial: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          criado_em?: string
          id?: string
          nome: string
          saldo_inicial?: number
          tipo?: string
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          criado_em?: string
          id?: string
          nome?: string
          saldo_inicial?: number
          tipo?: string
        }
        Relationships: []
      }
      despesas_fechamento: {
        Row: {
          categoria_id: string | null
          conciliado: boolean
          criado_em: string
          descricao: string
          despesa_id: string | null
          fechamento_id: string
          id: string
          representante_id: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          conciliado?: boolean
          criado_em?: string
          descricao: string
          despesa_id?: string | null
          fechamento_id: string
          id?: string
          representante_id: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          conciliado?: boolean
          criado_em?: string
          descricao?: string
          despesa_id?: string | null
          fechamento_id?: string
          id?: string
          representante_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_fechamento_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "dre_categorias_despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_fechamento_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "dre_despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_fechamento_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_diarias"
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
          acrescimo: number | null
          ano_mes: string
          atualizado_em: string | null
          categoria_id: string | null
          contato: string | null
          criado_em: string | null
          criado_por: string | null
          data_despesa: string | null
          data_limite_recorrencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          desconto: number | null
          descricao: string | null
          dia_semana: string | null
          dia_vencimento_mensal: number | null
          forma_pagamento: string | null
          id: string
          numero_parcelas: number | null
          observacao: string | null
          ocorrencia: string
          parcela_atual: number | null
          status: string | null
          status_pagamento: string
          valor: number
        }
        Insert: {
          acrescimo?: number | null
          ano_mes: string
          atualizado_em?: string | null
          categoria_id?: string | null
          contato?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_despesa?: string | null
          data_limite_recorrencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          desconto?: number | null
          descricao?: string | null
          dia_semana?: string | null
          dia_vencimento_mensal?: number | null
          forma_pagamento?: string | null
          id?: string
          numero_parcelas?: number | null
          observacao?: string | null
          ocorrencia?: string
          parcela_atual?: number | null
          status?: string | null
          status_pagamento?: string
          valor: number
        }
        Update: {
          acrescimo?: number | null
          ano_mes?: string
          atualizado_em?: string | null
          categoria_id?: string | null
          contato?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_despesa?: string | null
          data_limite_recorrencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          desconto?: number | null
          descricao?: string | null
          dia_semana?: string | null
          dia_vencimento_mensal?: number | null
          forma_pagamento?: string | null
          id?: string
          numero_parcelas?: number | null
          observacao?: string | null
          ocorrencia?: string
          parcela_atual?: number | null
          status?: string | null
          status_pagamento?: string
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
      juridico_bloqueados: {
        Row: {
          cpf: string | null
          criado_em: string | null
          id: string
          nome_norm: string
          origem: string | null
        }
        Insert: {
          cpf?: string | null
          criado_em?: string | null
          id?: string
          nome_norm: string
          origem?: string | null
        }
        Update: {
          cpf?: string | null
          criado_em?: string | null
          id?: string
          nome_norm?: string
          origem?: string | null
        }
        Relationships: []
      }
      kit_adicionais_itens: {
        Row: {
          codigo_barras: string | null
          criado_em: string | null
          criado_por: string | null
          descricao: string
          id: string
          kit_entregue_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          representante_id: string
          revendedora: string
        }
        Insert: {
          codigo_barras?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao: string
          id?: string
          kit_entregue_id: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          representante_id: string
          revendedora: string
        }
        Update: {
          codigo_barras?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string
          id?: string
          kit_entregue_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          representante_id?: string
          revendedora?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_adicionais_itens_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_adicionais_itens_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_adicionais_itens_kit_entregue_id_fkey"
            columns: ["kit_entregue_id"]
            isOneToOne: false
            referencedRelation: "kits_entregues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_adicionais_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_adicionais_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_adicionais_itens_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_adicionais_itens_representante_id_fkey"
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
          montagem_id: string | null
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
          montagem_id?: string | null
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
          montagem_id?: string | null
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
            foreignKeyName: "kits_estoque_montagem_id_fkey"
            columns: ["montagem_id"]
            isOneToOne: false
            referencedRelation: "kits_montagem"
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
      kits_montagem: {
        Row: {
          criado_em: string
          criado_por: string | null
          descricao: string | null
          finalizado_em: string | null
          id: string
          numero: string
          pdf_detalhado_url: string | null
          pdf_resumido_url: string | null
          status: string
          total_pecas: number
          valor_custo: number
          valor_varejo: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          finalizado_em?: string | null
          id?: string
          numero: string
          pdf_detalhado_url?: string | null
          pdf_resumido_url?: string | null
          status?: string
          total_pecas?: number
          valor_custo?: number
          valor_varejo?: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          finalizado_em?: string | null
          id?: string
          numero?: string
          pdf_detalhado_url?: string | null
          pdf_resumido_url?: string | null
          status?: string
          total_pecas?: number
          valor_custo?: number
          valor_varejo?: number
        }
        Relationships: []
      }
      kits_montagem_itens: {
        Row: {
          categoria_snapshot: string | null
          codigo_barras: string
          criado_em: string
          custo_snapshot: number
          descricao_snapshot: string | null
          foto_snapshot: string | null
          id: string
          kit_id: string
          preco_snapshot: number
          produto_id: string | null
          quantidade: number
        }
        Insert: {
          categoria_snapshot?: string | null
          codigo_barras: string
          criado_em?: string
          custo_snapshot?: number
          descricao_snapshot?: string | null
          foto_snapshot?: string | null
          id?: string
          kit_id: string
          preco_snapshot?: number
          produto_id?: string | null
          quantidade?: number
        }
        Update: {
          categoria_snapshot?: string | null
          codigo_barras?: string
          criado_em?: string
          custo_snapshot?: number
          descricao_snapshot?: string | null
          foto_snapshot?: string | null
          id?: string
          kit_id?: string
          preco_snapshot?: number
          produto_id?: string | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "kits_montagem_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits_montagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_montagem_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_montagem_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo_publico"
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
          status_updated_at: string
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
          status_updated_at?: string
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
          status_updated_at?: string
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
          status_no_pagamento: string | null
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
          status_no_pagamento?: string | null
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
          status_no_pagamento?: string | null
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
      pagamentos_historico: {
        Row: {
          cobranca_id: string
          criado_em: string | null
          data_pagamento: string
          id: string
          representante_id: string
          valor: number
        }
        Insert: {
          cobranca_id: string
          criado_em?: string | null
          data_pagamento?: string
          id?: string
          representante_id: string
          valor: number
        }
        Update: {
          cobranca_id?: string
          criado_em?: string | null
          data_pagamento?: string
          id?: string
          representante_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_historico_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_agendadas"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_config: {
        Row: {
          atualizado_em: string | null
          cep: string | null
          cnpj: string | null
          criado_em: string | null
          endereco: string | null
          id: string
          imprimir_detalhado: boolean | null
          imprimir_resumido: boolean | null
          logo_url: string | null
          mais_informacoes: string | null
          nome_empresa: string | null
          tabela_comissao: string | null
          telefone: string | null
          termo_garantia: string | null
          termo_ordem_servico: string | null
          termo_pedido: string | null
          termo_promissoria: string | null
          termo_revendedor: string | null
          termo_venda: string | null
        }
        Insert: {
          atualizado_em?: string | null
          cep?: string | null
          cnpj?: string | null
          criado_em?: string | null
          endereco?: string | null
          id?: string
          imprimir_detalhado?: boolean | null
          imprimir_resumido?: boolean | null
          logo_url?: string | null
          mais_informacoes?: string | null
          nome_empresa?: string | null
          tabela_comissao?: string | null
          telefone?: string | null
          termo_garantia?: string | null
          termo_ordem_servico?: string | null
          termo_pedido?: string | null
          termo_promissoria?: string | null
          termo_revendedor?: string | null
          termo_venda?: string | null
        }
        Update: {
          atualizado_em?: string | null
          cep?: string | null
          cnpj?: string | null
          criado_em?: string | null
          endereco?: string | null
          id?: string
          imprimir_detalhado?: boolean | null
          imprimir_resumido?: boolean | null
          logo_url?: string | null
          mais_informacoes?: string | null
          nome_empresa?: string | null
          tabela_comissao?: string | null
          telefone?: string | null
          termo_garantia?: string | null
          termo_ordem_servico?: string | null
          termo_pedido?: string | null
          termo_promissoria?: string | null
          termo_revendedor?: string | null
          termo_venda?: string | null
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
          valor_devolvido: number
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
          valor_devolvido?: number
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
          valor_devolvido?: number
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
      produtos_catalogo: {
        Row: {
          ativo: boolean
          atualizado_em: string
          banho_ouro: number | null
          banho_prata: number | null
          banho_rodio: number | null
          banho_verniz: number | null
          categoria: string | null
          cfop: string | null
          codigo_barras: string
          codigo_barras_fornecedor: string | null
          cor: string | null
          criado_em: string
          custo_compra_bruto: number | null
          custo_insumos: number | null
          descricao: string
          estoque_maximo: number | null
          estoque_minimo: number | null
          fcp_percentual: number | null
          fornecedor: string | null
          foto_url: string | null
          fotos_adicionais: string[] | null
          id: string
          imposto: string | null
          localizacao: string | null
          lucro_varejo_percentual: number | null
          numero_ean: string | null
          numero_ncm: string | null
          observacao: string | null
          preco_custo: number
          preco_varejo: number
          qtd_cancelado: number | null
          qtd_consignado: number | null
          qtd_estoque: number | null
          qtd_pendente: number | null
          qtd_perdido: number | null
          qtd_vendido: number | null
          referencia: string | null
          subcategoria: string | null
          tamanho: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          banho_ouro?: number | null
          banho_prata?: number | null
          banho_rodio?: number | null
          banho_verniz?: number | null
          categoria?: string | null
          cfop?: string | null
          codigo_barras: string
          codigo_barras_fornecedor?: string | null
          cor?: string | null
          criado_em?: string
          custo_compra_bruto?: number | null
          custo_insumos?: number | null
          descricao: string
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          fcp_percentual?: number | null
          fornecedor?: string | null
          foto_url?: string | null
          fotos_adicionais?: string[] | null
          id?: string
          imposto?: string | null
          localizacao?: string | null
          lucro_varejo_percentual?: number | null
          numero_ean?: string | null
          numero_ncm?: string | null
          observacao?: string | null
          preco_custo?: number
          preco_varejo?: number
          qtd_cancelado?: number | null
          qtd_consignado?: number | null
          qtd_estoque?: number | null
          qtd_pendente?: number | null
          qtd_perdido?: number | null
          qtd_vendido?: number | null
          referencia?: string | null
          subcategoria?: string | null
          tamanho?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          banho_ouro?: number | null
          banho_prata?: number | null
          banho_rodio?: number | null
          banho_verniz?: number | null
          categoria?: string | null
          cfop?: string | null
          codigo_barras?: string
          codigo_barras_fornecedor?: string | null
          cor?: string | null
          criado_em?: string
          custo_compra_bruto?: number | null
          custo_insumos?: number | null
          descricao?: string
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          fcp_percentual?: number | null
          fornecedor?: string | null
          foto_url?: string | null
          fotos_adicionais?: string[] | null
          id?: string
          imposto?: string | null
          localizacao?: string | null
          lucro_varejo_percentual?: number | null
          numero_ean?: string | null
          numero_ncm?: string | null
          observacao?: string | null
          preco_custo?: number
          preco_varejo?: number
          qtd_cancelado?: number | null
          qtd_consignado?: number | null
          qtd_estoque?: number | null
          qtd_pendente?: number | null
          qtd_perdido?: number | null
          qtd_vendido?: number | null
          referencia?: string | null
          subcategoria?: string | null
          tamanho?: string | null
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
          departamento: string | null
          email: string | null
          habilitar_cobranca_diaria: boolean | null
          habilitar_dashboard: boolean | null
          habilitar_kanban: boolean | null
          id: string
          idioma: string | null
          nome: string
          permissoes_customizadas: boolean
          pin_apuracao: string | null
          tema: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          criado_em?: string | null
          departamento?: string | null
          email?: string | null
          habilitar_cobranca_diaria?: boolean | null
          habilitar_dashboard?: boolean | null
          habilitar_kanban?: boolean | null
          id: string
          idioma?: string | null
          nome: string
          permissoes_customizadas?: boolean
          pin_apuracao?: string | null
          tema?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          criado_em?: string | null
          departamento?: string | null
          email?: string | null
          habilitar_cobranca_diaria?: boolean | null
          habilitar_dashboard?: boolean | null
          habilitar_kanban?: boolean | null
          id?: string
          idioma?: string | null
          nome?: string
          permissoes_customizadas?: boolean
          pin_apuracao?: string | null
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
      reagendamentos_historico: {
        Row: {
          cobranca_id: string
          criado_em: string
          data_anterior: string | null
          data_nova: string | null
          id: string
          nome_usuario: string | null
          representante_id: string | null
          usuario_id: string | null
        }
        Insert: {
          cobranca_id: string
          criado_em?: string
          data_anterior?: string | null
          data_nova?: string | null
          id?: string
          nome_usuario?: string | null
          representante_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          cobranca_id?: string
          criado_em?: string
          data_anterior?: string | null
          data_nova?: string | null
          id?: string
          nome_usuario?: string | null
          representante_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reagendamentos_historico_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_agendadas"
            referencedColumns: ["id"]
          },
        ]
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
          aprovado_por: string | null
          ativo: boolean
          atualizado_em: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          criado_em: string | null
          data_aprovacao_juridico: string | null
          data_nascimento: string | null
          data_solicitacao_juridico: string | null
          email: string | null
          estado: string | null
          estado_civil: string | null
          foto_url: string | null
          genero: string | null
          geocoded_at: string | null
          id: string
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          motivo_juridico: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          perfil_garantia_id: string | null
          representante_id: string | null
          rg: string | null
          status_juridico: string | null
          telefone_alternativo: string | null
          ultima_atividade: string | null
          whatsapp: string | null
        }
        Insert: {
          aprovado_por?: string | null
          ativo?: boolean
          atualizado_em?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          criado_em?: string | null
          data_aprovacao_juridico?: string | null
          data_nascimento?: string | null
          data_solicitacao_juridico?: string | null
          email?: string | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          genero?: string | null
          geocoded_at?: string | null
          id?: string
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          motivo_juridico?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          perfil_garantia_id?: string | null
          representante_id?: string | null
          rg?: string | null
          status_juridico?: string | null
          telefone_alternativo?: string | null
          ultima_atividade?: string | null
          whatsapp?: string | null
        }
        Update: {
          aprovado_por?: string | null
          ativo?: boolean
          atualizado_em?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          criado_em?: string | null
          data_aprovacao_juridico?: string | null
          data_nascimento?: string | null
          data_solicitacao_juridico?: string | null
          email?: string | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          genero?: string | null
          geocoded_at?: string | null
          id?: string
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          motivo_juridico?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          perfil_garantia_id?: string | null
          representante_id?: string | null
          rg?: string | null
          status_juridico?: string | null
          telefone_alternativo?: string | null
          ultima_atividade?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      revendedoras_audit: {
        Row: {
          acao: string
          campos_alterados: Json
          criado_em: string
          id: string
          revendedora_id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          campos_alterados?: Json
          criado_em?: string
          id?: string
          revendedora_id: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          campos_alterados?: Json
          criado_em?: string
          id?: string
          revendedora_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revendedoras_audit_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "revendedoras"
            referencedColumns: ["id"]
          },
        ]
      }
      revendedoras_referencias: {
        Row: {
          criado_em: string | null
          id: string
          nome: string
          revendedora_id: string
          telefone: string | null
          vinculo: string | null
        }
        Insert: {
          criado_em?: string | null
          id?: string
          nome: string
          revendedora_id: string
          telefone?: string | null
          vinculo?: string | null
        }
        Update: {
          criado_em?: string | null
          id?: string
          nome?: string
          revendedora_id?: string
          telefone?: string | null
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revendedoras_referencias_revendedora_id_fkey"
            columns: ["revendedora_id"]
            isOneToOne: false
            referencedRelation: "revendedoras"
            referencedColumns: ["id"]
          },
        ]
      }
      role_menu_permissions: {
        Row: {
          criado_em: string
          menu_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          criado_em?: string
          menu_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          criado_em?: string
          menu_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      transacoes_bancarias: {
        Row: {
          categoria_id: string | null
          conta_id: string
          criado_em: string
          data_transacao: string
          descricao: string | null
          despesa_id: string | null
          id: string
          id_externo: string | null
          memo_ofx: string | null
          name_ofx: string | null
          observacao: string | null
          status_conciliacao: string
          tipo: string
          trntype: string | null
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          conta_id: string
          criado_em?: string
          data_transacao: string
          descricao?: string | null
          despesa_id?: string | null
          id?: string
          id_externo?: string | null
          memo_ofx?: string | null
          name_ofx?: string | null
          observacao?: string | null
          status_conciliacao?: string
          tipo: string
          trntype?: string | null
          valor: number
        }
        Update: {
          categoria_id?: string | null
          conta_id?: string
          criado_em?: string
          data_transacao?: string
          descricao?: string | null
          despesa_id?: string | null
          id?: string
          id_externo?: string | null
          memo_ofx?: string | null
          name_ofx?: string | null
          observacao?: string | null
          status_conciliacao?: string
          tipo?: string
          trntype?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_bancarias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "dre_categorias_despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_bancarias_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_bancarias_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "dre_despesas"
            referencedColumns: ["id"]
          },
        ]
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
      produtos_catalogo_publico: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          categoria: string | null
          codigo_barras: string | null
          cor: string | null
          criado_em: string | null
          descricao: string | null
          foto_url: string | null
          fotos_adicionais: string[] | null
          id: string | null
          preco_varejo: number | null
          referencia: string | null
          subcategoria: string | null
          tamanho: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          categoria?: string | null
          codigo_barras?: string | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          foto_url?: string | null
          fotos_adicionais?: string[] | null
          id?: string | null
          preco_varejo?: number | null
          referencia?: string | null
          subcategoria?: string | null
          tamanho?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          categoria?: string | null
          codigo_barras?: string | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          foto_url?: string | null
          fotos_adicionais?: string[] | null
          id?: string | null
          preco_varejo?: number | null
          referencia?: string | null
          subcategoria?: string | null
          tamanho?: string | null
        }
        Relationships: []
      }
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
    }
    Functions: {
      admin_estornar_baixa: {
        Args: { p_id: string; p_valor_original: number }
        Returns: undefined
      }
      aplicar_ajuste_admin: {
        Args: {
          p_admin_id: string
          p_cobranca_id: string
          p_desconto_total?: boolean
          p_motivo?: string
          p_valor_desconto: number
        }
        Returns: Json
      }
      atualizar_status_kit_entrega: {
        Args: { p_kit_id: string; p_user_id: string }
        Returns: boolean
      }
      buscar_revendedora_match: {
        Args: { p_nome: string; p_representante_id: string }
        Returns: {
          aprovado_por: string | null
          ativo: boolean
          atualizado_em: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          criado_em: string | null
          data_aprovacao_juridico: string | null
          data_nascimento: string | null
          data_solicitacao_juridico: string | null
          email: string | null
          estado: string | null
          estado_civil: string | null
          foto_url: string | null
          genero: string | null
          geocoded_at: string | null
          id: string
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          motivo_juridico: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          perfil_garantia_id: string | null
          representante_id: string | null
          rg: string | null
          status_juridico: string | null
          telefone_alternativo: string | null
          ultima_atividade: string | null
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "revendedoras"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      checar_duplicidade_revendedora: {
        Args: {
          p_cpf: string
          p_ignorar_id?: string
          p_nome: string
          p_representante_id: string
          p_whatsapp: string
        }
        Returns: Json
      }
      corrigir_revendedora_da_nota: {
        Args: { p_cobranca_id: string; p_nova_revendedora: string }
        Returns: undefined
      }
      definir_pin_apuracao: { Args: { p_pin: string }; Returns: undefined }
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
      has_menu_access: {
        Args: { _menu_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalcular_cobranca_por_historico: {
        Args: { p_cobranca_id: string }
        Returns: undefined
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
      registrar_pagamento_cobranca:
        | {
            Args: {
              p_cobranca_id: string
              p_codigo_nota_ref: string
              p_comissao_percentual: number
              p_comissao_valor: number
              p_data_agendada?: string
              p_data_execucao: string
              p_data_quitacao?: string
              p_devolveu_tudo?: boolean
              p_forma_pagamento: string
              p_forma_pagamento_1: string
              p_forma_pagamento_2?: string
              p_novo_acumulado?: number
              p_novo_status?: string
              p_novo_valor_previsto?: number
              p_representante_id: string
              p_revendedora: string
              p_saldo_devedor: number
              p_status_no_pagamento?: string
              p_total_venda: number
              p_valor_devido_empresa: number
              p_valor_nota: number
              p_valor_pagamento_1: number
              p_valor_pagamento_2?: number
              p_valor_pago_prestacao: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_cobranca_id: string
              p_codigo_nota_ref: string
              p_comissao_percentual: number
              p_comissao_valor: number
              p_data_agendada?: string
              p_data_execucao: string
              p_data_quitacao?: string
              p_devolveu_tudo?: boolean
              p_forma_pagamento: string
              p_forma_pagamento_1: string
              p_forma_pagamento_2?: string
              p_novo_acumulado?: number
              p_novo_status?: string
              p_novo_valor_previsto?: number
              p_representante_id: string
              p_revendedora: string
              p_saldo_devedor: number
              p_status_no_pagamento?: string
              p_total_venda: number
              p_valor_devido_empresa: number
              p_valor_devolvido?: number
              p_valor_nota: number
              p_valor_pagamento_1: number
              p_valor_pagamento_2?: number
              p_valor_pago_prestacao: number
            }
            Returns: Json
          }
      reverter_entrega_kit:
        | { Args: { p_cobranca_id: string }; Returns: Json }
        | {
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
      transferir_revendedora: {
        Args: { p_novo_representante_id: string; p_revendedora_id: string }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      verificar_bloqueio_juridico: {
        Args: { p_cpf?: string; p_nome: string }
        Returns: {
          blocked: boolean
        }[]
      }
      verificar_pin_apuracao: { Args: { p_pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "representante" | "producao" | "equipe_interna"
      forma_pagamento:
        | "pix"
        | "dinheiro"
        | "cartao"
        | "transferencia"
        | "desconto_admin"
      status_cobranca:
        | "pendente"
        | "parcial"
        | "pago"
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
      app_role: ["admin", "representante", "producao", "equipe_interna"],
      forma_pagamento: [
        "pix",
        "dinheiro",
        "cartao",
        "transferencia",
        "desconto_admin",
      ],
      status_cobranca: ["pendente", "parcial", "pago", "juridico", "cancelado"],
    },
  },
} as const
