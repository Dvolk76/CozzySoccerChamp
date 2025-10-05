#!/usr/bin/env node

import { getMatchStatus, canBetOnMatch, isMatchActive, isMatchFinished } from '../client/src/utils/matchStatus.js';

/**
 * Тестирование новой логики статусов матчей
 */

console.log('🧪 Тестирование логики статусов матчей...\n');

// Тестовые данные
const testMatches = [
  {
    status: 'SCHEDULED',
    kickoffAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // завтра
    scoreHome: null,
    scoreAway: null
  },
  {
    status: 'TIMED',
    kickoffAt: new Date(Date.now() - 30 * 60 * 1000), // 30 минут назад
    scoreHome: 1,
    scoreAway: 0
  },
  {
    status: 'IN_PLAY',
    kickoffAt: new Date(Date.now() - 60 * 60 * 1000), // 1 час назад
    scoreHome: 2,
    scoreAway: 1
  },
  {
    status: 'PAUSED',
    kickoffAt: new Date(Date.now() - 90 * 60 * 1000), // 1.5 часа назад
    scoreHome: 1,
    scoreAway: 1
  },
  {
    status: 'FINISHED',
    kickoffAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 часа назад
    scoreHome: 3,
    scoreAway: 2
  },
  {
    status: 'TIMED',
    kickoffAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 часов назад (старый)
    scoreHome: null,
    scoreAway: null
  },
  {
    status: 'POSTPONED',
    kickoffAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // через 2 часа
    scoreHome: null,
    scoreAway: null
  },
  {
    status: 'CANCELLED',
    kickoffAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // через 3 часа
    scoreHome: null,
    scoreAway: null
  },
  {
    status: 'AWARDED',
    kickoffAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 часа назад
    scoreHome: 3,
    scoreAway: 0
  },
  {
    status: 'NO_PLAY',
    kickoffAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 часа назад
    scoreHome: null,
    scoreAway: null
  }
];

testMatches.forEach((match, index) => {
  console.log(`📋 Тест ${index + 1}: ${match.status}`);
  console.log(`   Время: ${match.kickoffAt.toLocaleString('ru-RU')}`);
  console.log(`   Счет: ${match.scoreHome || '?'}:${match.scoreAway || '?'}`);
  
  const status = getMatchStatus(match);
  const canBet = canBetOnMatch(match);
  const isActive = isMatchActive(match);
  const isFinished = isMatchFinished(match);
  
  console.log(`   Статус: ${status.text} (${status.class})`);
  console.log(`   Можно ставить: ${canBet ? '✅' : '❌'}`);
  console.log(`   Активен: ${isActive ? '✅' : '❌'}`);
  console.log(`   Завершен: ${isFinished ? '✅' : '❌'}`);
  console.log('');
});

console.log('🎉 Тестирование завершено!');
