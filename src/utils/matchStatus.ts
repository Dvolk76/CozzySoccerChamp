/**
 * Утилиты для работы со статусами матчей
 * Основано на официальной документации Football Data API v4
 * https://www.football-data.org/documentation/api
 */

export interface MatchStatusInfo {
  text: string;
  class: string;
  isLive: boolean;
  isFinished: boolean;
  isScheduled: boolean;
}

/**
 * Определяет статус матча на основе данных из Football Data API
 * @param match - объект матча с полями status, kickoffAt, scoreHome, scoreAway
 * @returns информация о статусе матча
 */
export function getMatchStatus(match: {
  status: string;
  kickoffAt: string | Date;
  scoreHome?: number | null;
  scoreAway?: number | null;
}): MatchStatusInfo {
  const now = new Date();
  const matchTime = new Date(match.kickoffAt);
  const minutesFromKickoff = Math.max(0, Math.floor((now.getTime() - matchTime.getTime()) / 60000));
  const hasScore = match.scoreHome != null && match.scoreAway != null;
  
  // ВАЖНО: Если есть счет и матч уже начался (время наступило), считаем его завершенным
  // Это гарантирует, что матч с fullTime score отображается как завершенный
  if (hasScore && now >= matchTime && match.status !== 'SCHEDULED' && match.status !== 'TIMED') {
    return {
      text: 'Завершен',
      class: 'finished',
      isLive: false,
      isFinished: true,
      isScheduled: false
    };
  }
  
  // Консервативные пороги для определения завершения матча
  const FINISH_MINUTES_HARD = 155;      // ~2h35m от начала (покрывает ET + остановки)
  const FINISH_MINUTES_WITH_SCORE = 135; // ~2h15m если есть счет
  const HOURS_AGO_THRESHOLD = 180;      // 3 часа в минутах
  const MAX_MATCH_DURATION = 240;       // 4 часа в минутах
  
  // Если матч был более 3 часов назад и есть счет, считаем его завершенным
  if (minutesFromKickoff >= HOURS_AGO_THRESHOLD && hasScore) {
    return {
      text: 'Завершен',
      class: 'finished',
      isLive: false,
      isFinished: true,
      isScheduled: false
    };
  }
  
  // Если матч был более 4 часов назад, считаем его завершенным независимо от статуса
  if (minutesFromKickoff >= MAX_MATCH_DURATION) {
    return {
      text: 'Завершен',
      class: 'finished',
      isLive: false,
      isFinished: true,
      isScheduled: false
    };
  }
  
  // Обрабатываем все возможные статусы Football Data API v4
  switch (match.status) {
    case 'SCHEDULED':
      return {
        text: 'Запланирован',
        class: 'scheduled',
        isLive: false,
        isFinished: false,
        isScheduled: true
      };
    
    case 'TIMED': {
      // TIMED означает, что у матча есть запланированное время, но он еще не начался
      if (now >= matchTime) {
        // Время наступило, но матч еще не перешел в IN_PLAY - считаем начатым
        return {
          text: 'Начат',
          class: 'live',
          isLive: true,
          isFinished: false,
          isScheduled: false
        };
      } else {
        // Время еще не наступило - матч запланирован
        return {
          text: 'Запланирован',
          class: 'scheduled',
          isLive: false,
          isFinished: false,
          isScheduled: true
        };
      }
    }
    
    case 'IN_PLAY':
      return {
        text: 'В игре',
        class: 'live',
        isLive: true,
        isFinished: false,
        isScheduled: false
      };
    
    case 'LIVE':
      return {
        text: 'В игре',
        class: 'live',
        isLive: true,
        isFinished: false,
        isScheduled: false
      };
    
    case 'PAUSED': {
      // Некоторые источники оставляют PAUSED долго после FT
      if (minutesFromKickoff >= FINISH_MINUTES_HARD || (hasScore && minutesFromKickoff >= FINISH_MINUTES_WITH_SCORE)) {
        return {
          text: 'Завершен',
          class: 'finished',
          isLive: false,
          isFinished: true,
          isScheduled: false
        };
      }
      return {
        text: 'Пауза',
        class: 'paused',
        isLive: true,
        isFinished: false,
        isScheduled: false
      };
    }
    
    case 'FINISHED':
      return {
        text: 'Завершен',
        class: 'finished',
        isLive: false,
        isFinished: true,
        isScheduled: false
      };
    
    case 'POSTPONED':
      return {
        text: 'Отложен',
        class: 'postponed',
        isLive: false,
        isFinished: false,
        isScheduled: true
      };
    
    case 'SUSPENDED':
      return {
        text: 'Приостановлен',
        class: 'suspended',
        isLive: false,
        isFinished: false,
        isScheduled: false
      };
    
    case 'CANCELLED':
      return {
        text: 'Отменен',
        class: 'cancelled',
        isLive: false,
        isFinished: false,
        isScheduled: false
      };
    
    case 'AWARDED':
      return {
        text: 'Присужден',
        class: 'awarded',
        isLive: false,
        isFinished: true,
        isScheduled: false
      };
    
    case 'NO_PLAY':
      return {
        text: 'Не состоялся',
        class: 'no-play',
        isLive: false,
        isFinished: false,
        isScheduled: false
      };
    
    default:
      // Если статус неизвестен, определяем по времени и наличию счета
      if (hasScore) {
        return {
          text: 'Завершен',
          class: 'finished',
          isLive: false,
          isFinished: true,
          isScheduled: false
        };
      }
      
      if (now >= matchTime) {
        return {
          text: 'В игре',
          class: 'live',
          isLive: true,
          isFinished: false,
          isScheduled: false
        };
      }
      
      return {
        text: 'Запланирован',
        class: 'scheduled',
        isLive: false,
        isFinished: false,
        isScheduled: true
      };
  }
}

/**
 * Проверяет, можно ли делать ставки на матч
 * @param match - объект матча
 * @returns true если можно делать ставки
 */
export function canBetOnMatch(match: {
  status: string;
  kickoffAt: string | Date;
}): boolean {
  const now = new Date();
  const matchTime = new Date(match.kickoffAt);
  
  // Нельзя делать ставки после начала матча
  if (now >= matchTime) {
    return false;
  }
  
  // Нельзя делать ставки на отмененные, отложенные или приостановленные матчи
  const blockedStatuses = ['CANCELLED', 'POSTPONED', 'SUSPENDED', 'AWARDED', 'NO_PLAY'];
  if (blockedStatuses.includes(match.status)) {
    return false;
  }
  
  return true;
}

/**
 * Проверяет, является ли матч активным (в игре или паузе)
 * @param match - объект матча
 * @returns true если матч активен
 */
export function isMatchActive(match: {
  status: string;
  kickoffAt: string | Date;
}): boolean {
  const statusInfo = getMatchStatus(match);
  return statusInfo.isLive;
}

/**
 * Проверяет, завершен ли матч
 * @param match - объект матча
 * @returns true если матч завершен
 */
export function isMatchFinished(match: {
  status: string;
  kickoffAt: string | Date;
}): boolean {
  const statusInfo = getMatchStatus(match);
  return statusInfo.isFinished;
}
