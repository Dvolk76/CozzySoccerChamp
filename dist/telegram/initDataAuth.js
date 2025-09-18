import crypto from 'crypto';
// Validates Telegram WebApp initData according to official docs
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function initDataAuth(prisma, logger) {
    return async (req, res, next) => {
        try {
            const initDataRaw = req.header('X-Telegram-Init-Data') || req.query.initData || '';
            // Dev bypass: allow access without init data when TG_INIT_BYPASS=1
            if (!initDataRaw && process.env.TG_INIT_BYPASS === '1') {
                logger.info('Development mode: creating test user');
                const testUser = await prisma.user.upsert({
                    where: { tg_user_id: 'dev_user_123' },
                    create: {
                        tg_user_id: 'dev_user_123',
                        name: 'Test User',
                        avatar: undefined
                    },
                    update: {},
                });
                req.authUser = testUser;
                return next();
            }
            if (!initDataRaw) {
                if (process.env.TG_INIT_BYPASS === '1') {
                    logger.warn('DEV bypass: NO_INIT_DATA, creating test user');
                    const testUser = await prisma.user.upsert({
                        where: { tg_user_id: 'dev_user_123' },
                        create: { tg_user_id: 'dev_user_123', name: 'Test User', avatar: undefined },
                        update: {},
                    });
                    req.authUser = testUser;
                    return next();
                }
                return res.status(401).json({ error: 'NO_INIT_DATA' });
            }
            const ok = verifyInitData(initDataRaw, process.env.TELEGRAM_BOT_TOKEN || '');
            if (!ok) {
                if (process.env.TG_INIT_BYPASS === '1') {
                    logger.warn('DEV bypass: BAD_INIT_DATA, skipping verification');
                }
                else {
                    return res.status(401).json({ error: 'BAD_INIT_DATA' });
                }
            }
            // Parse user from initData
            const params = new URLSearchParams(initDataRaw);
            const userPayload = params.get('user');
            if (!userPayload)
                return res.status(401).json({ error: 'NO_USER' });
            const user = JSON.parse(userPayload);
            const tgUserId = String(user.id);
            const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Unknown';
            const avatar = user.photo_url || null;
            // Upsert minimal user
            const dbUser = await prisma.user.upsert({
                where: { tg_user_id: tgUserId },
                create: { tg_user_id: tgUserId, name, avatar: avatar ?? undefined },
                update: { name, avatar: avatar ?? undefined },
            });
            // Attach to req
            req.authUser = dbUser;
            return next();
        }
        catch (err) {
            logger.error({ err }, 'initDataAuth error');
            return res.status(500).json({ error: 'INITDATA_ERROR' });
        }
    };
}
export function verifyInitData(initData, botToken) {
    if (!botToken)
        return false;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash)
        return false;
    params.delete('hash');
    // Build data-check-string
    const entries = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`);
    entries.sort();
    const dataCheckString = entries.join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const signature = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    return signature === hash;
}
