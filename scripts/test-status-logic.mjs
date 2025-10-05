#!/usr/bin/env node

/**
 * Простой тест логики статусов матчей
 */

function getMatchStatus(match) {
  const now = new Date();
  const matchTime = new Date(match.kickoffAt);
  const minutesFromKickoff = Math.max(0, Math.floor((now.getTime() - matchTime.getTime()) / 60000));
  const hasScore = match.scoreHome !== null && match.scoreAway !== null;
  
  // Консервативные пороги
  const HOURS_AGO_THRESHOLD = 180; // 3 часа в минутах
  const MAX_MATCH_DURATION = 240; // 4 часа в минутах
  
  // Если матч был более 3 часов назад и есть счет, считаем его завершенным
  if (minutesFromKickoff >= HOURS_AGO_THRESHOLD && hasScore) {
    return { text: 'Завершен', class: 'finished', isLive: false, isFinished: true };
  }
  
  // Если матч был более 4 часов назад, считаем его завершенным независимо от статуса
  if (minutesFromKickoff >= MAX_MATCH_DURATION) {
    return { text: 'Завершен', class: 'finished', isLive: false, isFinished: true };
  }
  
  // Обрабатываем статусы
  switch (match.status) {
    case 'SCHEDULED':
      return { text: 'Запланирован', class: 'scheduled', isLive: false, isFinished: false };
    
    case 'TIMED': {
      // TIMED означает, что у матча есть запланированное время, но он еще не начался
      if (now >= matchTime) {
        // Время наступило, но матч еще не перешел в IN_PLAY - считаем начатым
        return { text: 'Начат', class: 'live', isLive: true, isFinished: false };
      } else {
        // Время еще не наступило - матч запланирован
        return { text: 'Запланирован', class: 'scheduled', isLive: false, isFinished: false };
      }
    }
    
    case 'IN_PLAY':
    case 'LIVE':
      return { text: 'В игре', class: 'live', isLive: true, isFinished: false };
    
    case 'PAUSED':
      return { text: 'Пауза', class: 'paused', isLive: true, isFinished: false };
    
    case 'FINISHED':
      return { text: 'Завершен', class: 'finished', isLive: false, isFinished: true };
    
    case 'POSTPONED':
      return { text: 'Отложен', class: 'postponed', isLive: false, isFinished: false };
    
    case 'SUSPENDED':
      return { text: 'Приостановлен', class: 'suspended', isLive: false, isFinished: false };
    
    case 'CANCELLED':
      return { text: 'Отменен', class: 'cancelled', isLive: false, isFinished: false };
    
    case 'AWARDED':
      return { text: 'Присужден', class: 'awarded', isLive: false, isFinished: true };
    
    case 'NO_PLAY':
      return { text: 'Не состоялся', class: 'no-play', isLive: false, isFinished: false };
    
    default:
      if (hasScore) {
        return { text: 'Завершен', class: 'finished', isLive: false, isFinished: true };
      }
      if (now >= matchTime) {
        return { text: 'В игре', class: 'live', isLive: true, isFinished: false };
      }
      return { text: 'Запланирован', class: 'scheduled', isLive: false, isFinished: false };
  }
}

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
    status: 'TIMED',
    kickoffAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // через 2 часа (будущий)
    scoreHome: null,
    scoreAway: null
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
  
  console.log(`   Результат: ${status.text} (${status.class})`);
  console.log(`   Активен: ${status.isLive ? '✅' : '❌'}`);
  console.log(`   Завершен: ${status.isFinished ? '✅' : '❌'}`);
  console.log('');
});

console.log('🎉 Тестирование завершено!');
