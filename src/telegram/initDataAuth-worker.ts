import type { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

type Logger = { info: Function; warn: Function; error: Function };

// Validates Telegram WebApp initData for Cloudflare Workers
export async function initDataAuth(
  prisma: PrismaClient, 
  logger: Logger,
  env: any
) {
  return async (request: Request): Promise<{ user: any } | Response> => {
    try {
      const url = new URL(request.url);
      const initDataRaw = request.headers.get('X-Telegram-Init-Data') || 
                         url.searchParams.get('initData') || '';
      
      logger.info('Auth check:', { 
        hasInitData: !!initDataRaw
      });
      
      if (!initDataRaw) {
        return new Response(JSON.stringify({ error: 'NO_INIT_DATA' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const ok = verifyInitData(initDataRaw, env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '');
      if (!ok) {
        return new Response(JSON.stringify({ error: 'BAD_INIT_DATA' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Parse user from initData
      const params = new URLSearchParams(initDataRaw);
      const userPayload = params.get('user');
      if (!userPayload) {
        return new Response(JSON.stringify({ error: 'NO_USER' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const user = JSON.parse(userPayload);

      const tgUserId: string = String(user.id);
      const name: string = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Unknown';
      const avatar: string | null = user.photo_url || null;

      // Upsert minimal user
      const dbUser = await prisma.user.upsert({
        where: { tg_user_id: tgUserId },
        create: { tg_user_id: tgUserId, name, avatar: avatar ?? undefined },
        update: { name, avatar: avatar ?? undefined },
      });

      return { user: dbUser };
    } catch (err) {
      logger.error({ err, stack: err instanceof Error ? err.stack : 'Unknown' }, 'initDataAuth error');
      
      return new Response(JSON.stringify({ error: 'INITDATA_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

export function verifyInitData(initData: string, botToken: string): boolean {
  if (!botToken) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');

  // Build data-check-string
  const entries = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`);
  entries.sort();
  const dataCheckString = entries.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const signature = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return signature === hash;
}
