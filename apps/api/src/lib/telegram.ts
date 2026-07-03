// Telegram Bot API yardımcıları (grammY'den bağımsız basit fetch)
// Bot token doğrulama + webhook ayarlama için kullanılır.

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

const TG_API = 'https://api.telegram.org/bot';

export async function callTelegram<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TG_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as TelegramResponse<T>;

  if (!data.ok || data.result === undefined) {
    throw new TelegramError(
      data.description ?? 'Bilinmeyen Telegram hatası',
      data.error_code ?? 0,
    );
  }

  return data.result;
}

export class TelegramError extends Error {
  constructor(message: string, public code: number) {
    super(message);
    this.name = 'TelegramError';
  }
}

export async function getBotInfo(token: string): Promise<TelegramBotInfo> {
  return callTelegram<TelegramBotInfo>(token, 'getMe');
}

export async function setBotWebhook(
  token: string,
  url: string,
  secretToken?: string,
): Promise<boolean> {
  return callTelegram<boolean>(token, 'setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: [
      'message',
      'callback_query',
      'chat_join_request',
      'chat_member',
      'my_chat_member',
    ],
  });
}

export async function deleteBotWebhook(token: string): Promise<boolean> {
  return callTelegram<boolean>(token, 'deleteWebhook', {
    drop_pending_updates: false,
  });
}
