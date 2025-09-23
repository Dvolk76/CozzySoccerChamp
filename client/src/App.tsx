import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { Navigation } from './components/Navigation';
import { MatchesView } from './views/MatchesView';
import { LeaderboardView } from './views/LeaderboardView';
import { AdminView } from './views/AdminView';
import { UserPredictionsView } from './views/UserPredictionsView';
import { AdminMatchesView } from './views/AdminMatchesView';
import { AdminMatchesManagementView } from './views/AdminMatchesManagementView';
import { useUser } from './hooks/useUser';

function App() {
  const [currentView, setCurrentView] = useState('matches');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const { user, loading } = useUser();


  useEffect(() => {
    // Initialize Telegram WebApp safely
    try {
      WebApp.ready();
      WebApp.expand();
      
      // Enable safe area handling for iOS
      WebApp.enableClosingConfirmation();
      
      console.log('Telegram WebApp initialized successfully');
    } catch (error) {
      console.log('Running outside Telegram WebApp environment:', error);
    }
    
    // Set theme colors
    if (WebApp.themeParams) {
      document.documentElement.style.setProperty(
        '--tg-theme-bg-color',
        WebApp.themeParams.bg_color || '#ffffff'
      );
      document.documentElement.style.setProperty(
        '--tg-theme-text-color',
        WebApp.themeParams.text_color || '#000000'
      );
      document.documentElement.style.setProperty(
        '--tg-theme-hint-color',
        WebApp.themeParams.hint_color || '#999999'
      );
      document.documentElement.style.setProperty(
        '--tg-theme-button-color',
        WebApp.themeParams.button_color || '#2481cc'
      );
      document.documentElement.style.setProperty(
        '--tg-theme-button-text-color',
        WebApp.themeParams.button_text_color || '#ffffff'
      );

      // Derive high-contrast surfaces depending on light/dark
      const text = WebApp.themeParams.text_color || '#000000';
      const bg = WebApp.themeParams.bg_color || '#ffffff';
      const isDark = (() => {
        // simple luminance check
        const hex = (c: string) => c.replace('#', '');
        const toRGB = (h: string) => [
          parseInt(h.substring(0, 2), 16),
          parseInt(h.substring(2, 4), 16),
          parseInt(h.substring(4, 6), 16),
        ];
        try {
          const [r, g, b] = toRGB(hex(bg).padStart(6, '0'));
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          return luminance < 128; // dark background
        } catch {
          return false;
        }
      })();

      const surface = bg; // keep host bg
      const card = isDark ? '#111418' : '#ffffff';
      const border = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';
      const badge = isDark ? 'rgba(255,255,255,0.08)' : '#eef2f7';

      document.documentElement.style.setProperty('--surface-color', surface);
      document.documentElement.style.setProperty('--card-bg-color', card);
      document.documentElement.style.setProperty('--border-color', border);
      document.documentElement.style.setProperty('--badge-bg-color', badge);
    }
  }, []);

  const handleEditUserPredictions = (userId: string) => {
    setEditingUserId(userId);
    setCurrentView('admin-matches');
  };

  const handleManageMatches = () => {
    setCurrentView('admin-matches-management');
  };

  const handleBackToAdmin = () => {
    setEditingUserId(null);
    setCurrentView('admin');
  };

  const renderView = () => {
    try {
      if (currentView === 'user-predictions' && editingUserId) {
        return (
          <UserPredictionsView
            userId={editingUserId}
            onBack={handleBackToAdmin}
          />
        );
      }

      if (currentView === 'admin-matches' && editingUserId) {
        return (
          <AdminMatchesView
            userId={editingUserId}
            onBack={handleBackToAdmin}
          />
        );
      }

      if (currentView === 'admin-matches-management') {
        return (
          <AdminMatchesManagementView
            onBack={handleBackToAdmin}
          />
        );
      }

      switch (currentView) {
        case 'matches':
          return <MatchesView />;
        case 'leaderboard':
          return <LeaderboardView />;
        case 'admin':
          return (
            <AdminView 
              onEditUserPredictions={handleEditUserPredictions}
              onManageMatches={handleManageMatches}
            />
          );
        default:
          return <MatchesView />;
      }
    } catch (error) {
      console.error('App renderView crashed:', error);
      return (
        <div>
          <div className="header">Ошибка приложения</div>
          <div className="error">
            Произошла неожиданная ошибка. 
            <button onClick={() => window.location.reload()} style={{ marginLeft: '8px' }}>
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        {renderView()}
      </div>
      {currentView !== 'user-predictions' && currentView !== 'admin-matches' && currentView !== 'admin-matches-management' && (
        <Navigation 
          currentView={currentView} 
          onNavigate={(view) => {
            setEditingUserId(null); // Clear editing state when navigating
            setCurrentView(view);
          }} 
        />
      )}
    </div>
  );
}

export default App;
