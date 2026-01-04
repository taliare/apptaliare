import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Bell, Send, Users, User, Loader2 } from "lucide-react";
import { z } from "zod";

const notificationSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(100, "Máximo 100 caracteres"),
  message: z.string().min(1, "Mensagem é obrigatória").max(500, "Máximo 500 caracteres"),
  type: z.enum(["info", "success", "warning", "error"]),
  link: z.string().max(200).optional(),
});

interface SendNotificationDialogProps {
  trigger?: React.ReactNode;
}

export function SendNotificationDialog({ trigger }: SendNotificationDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "success" | "warning" | "error">("info");
  const [link, setLink] = useState("");
  const [targetType, setTargetType] = useState<"all" | "specific">("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Buscar usuários
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["all-users-for-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async () => {
      // Validar dados
      const validated = notificationSchema.parse({
        title: title.trim(),
        message: message.trim(),
        type,
        link: link.trim() || undefined,
      });

      // Determinar destinatários
      const targetUserIds = targetType === "all" 
        ? users.map(u => u.id) 
        : selectedUsers;

      if (targetUserIds.length === 0) {
        throw new Error("Selecione pelo menos um destinatário");
      }

      // Criar notificações para cada usuário
      const notifications = targetUserIds.map(userId => ({
        user_id: userId,
        title: validated.title,
        message: validated.message,
        type: validated.type,
        link: validated.link || null,
        read: false,
      }));

      const { error } = await supabase
        .from("notifications")
        .insert(notifications);

      if (error) throw error;

      return { count: targetUserIds.length };
    },
    onSuccess: (data) => {
      toast({
        title: "Notificações enviadas",
        description: `${data.count} usuário(s) notificado(s) com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      resetForm();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setType("info");
    setLink("");
    setTargetType("all");
    setSelectedUsers([]);
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" className="gap-2">
            <Bell className="h-4 w-4" />
            Enviar Notificação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Enviar Notificação
          </DialogTitle>
          <DialogDescription>
            Envie uma notificação para todos os usuários ou selecione destinatários específicos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Nova funcionalidade disponível"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              placeholder="Descreva a notificação..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/500
            </p>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Informação</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Link (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="link">Link (opcional)</Label>
            <Input
              id="link"
              placeholder="Ex: /dashboard-admin"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Destinatários */}
          <div className="space-y-2">
            <Label>Destinatários</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as "all" | "specific")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Todos os usuários ({users.length})
                  </div>
                </SelectItem>
                <SelectItem value="specific">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Selecionar usuários
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de usuários para seleção */}
          {targetType === "specific" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Usuários ({selectedUsers.length} selecionados)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllUsers}
                  className="text-xs"
                >
                  {selectedUsers.length === users.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
              <ScrollArea className="h-[150px] rounded-md border p-2">
                {loadingUsers ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleUser(user.id)}
                      >
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.nome}</p>
                          {user.email && (
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => sendNotificationMutation.mutate()}
            disabled={sendNotificationMutation.isPending || !title.trim() || !message.trim()}
            className="gap-2"
          >
            {sendNotificationMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
