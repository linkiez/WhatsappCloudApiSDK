# JCMAP-158 — Parte 3 (WhatsApp Cloud API — cobertura 100%)

> Este documento detalha um plano para evoluir o suporte atual do `WhatsAppCloudProvider` (texto + template) para cobrir **100%** dos recursos relevantes da **WhatsApp Business Platform / WhatsApp Cloud API**, incluindo **tipos de mensagens**, **mídia**, **webhooks**, **limites**, **qualidade**, **janelas de atendimento**, **recibos/typing** e itens avançados (ex.: grupos e ligações).

## Contexto atual (já implementado)

- Envio WhatsApp (HTTP, sem SDK): [src/integrations/message/providers/WhatsAppCloudProvider.ts](src/integrations/message/providers/WhatsAppCloudProvider.ts)
  - Suporta: `text` e `template`.
  - Usa `message_channel_account` com `secretsEncrypted` (AES-256-GCM) e fallback de config.
- Webhook WhatsApp: [src/integrations/message/webhooks/whatsappWebhookController.ts](src/integrations/message/webhooks/whatsappWebhookController.ts)
  - Valida assinatura `x-hub-signature-256` (HMAC-SHA256).
  - Dedup por `payloadHash` (ver `message_webhook_event`).
  - Atualiza tracking em `message_delivery` por `providerMessageId`.
- Tracking: `message_delivery` e `message_webhook_event` já existem e suportam deduplicação/event sourcing best-effort.

## Objetivo desta parte

1. Expandir o contrato interno (`SendMessageRequest`) para suportar **todos os tipos de mensagens** que a Cloud API permite.
2. Implementar **mídia** (upload, download, delete) e suportar envio por `id` e por `link`.
3. Processar **webhooks de mensagens recebidas** (além de `statuses`) e interações (botões/lista/flows).
4. Tratar **janelas de atendimento**, **opt-in**, **qualidade**, **TTL** e **limites de volume** de forma observável e robusta.
5. Cobrir tudo com **testes unitários** (e alguns de integração com mocks HTTP), mantendo compatibilidade com o padrão do repo.

> Observação: o link “about-the-platform” retornou erro intermitente via ferramenta de extração, então este plano foi ancorado em páginas acessíveis do mesmo conjunto de documentação (mensagens, mídia e webhooks).

## Status atual

- ✅ Base disponível (já implementado no repo)
  - Provider WhatsApp com `text` e `template`: `src/integrations/message/providers/WhatsAppCloudProvider.ts`
  - Webhook WhatsApp (assinatura + `statuses[]` + dedup): `src/integrations/message/webhooks/whatsappWebhookController.ts`
  - Tracking/eventos: `message_delivery` e `message_webhook_event`
  - Testes: `WhatsAppCloudProvider.test.ts` e `whatsappWebhookController.test.ts`

- 🔄 Em aberto (escopo desta Parte 3)
  - Tipos completos de mensagens + builder de payload por tipo
  - Serviço de mídia (upload/get URL/download/delete) e integração no envio
  - Webhooks para `messages[]` (mensagens recebidas) e erros em todos os níveis
  - Política de janela 24h (template-only fora da janela) e automações
  - Rate limit/backoff e padronização de erros
  - Gestão (templates, phone numbers, analytics) e itens avançados (grupos/calling)

## Roadmap executável (milestones)

> Meta: cada milestone deve fechar com testes unitários verdes e sem breaking change no contrato atual de envio (`text` e `template`).

- [ ] M1 — Contrato + builder “multi-type” (sem mídia ainda)
  - Objetivo: evoluir o contrato para suportar todos os tipos e padronizar o builder/parsing de resposta.
  - Arquivos
    - Atualizar: `src/integrations/message/types.ts`
    - Atualizar: `src/integrations/message/providers/WhatsAppCloudProvider.ts`
    - Atualizar: `src/integrations/message/providers/WhatsAppCloudProvider.test.ts`
    - (Opcional) Atualizar: `src/integrations/message/MessageService.test.ts` (garantir compatibilidade do dispatch)
  - Entregas
    - Union types completos por `type` (inclui `interactive`, `reaction`, `location`, `contacts`, `sticker`, `flows`).
    - `contextMessageId` suportado via `context`.
    - Parsing padronizado de `messages[0].id` e `messages[0].message_status`.
  - Critérios de aceite
    - Testes adicionados por tipo validam o payload gerado.
    - `text` e `template` continuam funcionando sem alteração no caller.

- [ ] M2 — Mídia: upload/download/delete + envio por `mediaId`/`link`
  - Objetivo: implementar o ciclo de mídia e habilitar `image/video/audio/document/sticker`.
  - Arquivos
    - Criar: `src/integrations/message/providers/whatsapp/WhatsAppMediaService.ts`
    - Criar: `src/integrations/message/providers/whatsapp/WhatsAppMediaService.test.ts`
    - Atualizar: `src/integrations/message/providers/WhatsAppCloudProvider.ts`
    - Atualizar: `src/integrations/message/providers/WhatsAppCloudProvider.test.ts`
  - Entregas
    - Upload (multipart), get URL temporária, download binário autenticado e delete.
    - Envio de mídia por `mediaId` e por `link` (com `caption` quando aplicável).
  - Critérios de aceite
    - Testes cobrem os 4 endpoints de mídia via mocks HTTP determinísticos.
    - Provider consegue montar payloads `image/video/audio/document/sticker`.

- [ ] M3 — Webhooks: mensagens recebidas (`messages[]`) + erros em todos os níveis
  - Objetivo: suportar inbound, replies interativas e erros, mantendo dedup.
  - Arquivos
    - Atualizar: `src/integrations/message/webhooks/whatsappWebhookController.ts`
    - Atualizar: `src/integrations/message/webhooks/whatsappWebhookController.test.ts`
    - (Opcional) Atualizar: modelos/serialização do `MessageDelivery` para armazenar `direction: incoming` (somente se ainda não existir)
  - Entregas
    - Parse de `messages[]` com suporte mínimo para `text`, `media`, `interactive`, `reaction`, `location`, `contacts`.
    - Tratamento de `errors` em `value.errors`, `messages.errors`, `statuses.errors`.
    - Persistência best-effort + atualização de `MessageDelivery`.
  - Critérios de aceite
    - Testes novos cobrindo inbound por tipo + erros.
    - Dedup continua funcional (mesmo payload não duplica estado/eventos).

- [ ] M4 — Janela 24h: política de envio + fallback para template
  - Objetivo: impedir envio de tipos não permitidos fora da janela e padronizar comportamento.
  - Arquivos
    - Criar: `src/integrations/message/providers/whatsapp/WhatsAppSendPolicy.ts`
    - Criar: `src/integrations/message/providers/whatsapp/WhatsAppSendPolicy.test.ts`
    - Atualizar: `src/integrations/message/providers/WhatsAppCloudProvider.ts` (aplicar política)
    - (Opcional) Atualizar: `src/integrations/message/MessageService.ts` (se a política ficar acima do provider)
  - Critérios de aceite
    - Testes cobrem “janela aberta” vs “janela fechada”.
    - Fora da janela, comportamento é previsível (erro claro ou coerção para template, conforme decisão do produto).

- [ ] M5 — Rate limit/backoff + idempotência de envio
  - Objetivo: reduzir falhas por throttling/pairing e melhorar resiliência.
  - Arquivos
    - Criar/Atualizar: helper de retry/backoff (na pasta de whatsapp) + testes
    - Atualizar: `src/integrations/message/providers/WhatsAppCloudProvider.ts`
    - Atualizar: `src/integrations/message/providers/WhatsAppCloudProvider.test.ts`
  - Critérios de aceite
    - Testes simulam erro de throttling e verificam backoff/retry.
    - Nenhum retry infinito; logs não vazam segredos.

- [ ] M6 — Gestão (Business Management API): templates, phone numbers, analytics
  - Objetivo: cobrir a superfície de gestão necessária para operação (sem UI inicialmente).
  - Arquivos
    - Criar: `src/integrations/message/providers/whatsapp/WhatsAppManagementService.ts`
    - Criar: `src/integrations/message/providers/whatsapp/WhatsAppManagementService.test.ts`
  - Critérios de aceite
    - Testes de contrato via mocks HTTP para listagem/consulta/ações principais.

- [ ] M7 — Advanced (gated): grupos e calling
  - Objetivo: incluir suporte quando a conta/endpoint estiver disponível.
  - Critérios de aceite
    - Implementação condicionada a endpoints estáveis na doc e habilitação na conta.

## Referências (WhatsApp Business Platform)

- [Visão geral da plataforma](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Enviar mensagens (tipos, janela 24h, TTL, recibos/typing)](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
- [API de Mensagens (endpoint `/messages`)](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)
- [Webhooks (payloads + erros)](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)
- [Mídia (upload / URL / download / delete)](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)

## 3.0 Princípios de design

- **Discriminated unions** no contrato (sem `any`), compatível com o padrão atual do Message Service.
- Separar:
  - **Mensagem** (payload do `POST /{phoneNumberId}/messages`).
  - **Mídia** (upload/download/delete) em um helper/serviço próprio.
  - **Webhooks** (parse/validate/dedup/persist) em controller(s) com responsabilidades claras.
- **Sem vazamento de segredos**: logs não devem registrar tokens nem payloads sensíveis.
- **Best-effort + dedup**: persistir eventos e atualizar `MessageDelivery` quando possível.
- **Backoff/limites**: respeitar limites por destinatário (pareamento) e throughput, com retry exponencial quando aplicável.

## 3.1 Contrato de API interna (tipos) — cobertura total

### 3.1.1 Expandir `SendWhatsApp*Request`

Adicionar variantes para refletir os tipos de mensagem suportados pela Cloud API. Recomendação: manter `SendWhatsAppMessageRequest` como união discriminada por `type`.

Checklist:

1. Criar tipo base `SendWhatsAppBaseRequest`:
   - `channel: 'whatsapp'` (ou manter o padrão já usado nas unions atuais)
   - `tenantSchema: string`
   - `empresaId?: number`
   - `accountUid?: string`
   - `recipientContactId: number`
   - `contextMessageId?: string` (para reply/contextual reply)
   - `ttlSeconds?: number` (quando permitido pela plataforma/endpoint)

2. Adicionar requests por tipo de mensagem:
   - `text` (já existe)
   - `template` (já existe)
   - `image`, `video`, `audio`, `document`, `sticker`
   - `location`, `contacts`
   - `interactive` (botões de resposta, listas, CTA URL, location request)
   - `reaction`
   - `typing_indicator` / `mark_as_read` (quando exposto como payload no endpoint `/messages`)
   - `business/catalog` (mensagens comerciais: produto único, multi-produto) — se aplicável ao caso de uso
   - `flows` (mensagens de flow interativas / template de flow)

3. Adicionar campos mínimos por tipo:
   - Para mídia: suportar envio por `mediaId` e por `link` (com `caption` quando permitido).
   - Para interactive: modelar o payload de acordo com `interactive.type` (ex.: `button`, `list`, `cta_url`, `location_request`, `flow`).
   - Para reaction: exigir `emoji` + `messageId` (da mensagem anterior do usuário).

4. Atualizar `SendMessageResult`:
   - manter `providerMessageId?: string`
   - adicionar `providerMessageStatus?: string` quando presente (ex.: pacing status de templates)
   - manter `raw?: unknown` (já existe), mas padronizar para ser opcional e nunca conter segredos.

Critérios de aceite:

- Tipos compilam sem `any` (usar `unknown` e type guards quando necessário).
- Cada tipo tem validação mínima (campos obrigatórios e strings não vazias).
- Não quebra compatibilidade: `text` e `template` continuam funcionando sem mudanças no caller.

## 3.2 Provider WhatsApp — payloads completos

### 3.2.1 Refatorar builder de payload

Objetivo: transformar `buildPayload()` em um builder que suporta todos os `type`s, com validação previsível.

Checklist:

1. Implementar `buildPayload(request, to)` com `switch`/guards por `request.type`.
2. Implementar suporte a `context` quando `contextMessageId` estiver presente.
3. Implementar suporte a `recipient_type` (`individual` por padrão).
4. Implementar parsing completo da resposta:
   - extrair `messages[0].id` como `providerMessageId`
   - extrair `messages[0].message_status` como `providerMessageStatus` quando existir

Critérios de aceite:

- Testes unitários por tipo de mensagem validando payload gerado (snapshot-like com `toEqual`).
- Erros padronizados: `InvalidArgumentError` para input inválido, `InternalServerError` para falha HTTP.

### 3.2.2 Normalização de telefone (alinhada ao guia)

O guia recomenda aceitar formatos com `+`, espaços etc., mas ressalta riscos quando omitido. Hoje o provider remove tudo não-numérico e envia sem `+`.

Checklist:

1. Ajustar `normalizePhoneNumber()` para:
   - aceitar número com `+` e enviar **com ou sem** conforme expectativa do endpoint (documentação aceita ambos)
   - manter validação simples (10–15 dígitos), sem quebrar dados existentes

2. Adicionar testes cobrindo:
   - `+55 (11) 99999-9999`
   - `11 99999-9999` (documentar comportamento/risco)

## 3.3 Mídia — upload / download / delete

### 3.3.1 Criar `WhatsAppMediaService`

Objetivo: encapsular o ciclo:

- `POST /{phoneNumberId}/media` (upload) → `mediaId`
- `GET /{mediaId}` → `mediaUrl` (válido por ~5 min)
- `GET mediaUrl` → bytes
- `DELETE /{mediaId}` (opcional)

Checklist:

1. Implementar service em `src/integrations/message/providers/whatsapp/WhatsAppMediaService.ts` (pasta sugerida) com:
   - `uploadMedia({ tenantSchema, empresaId, accountUid, file, mimeType }): Promise<{ mediaId: string }>`
   - `getMediaUrl({ tenantSchema, empresaId, accountUid, mediaId, phoneNumberId? }): Promise<{ url: string; mimeType?: string; sha256?: string; fileSize?: number }>`
   - `downloadMedia({ url, accessToken }): Promise<Buffer>`
   - `deleteMedia({ tenantSchema, empresaId, accountUid, mediaId, phoneNumberId? }): Promise<void>`

2. Definir “fonte do arquivo” para upload:
   - Opção A (recomendada): integrar com modelo `File`/bucket existente (upload de arquivo já persistido no JCM).
   - Opção B: aceitar path local apenas para testes/dev.

3. Atualizar o provider para enviar mídia por:
   - `mediaId` (preferencial)
   - `link` (com observação de cache de 10 minutos)

Critérios de aceite:

- Testes com `fetch` mockado cobrindo:
  - upload (multipart/form-data)
  - get URL e download (binary)
  - delete
- Erros comuns mapeados (ex.: mídia grande/ MIME incompatível) retornam mensagens claras.

## 3.4 Webhooks — cobertura total (statuses + incoming messages + errors)

### 3.4.1 Manter e expandir o controller atual

O payload possui dois formatos principais:

- `statuses[]` para mensagens enviadas pela empresa (enviado/entregue/lido/falha)
- `messages[]` para mensagens recebidas (inclui tipo e estrutura própria)

Checklist:

1. Expandir parser do webhook para suportar ambos:
   - se houver `statuses[]`: manter atualização de `MessageDelivery` (já existe)
   - se houver `messages[]`: persistir `MessageDelivery` com `direction: 'incoming'`

2. Para mensagens recebidas, suportar pelo menos:
   - `text`
   - `image`/`video`/`audio`/`document` (inclui `media.id` e/ou `url` quando disponível)
   - `interactive` replies (list/button)
   - `reaction`
   - `location`
   - `contacts`

3. Tratar `errors` nos 3 níveis descritos pela doc:
   - `entry.changes.value.errors`
   - `entry.changes.value.messages.errors` (type `unsupported`)
   - `entry.changes.value.statuses.errors`

4. Persistência:
   - continuar dedup em `MessageWebhookEvent` por `payloadHash`
   - criar/atualizar `MessageDelivery` com:
     - `channel: 'whatsapp'`
     - `providerMessageId` (quando existir)
     - `status` (quando existir)
     - `direction` (incoming/outgoing)
     - `raw` (opcional, limitado e sem segredos)

Critérios de aceite:

- Testes unitários com payloads reais/sintéticos para:
  - `statuses.delivered/read/failed`
  - `messages.text`
  - `messages.image` com `media.id`
  - `messages.interactive` (reply)
  - `errors` nos níveis documentados

### 3.4.2 Processamento de mídia recebida

Checklist:

1. Quando mensagem recebida contiver `media.id`:
   - opcionalmente enfileirar um job interno (fase futura) para baixar mídia.
   - no MVP desta parte, persistir o `media.id` e expor endpoint interno para “baixar mídia por ID”.

2. Quando webhook já trouxer `media.url` (lançamento gradual citado na doc):
   - baixar imediatamente (se configurado) OU persistir URL (com expiração) e tentar baixar com retry.

## 3.5 Janelas de atendimento (24h) e estratégia de envio

A doc reforça: fora da janela de atendimento, só pode enviar **template messages**.

Checklist:

1. Introduzir estratégia `WhatsAppSendPolicy`:
   - `decideMessageType({ recipientWaId, lastInboundAt, requestedType }): allowedType`

2. Persistir estado mínimo por destinatário:
   - Opção A: derivar do histórico em `MessageDelivery` (última `incoming` por `recipientId`)
   - Opção B (mais eficiente): tabela/redis `whatsapp_conversation_state` por `wa_id + phone_number_id`

3. Falhas por “janela fechada” devem retornar erro claro sugerindo envio via template.

Critérios de aceite:

- Testes unitários cobrindo decisão “janela aberta” vs “fechada”.

## 3.6 Limites, retry e qualidade

### 3.6.1 Limites de pareamento e throughput

Checklist:

1. Para erros de throttling (ex.: 131056), implementar retry com backoff exponencial conforme recomendação (4^X segundos).
2. Implementar rate limit por destinatário (memória/Redis):
   - chave: `whatsapp:pair:<phoneNumberId>:<waId>`
   - janela: ~6s

3. Implementar logs estruturados de throttling sem payload sensível.

### 3.6.2 Qualidade e boas práticas (política)

Checklist:

1. Documentar e (quando possível) validar opt-in antes de envio de templates.
2. Criar “guardrails” no domínio (opcional): impedir blast massivo sem consentimento.

## 3.7 Gestão (Business Management API) — templates, phone numbers, analytics

Esta área expande além do envio básico e pode exigir permissões adicionais.

Checklist:

1. Templates:
   - listar templates
   - criar/atualizar templates
   - ler status/aprovação

2. Phone numbers:
   - listar números
   - ler metadados (quality rating, throughput level)

3. Analytics:
   - coletar métricas de mensagens entregues/lidas por template

Critérios de aceite:

- Implementar inicialmente como serviços internos, sem UI, com testes de contrato via mocks HTTP.

## 3.8 Grupos e ligações (advanced)

As docs indicam suporte a Grupos e Calling. Para “100%”, incluir no roadmap.

Checklist:

1. Grupos:
   - criar/gerenciar grupos
   - enviar mensagens para grupos (observando `group_id` em respostas/webhooks)

2. Calling:
   - iniciar/receber chamadas, eventos via webhooks (se aplicável)

Critérios de aceite:

- Implementação condicionada à elegibilidade do recurso na conta e disponibilidade na documentação/endpoint.

## 3.9 Testes (TDD) e critérios globais de aceite

Checklist:

1. Testes do provider (unit):
   - payload por tipo (`text`, `template`, `image`, `document`, `interactive`, `reaction`, etc.)
   - parsing de `providerMessageId` e `providerMessageStatus`
   - erro HTTP com body inválido

2. Testes de mídia (unit): upload / get url / download / delete.
3. Testes de webhook (unit):
   - `statuses[]` (success + failed)
   - `messages[]` por tipo
   - dedup (`payloadHash`)

4. Cobertura: adicionar casos de borda (sem schema, contato inexistente, credenciais ausentes, token ausente).

Critérios globais de aceite:

- 100% dos tipos de mensagem listados na documentação de envio suportados pelo contrato e builder.
- Webhook processa `messages[]`, `statuses[]` e `errors` sem cair em erro.
- Mídia funcional (ciclo completo) com testes determinísticos.
- Limites de rate limit e backoff implementados e testados.

## 3.10 Entregáveis

- Atualização de contrato: `src/integrations/message/types.ts`
- Atualização do provider: `src/integrations/message/providers/WhatsAppCloudProvider.ts`
- Novo serviço de mídia: `src/integrations/message/providers/whatsapp/WhatsAppMediaService.ts`
- Atualização do webhook controller: `src/integrations/message/webhooks/whatsappWebhookController.ts`
- Testes Jest cobrindo todos os itens acima
