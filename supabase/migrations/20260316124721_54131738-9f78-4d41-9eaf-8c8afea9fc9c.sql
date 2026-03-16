
UPDATE public.leads_revendedoras SET status = 'em_analise' WHERE status IN ('contato_realizado', 'follow_up');
UPDATE public.leads_revendedoras SET status = 'aprovada' WHERE status = 'interessada';
UPDATE public.leads_revendedoras SET status = 'entrevista_agendada' WHERE status = 'aguardando_kit';
UPDATE public.leads_revendedoras SET status = 'reprovada' WHERE status = 'perdida';
