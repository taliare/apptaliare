import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, UserPlus, X, Check, Loader2 } from 'lucide-react';

interface Revendedora {
  id: string;
  nome: string;
  whatsapp: string | null;
}

interface RevendedoraSearchSelectProps {
  representanteId: string;
  value: string;
  onSelect: (nome: string) => void;
  placeholder?: string;
}

export function RevendedoraSearchSelect({
  representanteId,
  value,
  onSelect,
  placeholder = 'Digite o nome ou WhatsApp...',
}: RevendedoraSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [results, setResults] = useState<Revendedora[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoWhatsapp, setNovoWhatsapp] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selected, setSelected] = useState(!!value);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setShowCadastro(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync external value changes
  useEffect(() => {
    if (!value) {
      setSearchTerm('');
      setSelected(false);
    }
  }, [value]);

  const searchRevendedoras = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('revendedoras')
        .select('id, nome, whatsapp')
        .eq('representante_id', representanteId)
        .or(`nome.ilike.%${term}%,whatsapp.ilike.%${term}%`)
        .order('nome')
        .limit(10);

      if (error) throw error;
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [representanteId]);

  const handleInputChange = (val: string) => {
    setSearchTerm(val);
    setSelected(false);
    onSelect(''); // Clear selection while typing
    setShowResults(true);
    setShowCadastro(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchRevendedoras(val), 300);
  };

  const handleSelect = (rev: Revendedora) => {
    setSearchTerm(rev.nome);
    setSelected(true);
    setShowResults(false);
    setShowCadastro(false);
    onSelect(rev.nome);
  };

  const handleClear = () => {
    setSearchTerm('');
    setSelected(false);
    setResults([]);
    onSelect('');
  };

  const handleOpenCadastro = () => {
    setNovoNome(searchTerm);
    setNovoWhatsapp('');
    setShowCadastro(true);
    setShowResults(false);
  };

  const handleSaveNova = async () => {
    const nomeTrimmed = novoNome.trim();
    if (!nomeTrimmed) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      // Check for duplicates
      const { data: existing } = await supabase
        .from('revendedoras')
        .select('id, nome')
        .eq('representante_id', representanteId)
        .ilike('nome', nomeTrimmed)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error(`Já existe uma revendedora "${existing[0].nome}" cadastrada`);
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('revendedoras').insert({
        nome: nomeTrimmed,
        whatsapp: novoWhatsapp.trim() || null,
        representante_id: representanteId,
        ativo: true,
      });

      if (error) throw error;

      toast.success('Revendedora cadastrada!');
      setSearchTerm(nomeTrimmed);
      setSelected(true);
      setShowCadastro(false);
      onSelect(nomeTrimmed);
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.error('Revendedora já cadastrada com este nome');
      } else {
        toast.error(`Erro ao cadastrar: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (searchTerm.length >= 2 && !selected) setShowResults(true); }}
          placeholder={placeholder}
          className={`pl-9 pr-9 ${selected ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}
        />
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {selected && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
          <Check className="h-3 w-3" /> Revendedora selecionada
        </p>
      )}

      {/* Results dropdown */}
      {showResults && !selected && searchTerm.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isSearching ? (
            <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
            </div>
          ) : results.length > 0 ? (
            <>
              {results.map((rev) => (
                <button
                  key={rev.id}
                  type="button"
                  onClick={() => handleSelect(rev)}
                  className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-b-0"
                >
                  <span className="font-medium text-sm">{rev.nome}</span>
                  {rev.whatsapp && (
                    <span className="text-xs text-muted-foreground ml-2">📱 {rev.whatsapp}</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={handleOpenCadastro}
                className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors text-primary text-sm font-medium flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" /> Cadastrar Nova Revendedora
              </button>
            </>
          ) : (
            <div className="p-3">
              <p className="text-sm text-muted-foreground mb-2">Nenhuma revendedora encontrada</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenCadastro}
                className="w-full gap-2"
              >
                <UserPlus className="h-4 w-4" /> Cadastrar Nova Revendedora
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Inline registration form */}
      {showCadastro && (
        <div className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Nova Revendedora</span>
            <button type="button" onClick={() => setShowCadastro(false)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div>
            <Label className="text-xs">Nome Completo *</Label>
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Maria Silva"
            />
          </div>
          <div>
            <Label className="text-xs">WhatsApp</Label>
            <Input
              value={novoWhatsapp}
              onChange={(e) => setNovoWhatsapp(e.target.value)}
              placeholder="Ex: (11) 99999-9999"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveNova}
            disabled={isSaving || !novoNome.trim()}
            className="w-full"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            {isSaving ? 'Salvando...' : 'Cadastrar e Selecionar'}
          </Button>
        </div>
      )}
    </div>
  );
}
