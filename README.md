# WhatsApp Cloud API SDK

SDK em TypeScript (ESM) para consumir a WhatsApp Cloud API (Meta).

## Instalação

```bash
yarn add @linkiez/whatsapp-cloud-api-sdk
```

## Uso

```ts
import { WhatsAppClient } from '@linkiez/whatsapp-cloud-api-sdk';

const client = new WhatsAppClient({
  apiVersion: 'v21.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
});

await client.sendTextMessage({
  to: '5511999999999',
  text: 'Olá!',
});
```

## Scripts

- `yarn test`
- `yarn build`
- `yarn release` (usa semantic-release)
