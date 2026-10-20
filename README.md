# Rifa em prol do casamento — Nicolly & João

Site estático (`public/`) + funções serverless (`api/`) para a Vercel. O Pix (QR Code + copia e cola) é gerado no servidor.

## Banco de dados Neon

Configure a variável `DATABASE_URL` na Vercel com a connection string do Neon (incluindo SSL). A aplicação usa as tabelas `public.raffle_orders` e `public.raffle_order_numbers` já criadas no banco.

A API agora:
- cria o pedido como `pending` e registra os números no Neon;
- bloqueia números já reservados ou pagos, inclusive em compras simultâneas;
- libera automaticamente reservas pendentes após 20 minutos;
- carrega os números reservados/pagos do banco para todos os visitantes.

**Atenção:** gerar o Pix não confirma o pagamento automaticamente. O pedido precisa ser marcado como `paid` somente após conferir o recebimento no banco. A variável `SOLD_NUMBERS` continua servindo para números antigos já vendidos fora do sistema.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `DATABASE_URL` | sim para reservar números compartilhados | connection string do Neon |
| `PIX_KEY` | sim | chave Pix dos noivos |
| `PIX_NAME` | sim | `NICOLLY E JOAO` |
| `PIX_CITY` | sim | `SAPUCAIA DO SUL` |
| `WHATSAPP` | sim | `5551999999999` |
| `PRICE` | não (10) | `10` |
| `TOTAL_NUMBERS` | não (500) | `500` |
| `DRAW_DATE` | não | `30 DE NOVEMBRO` |
| `INSTAGRAM` | não | `@joaoenicky` |
| `MAX_PER_ORDER` | não (50) | `50` |
| `SOLD_NUMBERS` | não | `3,17,25-30,108` |

Depois de adicionar ou alterar variáveis na Vercel, faça um novo deploy.

## Publicação e teste

1. Faça merge da branch de integração para `main` depois de revisar as alterações.
2. Na Vercel, confirme `DATABASE_URL` e as variáveis do Pix.
3. Faça deploy e teste uma reserva com um número livre.
4. Abra o site em outro aparelho ou navegador para confirmar que o número aparece como reservado.
5. Confira que uma nova tentativa para o mesmo número é recusada.

O projeto requer Node.js 18 ou superior.
