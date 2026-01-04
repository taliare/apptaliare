-- Função que notifica todos os admins sobre novo lead
CREATE OR REPLACE FUNCTION public.notify_admins_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user RECORD;
BEGIN
  -- Buscar todos os usuários com role admin
  FOR admin_user IN 
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    -- Inserir notificação para cada admin
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      admin_user.user_id,
      'Novo Lead de Revendedora',
      'Nova candidata: ' || NEW.nome || ' (' || COALESCE(NEW.cidade, 'Cidade não informada') || ')',
      'info',
      '/leads-revendedoras'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger que executa a função após INSERT
CREATE TRIGGER on_new_lead_notify_admins
  AFTER INSERT ON leads_revendedoras
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_lead();

-- Habilitar realtime na tabela leads_revendedoras
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads_revendedoras;