import { useEffect, useState } from 'react';

interface NavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Navigation({ currentView, onNavigate }: NavigationProps) {
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navItems = [
    { id: 'matches', label: 'Матчи', icon: '⚽' },
    { id: 'leaderboard', label: 'Лидеры', icon: '🏆' },
    { id: 'admin', label: 'Админ', icon: '⚙️' },
  ];

  useEffect(() => {
    // Детекция виртуальной клавиатуры через изменение viewport
    const detectKeyboard = () => {
      const initialViewportHeight = window.visualViewport?.height || window.innerHeight;
      
      const handleViewportChange = () => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // Если высота уменьшилась больше чем на 150px, считаем что клавиатура открыта
        setIsKeyboardActive(heightDifference > 150);
      };

      // Используем Visual Viewport API если доступен (более точно)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportChange);
        return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
      } else {
        // Fallback для старых браузеров
        window.addEventListener('resize', handleViewportChange);
        return () => window.removeEventListener('resize', handleViewportChange);
      }
    };

    const cleanup = detectKeyboard();
    
    // Также слушаем события фокуса на полях ввода
    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Задержка для корректной работы с виртуальной клавиатурой
        setTimeout(() => setIsKeyboardActive(true), 300);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Задержка для предотвращения мерцания при переключении между полями
        setTimeout(() => {
          const activeElement = document.activeElement;
          if (!(activeElement instanceof HTMLInputElement) && !(activeElement instanceof HTMLTextAreaElement)) {
            setIsKeyboardActive(false);
          }
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      cleanup?.();
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return (
    <nav className={`nav ${isKeyboardActive ? 'keyboard-active' : ''}`}>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-button ${currentView === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
