import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profilesLimited } from "@/lib/profilesLimited";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationSound } from "./useNotificationSound";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  };
  receiver?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  };
}

export interface Conversation {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export function useMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { playMessageSound } = useNotificationSound();
  const previousUnreadRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);

  // Fetch all messages
  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ["messages", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!user?.id,
  });

  // Get conversations from messages
  const conversations: Conversation[] = [];
  const conversationMap = new Map<string, Conversation>();

  messages.forEach((msg) => {
    const otherUserId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
    
    if (!conversationMap.has(otherUserId)) {
      conversationMap.set(otherUserId, {
        userId: otherUserId,
        userName: "", // Will be filled later
        avatarUrl: null,
        lastMessage: msg.content,
        lastMessageTime: msg.created_at,
        unreadCount: 0,
      });
    }

    const conv = conversationMap.get(otherUserId)!;
    if (!msg.read && msg.receiver_id === user?.id) {
      conv.unreadCount++;
    }
  });

  // Fetch user profiles for conversations
  const userIds = Array.from(conversationMap.keys());
  
  const { data: profiles = [] } = useQuery({
    queryKey: ["conversation-profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];

      const { data, error } = await profilesLimited()
        .select("id, nome, avatar_url")
        .in("id", userIds);

      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  // Merge profiles into conversations
  profiles.forEach((profile) => {
    const conv = conversationMap.get(profile.id);
    if (conv) {
      conv.userName = profile.nome;
      conv.avatarUrl = profile.avatar_url;
    }
  });

  const conversationList = Array.from(conversationMap.values()).filter(c => c.userName);

  // Get messages for a specific user
  const getMessagesWithUser = (otherUserId: string) => {
    return messages
      .filter(
        (msg) =>
          (msg.sender_id === user?.id && msg.receiver_id === otherUserId) ||
          (msg.sender_id === otherUserId && msg.receiver_id === user?.id)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string; content: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async (senderId: string) => {
      if (!user?.id) return;

      const { error } = await supabase
        .from("messages")
        .update({ read: true })
        .eq("sender_id", senderId)
        .eq("receiver_id", user.id)
        .eq("read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  // Unread count
  const unreadCount = messages.filter((m) => m.receiver_id === user?.id && !m.read).length;

  // Play sound when new messages arrive
  useEffect(() => {
    if (isInitialLoadRef.current) {
      previousUnreadRef.current = unreadCount;
      isInitialLoadRef.current = false;
      return;
    }

    if (unreadCount > previousUnreadRef.current) {
      playMessageSound();
    }
    previousUnreadRef.current = unreadCount;
  }, [unreadCount, playMessageSound]);

  // Setup realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          refetch();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${user.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  return {
    messages,
    conversations: conversationList,
    isLoading,
    unreadCount,
    getMessagesWithUser,
    sendMessage: sendMessageMutation.mutate,
    sendingMessage: sendMessageMutation.isPending,
    markAsRead: markAsReadMutation.mutate,
    refetch,
  };
}
