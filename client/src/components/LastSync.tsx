import { useEffect, useMemo, useState } from 'react';

interface LastSyncProps {
  lastUpdate: Date | null;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export function LastSync({ lastUpdate, isLoading = false, onRefresh }: LastSyncProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const text = useMemo(() => {
    if (!lastUpdate) return '—';
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - lastUpdate.getTime()) / 1000));
    if (diffSec < 60) return `${diffSec} сек назад`;
    const minutes = Math.floor(diffSec / 60);
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ч назад`;
  }, [lastUpdate]);

  return (
    <div className="last-sync">
      <span className="last-sync-label">Обновлено:</span>
      <span className="last-sync-value">{isLoading ? 'синхронизация…' : text}</span>
      {onRefresh && (
        <button
          className="last-sync-refresh"
          onClick={() => onRefresh()}
          aria-label="Обновить"
        >
          ↻
        </button>
      )}
    </div>
  );
}


