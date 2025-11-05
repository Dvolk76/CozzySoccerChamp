import WebApp from '@twa-dev/sdk';

/**
 * Тактильный отклик для кнопок
 */
export const haptic = {
  /**
   * Легкий отклик для обычных кнопок и навигации
   */
  light: () => {
    try {
      WebApp.HapticFeedback?.impactOccurred('light');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  /**
   * Средний отклик для важных действий
   */
  medium: () => {
    try {
      WebApp.HapticFeedback?.impactOccurred('medium');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  /**
   * Сильный отклик для критических действий
   */
  heavy: () => {
    try {
      WebApp.HapticFeedback?.impactOccurred('heavy');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  /**
   * Мягкий отклик для изменения значений
   */
  soft: () => {
    try {
      WebApp.HapticFeedback?.impactOccurred('soft');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  /**
   * Жесткий отклик для подтверждающих действий
   */
  rigid: () => {
    try {
      WebApp.HapticFeedback?.impactOccurred('rigid');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  /**
   * Отклик при успешном действии
   */
  success: () => {
    try {
      WebApp.HapticFeedback?.notificationOccurred('success');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  /**
   * Отклик при ошибке
   */
  error: () => {
    try {
      WebApp.HapticFeedback?.notificationOccurred('error');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  /**
   * Отклик при предупреждении
   */
  warning: () => {
    try {
      WebApp.HapticFeedback?.notificationOccurred('warning');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  /**
   * Отклик при изменении выбора (для селекторов, переключателей)
   */
  selection: () => {
    try {
      WebApp.HapticFeedback?.selectionChanged();
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },
};

