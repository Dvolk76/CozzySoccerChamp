import type { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';
import crypto from 'crypto';

type Logger = { info: Function; warn: Function; error: Function };

// Validates Telegram WebApp initData according to official docs
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function initDataAuth(prisma: PrismaClient, logger: Logger): RequestHandler {
  return async (req, res, next) => {
    try {
      const initDataRaw = req.header('X-Telegram-Init-Data') || (req.query.initData as string) || '';
      
      if (!initDataRaw) {
        return res.status(401).json({ error: 'NO_INIT_DATA' });
      }

      const ok = verifyInitData(initDataRaw, process.env.TELEGRAM_BOT_TOKEN || '');
      if (!ok) {
        return res.status(401).json({ error: 'BAD_INIT_DATA' });
      }

      // Parse user from initData
      const params = new URLSearchParams(initDataRaw);
      const userPayload = params.get('user');
      if (!userPayload) return res.status(401).json({ error: 'NO_USER' });
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

      // Attach to req
      (req as any).authUser = dbUser;
      return next();
    } catch (err) {
      logger.error({ err }, 'initDataAuth error');
      return res.status(500).json({ error: 'INITDATA_ERROR' });
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


