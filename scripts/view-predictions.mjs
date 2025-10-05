#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function viewPredictions() {
  try {
    console.log('🔍 Просмотр ставок игроков...\n');

    // Получаем все ставки с информацией о пользователях и матчах
    const predictions = await prisma.prediction.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            tg_user_id: true,
            createdAt: true
          }
        },
        match: {
          select: {
            id: true,
            homeTeam: true,
            awayTeam: true,
            kickoffAt: true,
            status: true,
            scoreHome: true,
            scoreAway: true,
            stage: true,
            group: true,
            matchday: true
          }
        }
      },
      orderBy: [
        { match: { kickoffAt: 'asc' } },
        { user: { name: 'asc' } }
      ]
    });

    if (predictions.length === 0) {
      console.log('❌ Ставки не найдены');
      return;
    }

    console.log(`📊 Найдено ${predictions.length} ставок от ${new Set(predictions.map(p => p.user.id)).size} игроков\n`);

    // Группируем по матчам
    const matchesMap = new Map();
    
    predictions.forEach(pred => {
      const matchId = pred.match.id;
      if (!matchesMap.has(matchId)) {
        matchesMap.set(matchId, {
          match: pred.match,
          predictions: []
        });
      }
      matchesMap.get(matchId).predictions.push(pred);
    });

    // Выводим информацию по матчам
    for (const [matchId, matchData] of matchesMap) {
      const { match, predictions } = matchData;
      
      console.log(`⚽ ${match.homeTeam} vs ${match.awayTeam}`);
      console.log(`   📅 ${new Date(match.kickoffAt).toLocaleString('ru-RU')}`);
      console.log(`   🏆 ${match.stage}${match.group ? ` (${match.group})` : ''}${match.matchday ? ` - Тур ${match.matchday}` : ''}`);
      console.log(`   📊 Статус: ${match.status}`);
      
      if (match.scoreHome !== null && match.scoreAway !== null) {
        console.log(`   🥅 Результат: ${match.scoreHome}:${match.scoreAway}`);
      }
      
      console.log(`   👥 Ставки (${predictions.length}):`);
      
      predictions.forEach(pred => {
        const result = match.scoreHome !== null && match.scoreAway !== null 
          ? ` (результат: ${match.scoreHome}:${match.scoreAway})`
          : '';
        
        console.log(`      ${pred.user.name}: ${pred.predHome}:${pred.predAway}${result}`);
      });
      
      console.log('');
    }

    // Статистика по игрокам
    console.log('📈 Статистика по игрокам:');
    const userStats = new Map();
    
    predictions.forEach(pred => {
      const userId = pred.user.id;
      if (!userStats.has(userId)) {
        userStats.set(userId, {
          name: pred.user.name,
          totalPredictions: 0,
          matches: new Set()
        });
      }
      
      const stats = userStats.get(userId);
      stats.totalPredictions++;
      stats.matches.add(pred.match.id);
    });

    for (const [userId, stats] of userStats) {
      console.log(`   ${stats.name}: ${stats.totalPredictions} ставок в ${stats.matches.size} матчах`);
    }

  } catch (error) {
    console.error('❌ Ошибка при получении данных:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
viewPredictions();
