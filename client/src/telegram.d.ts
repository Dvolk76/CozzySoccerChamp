declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void;
        expand(): void;
        enableClosingConfirmation(): void;
        initData?: string;
        platform?: string;
        themeParams?: any;
        MainButton?: {
          hide(): void;
        };
      };
    };
  }
}

export {};
