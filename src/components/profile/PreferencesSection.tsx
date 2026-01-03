import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Moon, Sun, Monitor, Globe, Save, Settings } from "lucide-react";
import { useTheme } from "next-themes";

const THEMES = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
];

export function PreferencesSection() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(theme || "system");
  const [selectedLanguage, setSelectedLanguage] = useState("pt-BR");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("tema, idioma")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          if (data.tema) {
            setSelectedTheme(data.tema);
            setTheme(data.tema);
          }
          if (data.idioma) {
            setSelectedLanguage(data.idioma);
          }
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id, setTheme]);

  const handleSavePreferences = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          tema: selectedTheme,
          idioma: selectedLanguage,
        })
        .eq("id", user.id);

      if (error) throw error;

      setTheme(selectedTheme);

      toast({
        title: "Preferências salvas",
        description: "Suas preferências foram atualizadas.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const ThemeIcon = THEMES.find((t) => t.value === selectedTheme)?.icon || Monitor;

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferências
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Preferências
        </CardTitle>
        <CardDescription>
          Personalize sua experiência no sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tema */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <ThemeIcon className="h-4 w-4" />
            Tema
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setSelectedTheme(t.value);
                    setTheme(t.value); // Apply theme immediately
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    selectedTheme === t.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Idioma */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Idioma
          </Label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o idioma" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A mudança de idioma será aplicada na próxima sessão.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSavePreferences} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Preferências
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
