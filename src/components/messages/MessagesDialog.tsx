import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Send, 
  MessageSquare, 
  Search, 
  Loader2,
  Users,
  Check,
  CheckCheck
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MessagesDialog({ open, onOpenChange }: MessagesDialogProps) {
  const { user, profile } = useAuth();
  const { 
    conversations, 
    isLoading, 
    getMessagesWithUser, 
    sendMessage, 
    sendingMessage,
    markAsRead 
  } = useMessages();
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserList, setShowUserList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all users for new conversation
  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-for-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .neq("id", user?.id || "")
        .order("nome");

      if (error) throw error;
      return data;
    },
    enabled: open && showUserList,
  });

  // Selected user profile
  const { data: selectedUserProfile } = useQuery({
    queryKey: ["user-profile", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .eq("id", selectedUserId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedUserId,
  });

  const selectedMessages = selectedUserId ? getMessagesWithUser(selectedUserId) : [];

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedMessages]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (selectedUserId && open) {
      markAsRead(selectedUserId);
    }
  }, [selectedUserId, open, markAsRead]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedUserId) return;

    sendMessage(
      { receiverId: selectedUserId, content: newMessage },
      {
        onSuccess: () => {
          setNewMessage("");
        },
        onError: (error: any) => {
          toast({
            title: "Erro ao enviar",
            description: error.message || "Tente novamente.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const formatMessageTime = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) {
      return format(d, "HH:mm");
    } else if (isYesterday(d)) {
      return "Ontem " + format(d, "HH:mm");
    }
    return format(d, "dd/MM HH:mm", { locale: ptBR });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const filteredConversations = conversations.filter((c) =>
    c.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = allUsers.filter((u) =>
    u.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            {(selectedUserId || showUserList) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedUserId(null);
                  setShowUserList(false);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {selectedUserId && selectedUserProfile
                ? selectedUserProfile.nome
                : showUserList
                ? "Nova Conversa"
                : "Mensagens"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedUserId && !showUserList ? (
            // Conversation list
            <>
              <div className="p-3 border-b">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar conversas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => setShowUserList(true)} className="gap-2">
                    <Users className="h-4 w-4" />
                    Nova
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                    <p>Nenhuma conversa encontrada</p>
                    <Button
                      variant="link"
                      onClick={() => setShowUserList(true)}
                      className="mt-2"
                    >
                      Iniciar nova conversa
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredConversations.map((conv) => (
                      <button
                        key={conv.userId}
                        onClick={() => setSelectedUserId(conv.userId)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.avatarUrl || undefined} />
                          <AvatarFallback>{getInitials(conv.userName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{conv.userName}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTime(conv.lastMessageTime)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : showUserList ? (
            // User selection list
            <>
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                {filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-50" />
                    <p>Nenhum usuário encontrado</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setShowUserList(false);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(u.nome)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            // Chat view
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                      <p>Nenhuma mensagem ainda</p>
                      <p className="text-sm">Envie a primeira mensagem!</p>
                    </div>
                  ) : (
                    selectedMessages.map((msg) => {
                      const isMine = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              isMine
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                            <div
                              className={`flex items-center gap-1 mt-1 text-xs ${
                                isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}
                            >
                              <span>{formatMessageTime(msg.created_at)}</span>
                              {isMine && (
                                msg.read ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <Separator />

              <div className="p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                    maxLength={1000}
                  />
                  <Button 
                    type="submit" 
                    disabled={!newMessage.trim() || sendingMessage}
                    size="icon"
                  >
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
