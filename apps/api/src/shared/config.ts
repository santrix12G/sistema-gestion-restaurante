// Lee y valida la configuración al arrancar: mejor fallar de inmediato que con la primera petición.
export interface Config {
  puerto: number;
  corsOrigins: string[];
  jwtSecret: string;
  costoDomicilio: number;
  whatsapp: {
    proveedor: 'simulado' | 'meta' | 'twilio';
    verifyToken: string;
    appSecret: string;
    accessToken: string;
    phoneNumberId: string;
    graphVersion: string;
    twilio: {
      accountSid: string;
      authToken: string;
      /** Número de WhatsApp de Twilio, por ejemplo +14155238886 en el Sandbox */
      numero: string;
      /** Dirección pública del webhook, si la calculada a partir de la petición no coincide con la que llama Twilio */
      urlWebhook: string;
    };
  };
  telegram: {
    /** Sin token, el canal de Telegram queda apagado */
    token: string;
    /** Con secreto, Telegram entrega los mensajes por webhook en lugar de sondeo */
    secretoWebhook: string;
    /** Dirección pública de la API, sin /api. En Render se toma de RENDER_EXTERNAL_URL */
    urlPublica: string;
  };
  nlp: {
    proveedor: 'reglas' | 'openai';
    openaiApiKey: string;
    openaiModelo: string;
  };
}

function exigir(env: NodeJS.ProcessEnv, variables: string[], motivo: string) {
  const faltan = variables.filter((v) => !env[v]);
  if (faltan.length) throw new Error(`${motivo} requiere ${faltan.join(', ')}. Ver apps/api/.env.example`);
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres. Ver apps/api/.env.example');
  if (!env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Ver apps/api/.env.example');

  const proveedorWhatsapp = env.WHATSAPP_PROVIDER ?? 'simulado';
  if (proveedorWhatsapp !== 'simulado' && proveedorWhatsapp !== 'meta' && proveedorWhatsapp !== 'twilio') {
    throw new Error('WHATSAPP_PROVIDER debe ser simulado, meta o twilio');
  }
  if (proveedorWhatsapp === 'meta') {
    exigir(env, ['META_VERIFY_TOKEN', 'META_APP_SECRET', 'META_ACCESS_TOKEN', 'META_PHONE_NUMBER_ID'], 'WHATSAPP_PROVIDER=meta');
  }
  if (proveedorWhatsapp === 'twilio') {
    exigir(env, ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'], 'WHATSAPP_PROVIDER=twilio');
  }

  const proveedorNlp = env.NLP_PROVIDER ?? 'reglas';
  if (proveedorNlp !== 'reglas' && proveedorNlp !== 'openai') throw new Error('NLP_PROVIDER debe ser reglas u openai');
  if (proveedorNlp === 'openai') exigir(env, ['OPENAI_API_KEY', 'OPENAI_MODEL'], 'NLP_PROVIDER=openai');

  if (env.TELEGRAM_WEBHOOK_SECRET) {
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET)) {
      throw new Error('TELEGRAM_WEBHOOK_SECRET debe tener entre 16 y 256 letras, números, - o _');
    }
    if (!env.API_PUBLIC_URL && !env.RENDER_EXTERNAL_URL) throw new Error('TELEGRAM_WEBHOOK_SECRET requiere API_PUBLIC_URL');
  }

  const costoDomicilio = Number(env.COSTO_DOMICILIO ?? 5000);
  if (!Number.isInteger(costoDomicilio) || costoDomicilio < 0) throw new Error('COSTO_DOMICILIO debe ser un entero en pesos');

  return {
    puerto: Number(env.PORT ?? 4000),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean),
    jwtSecret,
    costoDomicilio,
    whatsapp: {
      proveedor: proveedorWhatsapp,
      verifyToken: env.META_VERIFY_TOKEN ?? '',
      appSecret: env.META_APP_SECRET ?? '',
      accessToken: env.META_ACCESS_TOKEN ?? '',
      phoneNumberId: env.META_PHONE_NUMBER_ID ?? '',
      graphVersion: env.META_GRAPH_VERSION ?? 'v26.0',
      twilio: {
        accountSid: env.TWILIO_ACCOUNT_SID ?? '',
        authToken: env.TWILIO_AUTH_TOKEN ?? '',
        numero: (env.TWILIO_WHATSAPP_NUMBER ?? '').replace(/^whatsapp:/, ''),
        urlWebhook: env.TWILIO_WEBHOOK_URL ?? '',
      },
    },
    telegram: {
      token: env.TELEGRAM_BOT_TOKEN ?? '',
      secretoWebhook: env.TELEGRAM_WEBHOOK_SECRET ?? '',
      urlPublica: (env.API_PUBLIC_URL ?? env.RENDER_EXTERNAL_URL ?? '').replace(/\/+$/, ''),
    },
    nlp: {
      proveedor: proveedorNlp,
      openaiApiKey: env.OPENAI_API_KEY ?? '',
      openaiModelo: env.OPENAI_MODEL ?? '',
    },
  };
}
