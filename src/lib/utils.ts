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
