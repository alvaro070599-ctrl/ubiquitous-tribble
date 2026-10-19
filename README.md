# Rifa Nicolly & João — site para Vercel

Projeto Next.js App Router com PostgreSQL/Prisma, grade de 500 números, reserva concorrente, checkout Pix via Mercado Pago e painel administrativo. O design bege/marrom foi preservado. As cinco imagens dos prêmios foram recortadas da arte de referência enviada e são servidas por arquivos estáticos em `public/prizes/`.

## Requisitos
- Node.js 20.19+ (22 LTS recomendado)
- PostgreSQL gerenciado e persistente, acessível pela Vercel
- Aplicação Mercado Pago com token privado e chave secreta do webhook

## Executar em desenvolvimento
1. Copie `.env.example` para `.env` e preencha os valores necessários. Nunca publique `.env` no GitHub.
2. Instale dependências e gere o client Prisma:
   ```bash
   npm install
   npx prisma generate
   npm run db:push
   npm run db:seed
   npm run dev
   ```
3. Página pública: `http://localhost:3000`.
4. Painel administrativo: `http://localhost:3000/admin`.
5. Verificação sem dados sensíveis: `http://localhost:3000/api/health`.

## Publicar/atualizar na Vercel
1. Faça backup do banco e do repositório antes de atualizar um site existente.
2. Importe o repositório atual no projeto da Vercel. Framework preset: Next.js; diretório raiz: a pasta que contém este `package.json`.
3. Conecte um PostgreSQL gerenciado (por exemplo, Neon, Supabase ou Prisma Postgres). Use a connection string apropriada para serverless/pooler em `DATABASE_URL` se seu provedor oferecer uma.
4. Em Settings → Environment Variables, configure `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e, se desejado, os campos `SHARPIXEL_*` abaixo. Se usar ambientes Production, Preview e Development, preencha os que realmente utilizar.
5. O script `build` executa `prisma generate && next build`. Ele NÃO altera o esquema nem semeia o banco automaticamente.
6. Antes de abrir o site ao público, aplique o schema e inicialize os 500 números uma única vez a partir de uma máquina com acesso à URL de produção. Uma forma é usar a Vercel CLI:
   ```bash
   npx vercel login
   npx vercel link
   npx vercel env pull .env
   ```
   No PowerShell, confirme que o arquivo `.env` criado contém a conexão correta; ele já está listado no `.gitignore` e não deve ser enviado ao GitHub. Execute `npx prisma db push` e `npm run db:seed` (o seed é JavaScript puro e não depende de `tsx`/`esbuild`). Não faça seed numa base que já contém registros sem antes revisar a base de dados. O seed usa `skipDuplicates` e não sobrescreve os números existentes.
7. Faça commit e push para GitHub; a Vercel iniciará um novo deploy.
8. Configure no painel Mercado Pago o endpoint `https://SEU-DOMINIO/api/payment-webhook`, habilite notificações de pagamentos e copie a chave secreta gerada para `MP_WEBHOOK_SECRET`. Em produção, notificações sem assinatura válida são rejeitadas.
9. Teste `/api/health`, login do painel, seleção de números, tentativa de compra, QR Code e webhook com credenciais de teste antes de utilizar credenciais reais.

## Variáveis da Vercel

### Obrigatórias para produção
- `DATABASE_URL`: URL de PostgreSQL persistente. Não use SQLite nem arquivo local em produção serverless.
- `ADMIN_PASSWORD`: senha exclusiva do painel, com pelo menos 12 caracteres.
- `ADMIN_SESSION_SECRET`: valor aleatório de pelo menos 32 caracteres. A sessão administrativa expira em 8 horas.
- `MERCADOPAGO_ACCESS_TOKEN`: token privado para criar/consultar pagamentos; chamadas à API usam timeout curto para se adequar às funções serverless.
- `MP_WEBHOOK_SECRET`: segredo de assinatura de Webhooks do Mercado Pago. Necessário para validar notificações em produção.

### Dados cadastrais opcionais Sharpixel
- `SHARPIXEL_NOME_COMERCIAL`: nome comercial (padrão `Sharpixel`).
- `SHARPIXEL_NOME`: nome completo ou razão social.
- `SHARPIXEL_CPF`: CPF do responsável, se aplicável.
- `SHARPIXEL_CNPJ`: CNPJ, se aplicável.
- `SHARPIXEL_EMAIL`: e-mail de contato.
- `SHARPIXEL_TELEFONE`: telefone.
- `SHARPIXEL_ENDERECO`: endereço comercial.

Esses campos são lidos no servidor e enviados apenas à API autenticada do painel `/admin`. No código atual, CPF/CNPJ são apenas dados cadastrais exibidos no painel; não são enviados ao Mercado Pago nem usados para emissão fiscal, porque o projeto não implementa emissão de nota/cupom fiscal. Nunca use `NEXT_PUBLIC_` para CPF, CNPJ, credenciais ou outros dados privados. Alterar variáveis no dashboard exige um novo deploy para que o ambiente novo as leia.

### Configuração inicial da campanha (usada somente pelo seed)
- `RAFFLE_TITLE`: título inicial.
- `RAFFLE_PRICE`: valor em reais por número (padrão R$ 10).
- `RAFFLE_DRAW_DATE`: data/descrição do sorteio.
- `RAFFLE_INSTAGRAM`: Instagram divulgado.

Depois da primeira inicialização, essas configurações ficam no PostgreSQL e são alteradas no painel `/admin` sem atualizar o código.

## Segurança, reservas e pagamentos
- Números selecionados são revalidados no servidor dentro de transação serializável. O cliente nunca decide o preço nem o status.
- As sessões admin usam cookie HttpOnly, SameSite Strict, assinatura HMAC e expiração de 8 horas.
- A API de checkout devolve mensagens genéricas; erros internos e segredos não são expostos.
- O webhook consulta o pagamento diretamente no Mercado Pago, valida assinatura, valor e moeda, e é idempotente.
- Se um pagamento for aprovado depois que a reserva venceu ou os números foram entregues a outra compra, o pedido fica com status `PAID_REVIEW`; o sistema não toma números de outro comprador. O organizador deve revisar o caso com o provedor.
- Reservas expiradas são liberadas oportunisticamente em acessos à página ou ao checkout. Se for necessário liberar em horário exato sem acessos, configure um Cron Job da Vercel com proteção por token e uma rota agendada; a operação básica não depende de processo permanente.
- A chave Pix estática cadastrada no painel é apenas um registro administrativo; o checkout automático usa Pix dinâmico do Mercado Pago. A chave estática não é exposta pela API pública nem substitui o token e a assinatura do provedor.
- Antes de produção, revise requisitos legais e regras aplicáveis à realização de rifas/sorteios no Brasil.

## Endpoints úteis
- `GET /api/health`: verifica se o PostgreSQL, o registro de configurações e os 500 números estão inicializados, sem expor credenciais.
- `POST /api/checkout`: cria reserva e cobrança Pix.
- `POST /api/payment-webhook`: recebe e valida atualizações do Mercado Pago.
- `GET /api/orders/{id}`: retorna apenas o status público do pedido.
- `/admin`: painel autenticado.
