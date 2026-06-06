import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, ShieldCheck, Lock } from "lucide-react";

export function ConfigurarPin() {
  const { user, profile } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [temPin, setTemPin] = useState<boolean | null>(null);
  const [pinAtual, setPinAtual] = useState("");
  const [novoPin, setNovoPin] = useState("");
  const [confirmaPin, setConfirmaPin] = useState("");
  const [carregando, setCarregando] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!user || !isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("pin_apuracao")
        .eq("id", user.id)
        .maybeSingle();
      setTemPin(!!(data as any)?.pin_apuracao);
    })();
  }, [user, isAdmin, carregando]);

  if (!isAdmin) return null;

  const validarFormato = (pin: string) => /^[0-9]{6}$/.test(pin);

  const handleSubmit = async () => {
    if (!validarFormato(novoPin)) {
      toast({ title: "PIN inválido", description: "Deve conter exatamente 6 dígitos numéricos.", variant: "destructive" });
      return;
    }
    if (novoPin !== confirmaPin) {
      toast({ title: "PINs não conferem", variant: "destructive" });
      return;
    }
    setCarregando(true);
    try {
      if (temPin) {
        if (!validarFormato(pinAtual)) {
          toast({ title: "PIN atual inválido", variant: "destructive" });
          setCarregando(false);
          return;
        }
        const { data: ok, error: errVerif } = await supabase.rpc("verificar_pin_apuracao", { p_pin: pinAtual });
        if (errVerif) throw errVerif;
        if (!ok) {
          toast({ title: "PIN atual incorreto", variant: "destructive" });
          setCarregando(false);
          return;
        }
      }
      const { error } = await supabase.rpc("definir_pin_apuracao", { p_pin: novoPin });
      if (error) throw error;
      toast({ title: temPin ? "PIN alterado com sucesso" : "PIN definido com sucesso" });
      setPinAtual("");
      setNovoPin("");
      setConfirmaPin("");
      setTemPin(true);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha ao salvar PIN", variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Card>
      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                🔐 PIN de Segurança
                {temPin === false && (
                  <span className="text-xs font-normal text-amber-500">(não configurado)</span>
                )}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> PIN de 6 dígitos exigido para confirmar Apuração Rápida.
            </p>
            {temPin && (
              <div className="space-y-1.5">
                <Label htmlFor="pin-atual">PIN Atual</Label>
                <Input
                  id="pin-atual"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinAtual}
                  onChange={(e) => setPinAtual(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="novo-pin">Novo PIN</Label>
              <Input
                id="novo-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={novoPin}
                onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ""))}
                placeholder="6 dígitos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirma-pin">Confirmar PIN</Label>
              <Input
                id="confirma-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmaPin}
                onChange={(e) => setConfirmaPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Repita o PIN"
              />
            </div>
            <Button onClick={handleSubmit} disabled={carregando} className="w-full">
              {carregando ? "Salvando..." : temPin ? "Alterar PIN" : "Definir PIN"}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
