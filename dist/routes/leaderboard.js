export function registerLeaderboardRoutes(app, prisma, logger) {
    // Global leaderboard (cached)
    app.get('/api/leaderboard', async (req, res) => {
        try {
            const cachedDataService = req.cachedDataService;
            if (!cachedDataService) {
                // Fallback to direct DB query if cache service not available
                const items = await prisma.score.findMany({
                    include: { user: true },
                    orderBy: [
                        { pointsTotal: 'desc' },
                        { exactCount: 'desc' },
                        { diffCount: 'desc' },
                        { firstPredAt: 'asc' },
                    ],
                    take: 100,
                });
                return res.json({ leaderboard: items });
            }
            const leaderboard = await cachedDataService.getLeaderboard();
            res.json({ leaderboard });
        }
        catch (error) {
            logger.error({ error }, 'Failed to get leaderboard');
            res.status(500).json({ error: 'Failed to get leaderboard' });
        }
    });
}
