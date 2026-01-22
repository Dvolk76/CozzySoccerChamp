import { useMemo, useState } from 'react';
import { LeaderboardItem } from '../components/LeaderboardItem';
import { useLeaderboard, useLeaderboardByRounds } from '../hooks/useData';
import { LastSync } from '../components/LastSync';
import type { LeaderboardItem as LeaderboardItemType } from '../types';
import { haptic } from '../utils/haptic';
import { getInitials } from '../utils/avatar';

export function LeaderboardView() {
  try {
    const { leaderboard, loading: loadingOverall, error: errorOverall, refresh, isPolling, lastUpdate } = useLeaderboard(true);
    const { rounds, loading: loadingRounds, error: errorRounds } = useLeaderboardByRounds(false);
    
    const [viewMode, setViewMode] = useState<'overall' | 'rounds'>('overall');
    const [selectedRound, setSelectedRound] = useState<number | null>(null);

    const leaderboardWithRank = useMemo(() => {
      return leaderboard.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
    }, [leaderboard]);

    // Sorted rounds in reverse order (latest first)
    const sortedRounds = useMemo(() => {
      return [...rounds].sort((a, b) => b.round - a.round);
    }, [rounds]);

    // Set initial selected round when rounds data loads
    useMemo(() => {
      if (sortedRounds.length > 0 && selectedRound === null) {
        setSelectedRound(sortedRounds[0].round);
      }
    }, [sortedRounds, selectedRound]);

    const loading = viewMode === 'overall' ? loadingOverall : loadingRounds;
    const error = viewMode === 'overall' ? errorOverall : errorRounds;

    if (loading) {
      return <div className="loading">Загрузка лидерборда...</div>;
    }

    if (error) {
      return (
        <div className="error">
          {error}
          <button onClick={() => {
            haptic.light();
            refresh();
          }} style={{ marginLeft: '8px' }}>
            Повторить
          </button>
        </div>
      );
    }

    if (viewMode === 'overall' && leaderboardWithRank.length === 0) {
      return (
        <div className="loading">
          Нет данных о лидерах. Сделайте прогнозы и дождитесь результатов матчей.
        </div>
      );
    }

    const currentRoundData = sortedRounds.find(r => r.round === selectedRound);

    return (
      <div>
        <LastSync lastUpdate={lastUpdate} isLoading={isPolling} />
        
        {/* View mode switcher */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '1px solid var(--tg-theme-hint-color, #999)',
          paddingBottom: '8px'
        }}>
          <button
            onClick={() => {
              haptic.selection();
              setViewMode('overall');
            }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: viewMode === 'overall' 
                ? 'var(--tg-theme-button-color, #3390ec)' 
                : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
              color: viewMode === 'overall' 
                ? 'var(--tg-theme-button-text-color, #fff)' 
                : 'var(--tg-theme-text-color, #000)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Общий зачет
          </button>
          <button
            onClick={() => {
              haptic.selection();
              setViewMode('rounds');
            }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: viewMode === 'rounds' 
                ? 'var(--tg-theme-button-color, #3390ec)' 
                : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
              color: viewMode === 'rounds' 
                ? 'var(--tg-theme-button-text-color, #fff)' 
                : 'var(--tg-theme-text-color, #000)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            По турам
          </button>
        </div>

        {/* Overall leaderboard */}
        {viewMode === 'overall' && (
          <div>
            {leaderboardWithRank.map((item) => (
              <LeaderboardItem key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Rounds leaderboard */}
        {viewMode === 'rounds' && (
          <div>
            {sortedRounds.length === 0 ? (
              <div className="loading">
                Нет завершенных туров для отображения.
              </div>
            ) : (
              <>
                {/* Round selector */}
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  marginBottom: '16px',
                  overflowX: 'auto',
                  paddingBottom: '8px'
                }}>
                  {sortedRounds.map(round => (
                    <button
                      key={round.round}
                      onClick={() => {
                        haptic.selection();
                        setSelectedRound(round.round);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: selectedRound === round.round 
                          ? 'var(--tg-theme-button-color, #3390ec)' 
                          : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                        color: selectedRound === round.round 
                          ? 'var(--tg-theme-button-text-color, #fff)' 
                          : 'var(--tg-theme-text-color, #000)',
                        border: 'none',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s'
                      }}
                    >
                      Тур {round.round}
                    </button>
                  ))}
                </div>

                {/* Round leaderboard */}
                {currentRoundData && (
                  <div>
                    <div style={{
                      marginBottom: '12px',
                      padding: '12px',
                      backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--tg-theme-hint-color, #999)'
                    }}>
                      Показаны результаты {currentRoundData.round}-го тура. 
                      Очки за тур отображаются слева, общий счет справа.
                    </div>
                    
                    {currentRoundData.leaderboard.map((entry, index) => (
                      <div
                        key={entry.userId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          marginBottom: '8px',
                          backgroundColor: 'var(--tg-theme-bg-color, #fff)',
                          borderRadius: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                      >
                        {/* Rank */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: index < 3 
                            ? ['#FFD700', '#C0C0C0', '#CD7F32'][index] 
                            : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                          color: index < 3 ? '#000' : 'var(--tg-theme-text-color, #000)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          marginRight: '12px',
                          flexShrink: 0
                        }}>
                          {index + 1}
                        </div>

                        {/* Avatar */}
                        <div className="leaderboard-avatar-wrapper">
                          {entry.userAvatar ? (
                            <img
                              src={entry.userAvatar}
                              alt={entry.userName}
                              className="leaderboard-avatar"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="leaderboard-avatar-fallback">{getInitials(entry.userName)}</span>
                          )}
                        </div>

                        {/* User info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: '600',
                            fontSize: '15px',
                            color: 'var(--tg-theme-text-color, #000)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {entry.userName}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--tg-theme-hint-color, #999)',
                            marginTop: '2px'
                          }}>
                            {entry.exactCount > 0 && `${entry.exactCount}×5 `}
                            {entry.diffCount > 0 && `${entry.diffCount}×3 `}
                            {entry.outcomeCount > 0 && `${entry.outcomeCount}×2`}
                          </div>
                        </div>

                        {/* Points for this round */}
                        <div style={{
                          textAlign: 'right',
                          marginRight: '16px'
                        }}>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: 'var(--tg-theme-button-color, #3390ec)'
                          }}>
                            {entry.points}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--tg-theme-hint-color, #999)'
                          }}>
                            за тур
                          </div>
                        </div>

                        {/* Cumulative points */}
                        <div style={{
                          textAlign: 'right',
                          paddingLeft: '16px',
                          borderLeft: '1px solid var(--tg-theme-hint-color, #ddd)'
                        }}>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: 'var(--tg-theme-text-color, #000)'
                          }}>
                            {entry.cumulativePoints}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--tg-theme-hint-color, #999)'
                          }}>
                            всего
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error('LeaderboardView crashed:', error);
    return (
      <div>
        <div className="error">
          Произошла ошибка при загрузке лидерборда. 
          <button onClick={() => window.location.reload()} style={{ marginLeft: '8px' }}>
            Перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }
}
