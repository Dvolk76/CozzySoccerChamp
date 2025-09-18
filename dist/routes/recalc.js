export function registerRecalcRoutes(app, prisma, logger) {
    app.post('/api/admin/recalc/:matchId', async (req, res) => {
        const user = req.authUser;
        if (!user || user.role !== 'ADMIN')
            return res.status(403).json({ error: 'FORBIDDEN' });
        const { recalcForMatch } = await import('../services/recalc.js');
        const result = await recalcForMatch(prisma, req.params.matchId);
        res.json(result);
    });
    app.post('/api/admin/recalc-all', async (req, res) => {
        const user = req.authUser;
        if (!user || user.role !== 'ADMIN')
            return res.status(403).json({ error: 'FORBIDDEN' });
        const { recalcAll } = await import('../services/recalc.js');
        const result = await recalcAll(prisma);
        res.json(result);
    });
}
