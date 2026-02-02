import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      return savedTheme;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  });

  useEffect(() => {
    // Update localStorage
    localStorage.setItem('theme', theme);

    // Update document class and CSS custom properties
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('color-scheme', 'dark');
      root.style.setProperty('color', 'rgba(255, 255, 255, 0.87)');
      root.style.setProperty('background-color', '#1a1a1a');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('color-scheme', 'light');
      root.style.setProperty('color', 'rgba(0, 0, 0, 0.87)');
      root.style.setProperty('background-color', '#ffffff');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}