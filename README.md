# Rifa em prol do casamento — Nicolly & João

Site estático (`public/`) + funções serverless (`api/`) para a Vercel.
O **Pix (QR Code + copia e cola)** é gerado no servidor com as variáveis de ambiente,
então a chave Pix e o WhatsApp **não ficam escritos no HTML**.

## Estrutura
```
public/index.html      página (sem nenhum dado sensível)
public/img/            fotos do casal e dos prêmios
api/config.js          GET  /api/config  -> preço, total, data, instagram, números vendidos
api/pix.js             POST /api/pix     -> valida a compra e devolve o código Pix + link do WhatsApp
api/_lib/pix.js        gerador do BR Code (CRC16)
api/_lib/env.js        leitura das variáveis de ambiente
vercel.json            cabeçalhos de segurança
.env.example           modelo das variáveis
```

## Variáveis de ambiente (Vercel > Settings > Environment Variables)
| Variável | Obrigatória | Exemplo |
|---|---|---|
| `PIX_KEY` | sim | `+5551999999999`, e-mail, CPF só números ou chave aleatória |
| `PIX_NAME` | sim | `NICOLLY E JOAO` (sem acento, até 25 letras) |
| `PIX_CITY` | sim | `SAPUCAIA DO SUL` (sem acento, até 15 letras) |
| `WHATSAPP` | sim | `5551999999999` (55 + DDD + número) |
| `PRICE` | não (10) | `10` |
| `TOTAL_NUMBERS` | não (500) | `500` |
| `DRAW_DATE` | não | `30 DE NOVEMBRO` |
| `INSTAGRAM` | não | `@joaoenicky` |
| `MAX_PER_ORDER` | não (50) | `50` |
| `SOLD_NUMBERS` | não | `3,17,25-30,108` |

## Como publicar
1. Suba esta pasta para um repositório no GitHub (o `.gitignore` já protege os arquivos `.env`).
2. Na Vercel: **Add New → Project**, importe o repositório. Framework Preset: **Other**. Não precisa de Build Command.
3. Em **Settings → Environment Variables**, cadastre as variáveis acima (marque Production).
4. Faça o **Deploy**.

Para atualizar os números vendidos: edite `SOLD_NUMBERS` e faça **Redeploy**
(mudança em variável só vale para novos deploys).

## Teste local
```
npm i -g vercel
cp .env.example .env.local   # preencha os valores
vercel dev
npm test                     # testa o gerador de Pix e a API
```
