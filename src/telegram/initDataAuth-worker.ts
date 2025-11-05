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
        hasInitData: !!initDataRaw, 
        bypassEnv: env?.TG_INIT_BYPASS,
        bypassProcess: process.env.TG_INIT_BYPASS 
      });
      
      // Dev bypass: allow access when TG_INIT_BYPASS=1  
      const DEV_BYPASS_ENABLED = env?.TG_INIT_BYPASS === '1' || process.env.TG_INIT_BYPASS === '1';
      
      if (DEV_BYPASS_ENABLED) {
        logger.info('Development mode: creating test user', { hasInitData: !!initDataRaw });
        const testUser = await prisma.user.upsert({
          where: { tg_user_id: 'dev_user_123' },
          create: { 
            tg_user_id: 'dev_user_123', 
            name: 'Test User', 
            avatar: undefined 
          },
          update: {},
        });
        return { user: testUser };
      }
      
      if (!initDataRaw) {
        return new Response(JSON.stringify({ error: 'NO_INIT_DATA' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const ok = verifyInitData(initDataRaw, env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '');
      if (!ok) {
        if (DEV_BYPASS_ENABLED) {
          logger.warn('DEV bypass: BAD_INIT_DATA, skipping verification');
        } else {
          return new Response(JSON.stringify({ error: 'BAD_INIT_DATA' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
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
      
      // Debug: log avatar info
      logger.info('User auth:', { 
        tgUserId, 
        name, 
        hasPhotoUrl: !!user.photo_url,
        photoUrl: user.photo_url 
      });

      // Upsert minimal user
      const dbUser = await prisma.user.upsert({
        where: { tg_user_id: tgUserId },
        create: { tg_user_id: tgUserId, name, avatar: avatar ?? undefined },
        update: { name, avatar: avatar ?? undefined },
      });

      return { user: dbUser };
    } catch (err) {
      logger.error({ err, stack: err instanceof Error ? err.stack : 'Unknown' }, 'initDataAuth error');
      
      // In dev mode, return more detailed error
      const DEV_BYPASS_ENABLED = env?.TG_INIT_BYPASS === '1' || process.env.TG_INIT_BYPASS === '1';
      if (DEV_BYPASS_ENABLED) {
        return new Response(JSON.stringify({ 
          error: 'INITDATA_ERROR', 
          details: err instanceof Error ? err.message : 'Unknown error',
          devMode: true
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
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
