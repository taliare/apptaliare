import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor numérico para o padrão monetário brasileiro
 * @param valor - Número a ser formatado
 * @returns String formatada como "R$ 1.000,00"
 */
export function formatarValor(valor: number | string | null | undefined): string {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  
  if (num === null || num === undefined || isNaN(num)) {
    return 'R$ 0,00';
  }
  
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formata um número para o padrão brasileiro (sem símbolo monetário)
 * @param valor - Número a ser formatado
 * @returns String formatada como "1.000"
 */
export function formatarNumero(valor: number | string | null | undefined): string {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * Converte uma string de data no formato YYYY-MM-DD para um objeto Date 
 * usando o fuso horário local (evita problema de -1 dia por conversão UTC).
 * @param dateString - Data no formato "YYYY-MM-DD"
 * @returns Objeto Date no fuso horário local
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formata uma data do banco (YYYY-MM-DD) para exibição no formato brasileiro (DD/MM/YYYY)
 * sem problemas de timezone.
 * @param dateString - Data no formato "YYYY-MM-DD"
 * @returns String formatada como "10/12/2025"
 */
export function formatDateBR(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Converte um objeto Date para string no formato YYYY-MM-DD
 * usando o fuso horário LOCAL (não UTC).
 * 
 * IMPORTANTE: Use esta função sempre que precisar salvar uma data no banco!
 * Evita o problema de -1 dia causado por toISOString() que converte para UTC.
 * 
 * @param date - Objeto Date (opcional, default = agora)
 * @returns String no formato "2025-12-20"
 * 
 * @example
 * // Em vez de: new Date().toISOString().split('T')[0]  ❌
 * // Use: getLocalDateString()  ✅
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a data atual no formato YYYY-MM para uso em metas/relatórios
 * @returns String no formato "2025-12"
 */
export function getLocalMonthString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
