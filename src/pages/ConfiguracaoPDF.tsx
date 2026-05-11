import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileText, Save, Upload, Image as ImageIcon } from "lucide-react";

const CONFIG_ID = "00000000-0000-0000-0000-000000000001";

interface PdfConfig {
  id: string;
  nome_empresa: string;
  cnpj: string;
  cep: string;
  endereco: string;
  telefone: string;
  tabela_comissao: string;
  mais_informacoes: string;
  logo_url: string;
  termo_garantia: string;
  termo_promissoria: string;
  termo_pedido: string;
  termo_venda: string;
  termo_ordem_servico: string;
  termo_revendedor: string;
  imprimir_detalhado: boolean;
  imprimir_resumido: boolean;
}

const DEFAULT_CONFIG: PdfConfig = {
  id: CONFIG_ID,
  nome_empresa: "",
  cnpj: "",
  cep: "",
  endereco: "",
  telefone: "",
  tabela_comissao:
    "Até R$299,00 - 20% / Até R$999,00 - 30% / Até R$1.999,00 - 40% / Acima de R$2.000,00 - 50%",
  mais_informacoes: "",
  logo_url: "",
  termo_garantia: "",
  termo_promissoria: "",
  termo_pedido: "",
  termo_venda: "",
  termo_ordem_servico: "",
  termo_revendedor: "",
  imprimir_detalhado: true,
  imprimir_resumido: true,
};

export default function ConfiguracaoPDF() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PdfConfig>(DEFAULT_CONFIG);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["pdf-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_config")
        .select("*")
        .eq("id", CONFIG_ID)
        .maybeSingle();
      if (error) throw error;
      return data as PdfConfig | null;
    },
  });

  useEffect(() => {
    if (config) setForm({ ...DEFAULT_CONFIG, ...config });
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: PdfConfig) => {
      const { error } = await supabase
        .from("pdf_config")
        .upsert({ ...data, atualizado_em: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdf-config"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `pdf-logo/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: urlData.publicUrl }));
      toast.success("Logo carregada!");
    } catch {
      toast.error("Erro ao fazer upload da logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const set = (field: keyof PdfConfig, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Configuração PDF
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize o cabeçalho e os termos dos documentos gerados
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Cabeçalho do PDF */}
      <Card>
        <CardHeader>
          <CardTitle>Cabeçalho do PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-28 h-28 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted/50 text-sm">
                  <Upload className="h-4 w-4" />
                  {uploadingLogo ? "Enviando..." : "Alterar logo"}
                </div>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
              </Label>
            </div>
          </div>

          {/* Campos da empresa */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome da empresa</Label>
              <Input
                value={form.nome_empresa}
                onChange={(e) => set("nome_empresa", e.target.value)}
                placeholder="Ex: Taliare Semijoias"
              />
            </div>

            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => set("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input
                value={form.cep}
                onChange={(e) => set("cep", e.target.value)}
                placeholder="00000-000"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => set("endereco", e.target.value)}
                placeholder="Rua, número, bairro, cidade - UF"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Tabela de Comissão (exibida no PDF)</Label>
              <Textarea
                value={form.tabela_comissao}
                onChange={(e) => set("tabela_comissao", e.target.value)}
                placeholder="Até R$299,00 - 20% / Até R$999,00 - 30% ..."
                rows={2}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Mais Informações / Aviso</Label>
              <Textarea
                value={form.mais_informacoes}
                onChange={(e) => set("mais_informacoes", e.target.value)}
                placeholder="Ex: EVITE REDUZIR SUA COMISSÃO, PRESTE CONTAS NO PRAZO ESTABELECIDO!"
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Termos */}
      <Card>
        <CardHeader>
          <CardTitle>Termos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Termo da Garantia</Label>
            <Textarea
              value={form.termo_garantia}
              onChange={(e) => set("termo_garantia", e.target.value)}
              placeholder="Digite o termo de garantia aqui..."
              rows={5}
              className="resize-y"
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Termo da Promissória</Label>
            <Textarea
              value={form.termo_promissoria}
              onChange={(e) => set("termo_promissoria", e.target.value)}
              placeholder="Digite o termo da promissória aqui..."
              rows={5}
              className="resize-y"
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Termo do Pedido</Label>
            <Textarea
              value={form.termo_pedido}
              onChange={(e) => set("termo_pedido", e.target.value)}
              placeholder="Digite o termo do pedido aqui..."
              rows={7}
              className="resize-y"
            />
            <div className="pt-2 space-y-2">
              <p className="text-sm font-medium">Imprimir termo de pedido e venda em:</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="imprimir_detalhado"
                  checked={form.imprimir_detalhado}
                  onCheckedChange={(v) => set("imprimir_detalhado", !!v)}
                />
                <label htmlFor="imprimir_detalhado" className="text-sm cursor-pointer">
                  PDF de pedido e venda detalhada
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="imprimir_resumido"
                  checked={form.imprimir_resumido}
                  onCheckedChange={(v) => set("imprimir_resumido", !!v)}
                />
                <label htmlFor="imprimir_resumido" className="text-sm cursor-pointer">
                  PDF de pedido e venda resumida
                </label>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Termo da Venda</Label>
            <Textarea
              value={form.termo_venda}
              onChange={(e) => set("termo_venda", e.target.value)}
              placeholder="Digite o termo da venda aqui..."
              rows={5}
              className="resize-y"
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Termo da Ordem de Serviço</Label>
            <Textarea
              value={form.termo_ordem_servico}
              onChange={(e) => set("termo_ordem_servico", e.target.value)}
              placeholder="Digite o termo da ordem de serviço aqui..."
              rows={5}
              className="resize-y"
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Termo do Revendedor / Representante / Cliente</Label>
            <Textarea
              value={form.termo_revendedor}
              onChange={(e) => set("termo_revendedor", e.target.value)}
              placeholder="Digite o termo do revendedor aqui..."
              rows={5}
              className="resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão salvar bottom */}
      <div className="flex justify-end pb-6">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="gap-2"
          size="lg"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
