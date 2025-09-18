import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { initDataAuth } from './telegram/initDataAuth.js';
import { registerRoutes } from './routes/index.js';
import { initializeCache, CachedDataService } from './services/cache.js';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
const prisma = new PrismaClient();
// Basic security and parsing
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data'],
}));
app.use(express.json());
// Serve static files - old test page and new React app
app.use('/test', express.static('public'));
app.use(express.static('client/dist'));
// Minimal session for AdminJS (cookie-based)
app.use(session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
}));
// Health
app.get('/health', (_req, res) => res.json({ ok: true }));
// Initialize cache system
const cache = initializeCache(prisma, logger);
const cachedDataService = new CachedDataService(cache, prisma, logger);
// Telegram initData auth middleware for API routes under /api
app.use('/api', initDataAuth(prisma, logger));
// Make cache service available to routes
app.use('/api', (req, _res, next) => {
    req.cachedDataService = cachedDataService;
    next();
});
registerRoutes(app, prisma, logger);
// Start automatic data synchronization
const startAutoSync = () => {
    const season = new Date().getFullYear();
    // Sync immediately on startup
    setTimeout(async () => {
        try {
            logger.info('Starting initial API sync...');
            await cachedDataService.syncMatchesFromAPI(season);
            logger.info('Initial API sync completed');
        }
        catch (error) {
            logger.error({ error }, 'Initial API sync failed');
        }
    }, 5000); // Wait 5 seconds after startup
    // Then sync every minute
    setInterval(async () => {
        try {
            logger.info('Running scheduled API sync...');
            await cachedDataService.syncMatchesFromAPI(season);
            logger.info('Scheduled API sync completed');
        }
        catch (error) {
            logger.error({ error }, 'Scheduled API sync failed');
        }
    }, 60000); // Every minute
    logger.info('Auto-sync scheduler started (every 60 seconds)');
};
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
    logger.info({ port }, 'Server started');
    startAutoSync();
});
