# Configuração do Supabase para a rifa

Esta migração cria a estrutura para pedidos compartilhados e reservas de números. Ela está numa branch separada (`feature/supabase-orders`); ainda não altera o site publicado.

## 1. Criar as tabelas
1. Crie um projeto no Supabase.
2. Abra **SQL Editor → New query**.
3. Copie e execute o conteúdo de `supabase/migrations/20261020_raffle_orders.sql`.

## 2. Variáveis na Vercel
Depois da integração da API, configure no projeto da Vercel:
- `SUPABASE_URL`: Project URL do Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: chave secreta de servidor do Supabase.

Nunca coloque a `SERVICE_ROLE_KEY` no HTML, nem em variáveis `NEXT_PUBLIC_` ou `VITE_`. Ela só pode ser usada nas funções serverless.

## 3. Compras antigas
O código anterior não guardava pedidos completos num banco: guardava os números pendentes no `localStorage` de cada navegador e usava `SOLD_NUMBERS` para a lista manual de vendidos. Por isso, não existe uma lista central de nomes, telefones, comprovantes ou pedidos antigos para recuperar automaticamente a partir do site.

É possível preservar os números já vendidos se a lista atual estiver em `SOLD_NUMBERS` ou se for montada a partir dos comprovantes/conversas do WhatsApp. Os nomes, telefones, valores e datas só podem ser importados se houver registros dessas informações. Não marque números como pagos apenas porque alguém clicou em “Já paguei”.

## Estado
A migração SQL cria as tabelas e uma função de reserva atômica. A integração completa das rotas de API e da tela ainda precisa ser implementada e testada antes de publicar/mesclar a branch.
