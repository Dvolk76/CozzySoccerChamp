import { useEffect, useMemo, useState } from 'react';

interface LastSyncProps {
  lastUpdate: Date | null;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export function LastSync({ lastUpdate, isLoading = false }: LastSyncProps) {
  const timeText = useMemo(() => {
    if (!lastUpdate) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(lastUpdate);
  }, [lastUpdate]);

  return (
    <div className="last-sync">
      <span className="last-sync-label">
        {isLoading ? 'Синхронизация…' : 'Обновлено:'}
      </span>
      {!isLoading && lastUpdate && (
        <span className="last-sync-value">{timeText}</span>
      )}
    </div>
  );
}


