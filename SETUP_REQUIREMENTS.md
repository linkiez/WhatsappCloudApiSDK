# WhatsApp (Meta) Integration Requirements (JCMserver3)

This document lists the **required setup** for:

- The **Meta/Facebook Developer App**
- The **Meta Business Manager / WhatsApp Business Account (WABA)**
- The **User / System User** permissions and tokens
- The **Server** (webhooks + env vars)
- The **JCMserver3 provider configuration** (per-tenant account config + secrets)

> Technical note: JCMserver3 is multi-tenant. WhatsApp webhooks are tenant-scoped by URL path.

---

## 1) Required Meta assets and identifiers

You will need these identifiers from Meta:

- **Meta App ID** and **App Secret**
- **Business Manager (Business ID)**
- **WhatsApp Business Account (WABA ID)**
- **WhatsApp Business Phone Number ID** (also referenced as **PHONE_NUMBER_ID** or **BUSINESS_PHONE_NUMBER_ID**)
- (Optional) **System User** (inside Business Manager) for production tokens

JCMserver3 uses these IDs as follows:

- `phoneNumberId` (required): used by the **Cloud API Messages** endpoints (`/{PHONE_NUMBER_ID}/messages`) and **Media** endpoints (`/{PHONE_NUMBER_ID}/media`).
- `wabaId` (required only for management operations): used by the **Management API** methods.
- `advanced.groupsBasePath` (required only for Groups advanced): must be the **BUSINESS_PHONE_NUMBER_ID**.
- `advanced.callingBasePath` (required only for Calling advanced): must be the **PHONE_NUMBER_ID**.

---

## 2) Facebook Developer App requirements

### 2.1 Create the app

- Create a Meta app in **developers.facebook.com**.
- Recommended app type: **Business**.
- Add the **WhatsApp** product to the app.

### 2.2 Configure basic app settings

- Add valid **App Domains** for your server.
- Provide required privacy/policy URLs if your environment requires it.

### 2.3 Webhooks configuration (WhatsApp)

You must configure a webhook callback URL and verify token.

JCMserver3 endpoints:

- Verification (GET):
  - `/webhooks/whatsapp/:tenantSchema`
- Event delivery (POST):
  - `/webhooks/whatsapp/:tenantSchema`

Backward-compatible aliases (deprecated):

- GET `/webhook/message/whatsapp/:tenantSchema`
- POST `/webhook/message/whatsapp/:tenantSchema`

Source: [src/routes/integrations/messageWebHooks_routes.ts](../../../../routes/integrations/messageWebHooks_routes.ts)

Meta will perform a verification handshake by calling the GET endpoint with:

- `hub.mode=subscribe`
- `hub.verify_token=...`
- `hub.challenge=...`

JCMserver3 verifies this using the environment variable:

- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

Multi-tenant constraint:

- Meta config accepts a single callback URL per app.
- Because JCMserver3 requires `:tenantSchema` in the path, you must either:
  - Use **one Meta app per tenant**, or
  - Use a fixed tenant schema value in the callback URL that maps to the intended tenant (e.g., via routing at the gateway level).

### 2.4 Webhook subscribed fields

At minimum, subscribe to the WhatsApp webhook fields you want to process.

JCMserver3 currently supports:

- Message status updates (`statuses[]`)
- Incoming messages (`messages[]`) (best-effort)
- Error extraction (`errors` in multiple nesting levels)

Recommended subscriptions (adjust based on your product usage):

- `messages`
- `message_template_status_update` (if using templates)
- `message_template_quality_update` (optional)

Advanced (M7) subscriptions if you enable those features:

- Calling: `calls`
- Groups: group-related fields (e.g., `group_lifecycle_update`, `group_participants_update`, `group_settings_update`, `group_status_update`)

---

## 3) Business Manager / WABA requirements

### 3.1 WABA and phone number

- Create or use an existing **WhatsApp Business Account (WABA)** inside the Business Manager.
- Add and verify a **phone number** as required by Meta.
- Collect:
  - `WABA_ID`
  - `PHONE_NUMBER_ID`

### 3.2 Business verification (production)

For production usage you will typically need:

- Business verification completed
- App review (if required by your permissions scope)

Exact requirements depend on your account status, geography, and features (Groups/Calling are often gated).

---

## 4) User / System User requirements

### 4.1 Human user (for initial setup)

A person performing the setup should have:

- Admin access to the Business Manager
- Permissions to manage the Meta app
- Permissions to manage the WABA and phone number asset

### 4.2 Production token: System User (recommended)

For production, prefer a **System User** token:

- Create a **System User** in Business Manager.
- Assign the System User access to the WABA asset and the phone number.
- Generate a token with the required permissions.

Required permissions depend on features used:

- Sending messages:
  - `whatsapp_business_messaging`

- Management endpoints (templates, phone numbers, WABA fields):
  - `whatsapp_business_management`

> Keep tokens out of logs and source control.

---

## 5) Server requirements (JCMserver3)

### 5.1 Public accessibility

- The webhook URL must be **publicly reachable** by Meta.
- HTTPS is required in most real environments.

### 5.2 Fast webhook responses

- The webhook handler should respond quickly and return HTTP **200** when processed.
- JCMserver3 does best-effort persistence and returns 200 after processing.

### 5.3 Signature verification

WhatsApp sends signature header:

- `x-hub-signature-256`

JCMserver3 verifies it using:

- `WHATSAPP_APP_SECRET`

Important behavior:

- If `WHATSAPP_APP_SECRET` is **not set**, signature verification is effectively **disabled** (requests are accepted).
- For production, you should set `WHATSAPP_APP_SECRET`.

Implementation details:

- Raw body is required for signature verification; JCMserver3 stores it in `req.rawBody` via Express JSON middleware.
- See [src/index.ts](../../../../index.ts)

---

## 6) Required environment variables

JCMserver3 requires these env vars for WhatsApp webhooks and encrypted secrets:

- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - Used by GET `/webhooks/whatsapp/:tenantSchema` verification.

- `WHATSAPP_APP_SECRET`
  - Used to validate `x-hub-signature-256` on POST webhook requests.

- `MESSAGE_SERVICE_CREDENTIALS_KEY`
  - Base64 key used to decrypt `message_channel_account.secretsEncrypted`.
  - If an account has `secretsEncrypted` but the key is missing/unusable, providers will fail with an explicit error.

---

## 7) JCMserver3 provider configuration (per tenant)

WhatsApp integration is configured via `message_channel_account` per tenant.

### 7.1 Required secrets

Store a WhatsApp access token in the account secrets.

Supported fields:

- `accessToken` (preferred)
- `token` (fallback)

These secrets are expected to be stored encrypted (`secretsEncrypted`) and decrypted at runtime.

### 7.2 Required config for Cloud API Messages + Media

Minimum required config:

```json
{
  "phoneNumberId": "<PHONE_NUMBER_ID>",
  "apiVersion": "v20.0",
  "baseUrl": "https://graph.facebook.com"
}
```

- `phoneNumberId` is mandatory.
- `apiVersion` and `baseUrl` are optional (defaults shown above).

Used by:

- `WhatsAppCloudProvider` (messages)
- `WhatsAppMediaService` (media)

### 7.3 Optional config for M7 Advanced (Groups/Calling)

Advanced features are **disabled by default** and require explicit opt-in:

```json
{
  "advanced": {
    "enabled": true,
    "groupsBasePath": "<BUSINESS_PHONE_NUMBER_ID>",
    "callingBasePath": "<PHONE_NUMBER_ID>"
  }
}
```

Notes:

- `groupsBasePath` must be the **BUSINESS_PHONE_NUMBER_ID**.
- `callingBasePath` must be the **PHONE_NUMBER_ID**.
- Some Groups endpoints are rooted at `/{GROUP_ID}` (not under the phone number). JCMserver3 supports this internally via a base path override.

---

## 8) WhatsApp Management operations (templates / phone numbers / analytics)

Management methods require a `wabaId` argument at call time (not stored in config).

You will need:

- `WABA_ID`
- Token with `whatsapp_business_management`

---

## 9) Operational checklist

Before going live:

- [ ] Meta app created, WhatsApp product enabled
- [ ] WABA created/selected and phone number connected
- [ ] Token available (prefer System User for production)
- [ ] Webhook configured in Meta:
  - [ ] Callback URL points to `/webhooks/whatsapp/:tenantSchema`
  - [ ] Verify token matches `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - [ ] Subscribed fields defined

- [ ] Server env vars set:
  - [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - [ ] `WHATSAPP_APP_SECRET`
  - [ ] `MESSAGE_SERVICE_CREDENTIALS_KEY`

- [ ] `message_channel_account` created for each tenant with:
  - [ ] `config.phoneNumberId`
  - [ ] encrypted secrets containing `accessToken`
  - [ ] (optional) `config.advanced.enabled` + base paths

---

## 10) Troubleshooting

- Verification returns 403
  - Check `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and the value configured in Meta.

- Webhook POST returns 401
  - Signature mismatch: verify `WHATSAPP_APP_SECRET` and ensure the request raw body is preserved.

- Provider fails with "Credenciais do WhatsApp não configuradas"
  - Missing `accessToken`/`token` in account secrets or decryption failed.

- Provider fails with "Chave de credenciais do Message Service não configurada"
  - `secretsEncrypted` exists but `MESSAGE_SERVICE_CREDENTIALS_KEY` is missing.
