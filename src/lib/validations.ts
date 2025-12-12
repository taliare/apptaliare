import { z } from 'zod';

// ============ Common Validators ============

// Monetary value validator - must be positive and not exceed reasonable limits
const monetaryValueSchema = z.number()
  .min(0, 'Valor não pode ser negativo')
  .max(9999999.99, 'Valor excede o limite máximo');

// Date string validator (YYYY-MM-DD format)
const dateStringSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Data inválida');

// UUID validator
const uuidSchema = z.string().uuid('ID inválido');

// Text field validators with length limits
const shortTextSchema = z.string().trim().max(100, 'Texto muito longo (máximo 100 caracteres)');
const mediumTextSchema = z.string().trim().max(255, 'Texto muito longo (máximo 255 caracteres)');
const longTextSchema = z.string().trim().max(1000, 'Texto muito longo (máximo 1000 caracteres)');

// ============ Cobrança Schemas ============

export const cobrancaInsertSchema = z.object({
  revendedora: shortTextSchema.min(1, 'Nome da revendedora é obrigatório'),
  codigo_nota: shortTextSchema.nullable().optional(),
  tipo: shortTextSchema.nullable().optional(),
  valor_previsto: monetaryValueSchema,
  data_agendada: dateStringSchema,
  observacoes: longTextSchema.nullable().optional(),
  representante_id: uuidSchema,
  status: z.enum(['pendente', 'pago', 'parcial', 'reagendado', 'juridico']).default('pendente'),
  vendedora: shortTextSchema.nullable().optional(),
  vendedora_id: uuidSchema.nullable().optional(),
  valor_adiantado: monetaryValueSchema.nullable().optional(),
});

export const cobrancaUpdateSchema = cobrancaInsertSchema.partial().omit({ representante_id: true });

// ============ Nota Promissória Schemas ============

export const notaPromissoriaInsertSchema = z.object({
  representante_id: uuidSchema,
  codigo_nota: shortTextSchema.min(1, 'Código da nota é obrigatório'),
  data: dateStringSchema,
  valor_total: monetaryValueSchema.min(0.01, 'Valor total deve ser maior que zero'),
  forma_pagamento_1: z.enum(['pix', 'dinheiro', 'cartao', 'transferencia']),
  valor_pagamento_1: monetaryValueSchema,
  forma_pagamento_2: z.enum(['pix', 'dinheiro', 'cartao', 'transferencia']).nullable().optional(),
  valor_pagamento_2: monetaryValueSchema.nullable().optional(),
});

export const notaPromissoriaUpdateSchema = notaPromissoriaInsertSchema.partial().omit({ representante_id: true });

// ============ Prestação de Contas Schemas ============

export const prestacaoContasInsertSchema = z.object({
  cobranca_id: uuidSchema.nullable().optional(),
  representante_id: uuidSchema,
  revendedora: shortTextSchema.min(1, 'Nome da revendedora é obrigatório'),
  total_venda: monetaryValueSchema,
  comissao_percentual: z.number().min(0).max(100, 'Percentual deve estar entre 0 e 100'),
  comissao_valor: monetaryValueSchema,
  valor_devido_empresa: monetaryValueSchema,
  valor_pago: monetaryValueSchema,
  saldo_devedor: monetaryValueSchema.nullable().optional(),
  forma_pagamento: z.enum(['pix', 'dinheiro', 'cartao', 'transferencia']),
  data_execucao: dateStringSchema,
  codigo_mostruario: shortTextSchema.nullable().optional(),
  data_vencimento_mostruario: dateStringSchema.nullable().optional(),
  houve_renovacao: z.boolean().nullable().optional(),
  codigo_nota_referencia: shortTextSchema.nullable().optional(),
});

// ============ Cobrança Diária Schemas ============

export const cobrancaDiariaInsertSchema = z.object({
  representante_id: uuidSchema,
  data: dateStringSchema,
  total_cobrado: monetaryValueSchema,
  total_pix: monetaryValueSchema.nullable().optional(),
  total_dinheiro: monetaryValueSchema.nullable().optional(),
  total_cartao: monetaryValueSchema.nullable().optional(),
  despesa_cobranca: monetaryValueSchema.nullable().optional(),
  finalizado: z.boolean().default(false),
});

export const cobrancaDiariaUpdateSchema = cobrancaDiariaInsertSchema.partial().omit({ representante_id: true });

// ============ Repasse Schemas ============

export const repasseInsertSchema = z.object({
  cobranca_id: uuidSchema,
  valor_repasse: monetaryValueSchema.min(0.01, 'Valor do repasse deve ser maior que zero'),
  data_repasse: dateStringSchema,
  status: z.enum(['agendado', 'pago', 'cancelado']).default('agendado'),
});

// ============ Kit Entregue Schemas ============

export const kitEntregueInsertSchema = z.object({
  representante_id: uuidSchema,
  codigo_mostruario: shortTextSchema.min(1, 'Código do mostruário é obrigatório'),
  tipo: shortTextSchema.nullable().optional(),
  data_entrega: dateStringSchema,
  data_vencimento: dateStringSchema,
  prestacao_id: uuidSchema.nullable().optional(),
});

// ============ Profile/User Schemas ============

export const emailSchema = z.string()
  .trim()
  .email('Email inválido')
  .max(255, 'Email muito longo');

export const passwordSchema = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(100, 'Senha muito longa')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número');

export const userCreateSchema = z.object({
  nome: shortTextSchema.min(1, 'Nome é obrigatório'),
  email: emailSchema,
  senha: passwordSchema,
  role: z.enum(['admin', 'representante', 'producao']).default('representante'),
});

export const userUpdateSchema = z.object({
  nome: shortTextSchema.min(1, 'Nome é obrigatório'),
  email: emailSchema.optional(),
  role: z.enum(['admin', 'representante', 'producao']).optional(),
  ativo: z.boolean().optional(),
  habilitar_dashboard: z.boolean().optional(),
  habilitar_kanban: z.boolean().optional(),
  habilitar_cobranca_diaria: z.boolean().optional(),
});

// ============ Validation Helper ============

/**
 * Validates data against a Zod schema and returns the result
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns { success: true, data: T } | { success: false, errors: string[] }
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => 
    `${err.path.join('.')}: ${err.message}`
  );
  
  return { success: false, errors };
}

/**
 * Sanitizes a string to prevent XSS attacks
 * Removes or encodes potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Parses and validates a monetary value from string input
 * Returns the numeric value or null if invalid
 */
export function parseMonetaryValue(value: string): number | null {
  if (!value) return null;
  
  const numeros = value.replace(/\D/g, '');
  if (!numeros) return null;
  
  const numero = parseFloat(numeros) / 100;
  
  if (isNaN(numero) || numero < 0 || numero > 9999999.99) {
    return null;
  }
  
  return numero;
}
