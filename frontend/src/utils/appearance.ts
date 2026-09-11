export type AppearanceTheme = 'light' | 'indigo' | 'warm' | 'dark';
export type AppearanceFontSize = 'small' | 'default' | 'large';
export interface AppearanceSettings { theme: AppearanceTheme; fontSize: AppearanceFontSize }

export const getAppearance = (): AppearanceSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem('hbe_appearance') || '{}');
    const legacyTheme = localStorage.getItem('hbe_theme') === 'dark' ? 'dark' : 'light';
    return {
      theme: ['light', 'indigo', 'warm', 'dark'].includes(saved.theme) ? saved.theme : legacyTheme,
      fontSize: ['small', 'default', 'large'].includes(saved.fontSize) ? saved.fontSize : 'default',
    };
  } catch { return { theme: 'light', fontSize: 'default' }; }
};

export const applyAppearance = (settings: AppearanceSettings, persist = true) => {
  document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  document.documentElement.dataset.hbeTheme = settings.theme;
  document.documentElement.dataset.hbeFontSize = settings.fontSize;
  localStorage.setItem('hbe_theme', settings.theme === 'dark' ? 'dark' : 'light');
  if (persist) localStorage.setItem('hbe_appearance', JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('hbe-appearance-change', { detail: settings }));
};
