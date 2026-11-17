// =============================================================================
// Time-Based Theme Hook
// Automatically changes colors based on time of day for eye comfort
// Supports manual override to force day mode
// =============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getSyncMetaValue,
  setSyncMetaValue,
} from '../lib/offline/storage/persistence';

// Storage key for manual override
const THEME_OVERRIDE_KEY = 'emr_theme_override';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type ThemeMode = 'auto' | 'navy' | 'crystal';

export interface TimeThemeColors {
  // Header/Banner colors
  header: {
    gradient: string;
    decorativeCircle: string;
  };
  // Sidebar colors
  sidebar: {
    gradient: string;
  };
  // Card colors
  card: {
    background: string;
    border: string;
    hover: string;
  };
  // Accent colors
  accent: {
    text: string;
    muted: string;
    border: string;
    bg: string;
  };
  // Button colors
  button: {
    primary: string;
    primaryHover: string;
  };
  // Icon colors
  icon: {
    bg: string;
    color: string;
  };
}

export interface TimeTheme {
  timeOfDay: TimeOfDay;
  greeting: string;
  isNightMode: boolean;
  colors: TimeThemeColors;
  // Manual override controls
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

// Theme configurations for different times of day
const themes: Record<TimeOfDay, TimeThemeColors> = {
  morning: {
    // Teal/Cyan theme for morning (6am-12pm)
    header: {
      gradient: 'from-[#1E232B] via-[#262C36] to-[#1E232B]',
      decorativeCircle: 'bg-[#E9783F]/20',
    },
    sidebar: {
      gradient: 'from-[#1E232B] via-[#161B23] to-[#0B0D11]',
    },
    card: {
      background: 'bg-[#F7F5F1]',
      border: 'border-[#E7E2D9]',
      hover: 'bg-[#F1EEE8]',
    },
    accent: {
      text: 'text-[#D96A36]',
      muted: 'text-white/70',
      border: 'border-[#E9783F]',
      bg: 'bg-[#F7F6F3]',
    },
    button: {
      primary: 'bg-[#E9783F]',
      primaryHover: 'hover:bg-[#D96A36]',
    },
    icon: {
      bg: 'bg-[#F1EFE9]',
      color: 'text-[#D96A36]',
    },
  },
  afternoon: {
    // Teal/Cyan theme for afternoon (12pm-6pm)
    header: {
      gradient: 'from-[#1E232B] via-[#262C36] to-[#1E232B]',
      decorativeCircle: 'bg-[#E9783F]/20',
    },
    sidebar: {
      gradient: 'from-[#1E232B] via-[#161B23] to-[#0B0D11]',
    },
    card: {
      background: 'bg-[#F7F5F1]',
      border: 'border-[#E7E2D9]',
      hover: 'bg-[#F1EEE8]',
    },
    accent: {
      text: 'text-[#D96A36]',
      muted: 'text-white/70',
      border: 'border-[#E9783F]',
      bg: 'bg-[#F7F6F3]',
    },
    button: {
      primary: 'bg-[#E9783F]',
      primaryHover: 'hover:bg-[#D96A36]',
    },
    icon: {
      bg: 'bg-[#F1EFE9]',
      color: 'text-[#D96A36]',
    },
  },
  evening: {
    // Teal/Cyan theme for evening (6pm-9pm)
    header: {
      gradient: 'from-[#1E232B] via-[#262C36] to-[#1E232B]',
      decorativeCircle: 'bg-[#E9783F]/20',
    },
    sidebar: {
      gradient: 'from-[#1E232B] via-[#161B23] to-[#0B0D11]',
    },
    card: {
      background: 'bg-[#F7F5F1]',
      border: 'border-[#E7E2D9]',
      hover: 'bg-[#F1EEE8]',
    },
    accent: {
      text: 'text-[#D96A36]',
      muted: 'text-white/70',
      border: 'border-[#E9783F]',
      bg: 'bg-[#F7F6F3]',
    },
    button: {
      primary: 'bg-[#E9783F]',
      primaryHover: 'hover:bg-[#D96A36]',
    },
    icon: {
      bg: 'bg-[#F1EFE9]',
      color: 'text-[#D96A36]',
    },
  },
  night: {
    // Dark, eye-friendly colors for night (9pm-6am)
    header: {
      gradient: 'from-[#1E232B] via-[#262C36] to-[#1E232B]',
      decorativeCircle: 'bg-[#E9783F]/15',
    },
    sidebar: {
      gradient: 'from-[#1E232B] via-[#161B23] to-[#0B0D11]',
    },
    card: {
      background: 'bg-slate-800',
      border: 'border-slate-700',
      hover: 'bg-slate-700',
    },
    accent: {
      text: 'text-slate-300',
      muted: 'text-slate-400',
      border: 'border-slate-600',
      bg: 'bg-slate-700',
    },
    button: {
      primary: 'bg-slate-600',
      primaryHover: 'hover:bg-slate-500',
    },
    icon: {
      bg: 'bg-slate-700',
      color: 'text-slate-300',
    },
  },
};

// Navy blue theme - dark professional look
const navyTheme: TimeThemeColors = {
  header: {
    gradient: 'from-[#1E232B] via-[#262C36] to-[#1E232B]',
    decorativeCircle: 'bg-[#E9783F]/20',
  },
  sidebar: {
    gradient: 'from-[#1E232B] via-[#161B23] to-[#0B0D11]',
  },
  card: {
    background: 'bg-white',
    border: 'border-gray-200',
    hover: 'bg-gray-50',
  },
  accent: {
    text: 'text-[#11151C]',
    muted: 'text-white/70',
    border: 'border-[#E9783F]',
    bg: 'bg-[#E9783F]',
  },
  button: {
    primary: 'bg-[#E9783F]',
    primaryHover: 'hover:bg-[#D96A36]',
  },
  icon: {
    bg: 'bg-[#E9783F]/10',
    color: 'text-[#11151C]',
  },
};

// Crystal theme - soft, eye-friendly cream/warm white with elegant emerald accents
const crystalTheme: TimeThemeColors = {
  header: {
    gradient: 'from-[#1E232B] via-[#262C36] to-[#1E232B]',
    decorativeCircle: 'bg-[#E9783F]/20',
  },
  sidebar: {
    gradient: 'from-[#fafaf9] via-[#f5f5f4] to-[#fafaf9]',
  },
  card: {
    background: 'bg-white',
    border: 'border-stone-200',
    hover: 'bg-stone-50',
  },
  accent: {
    text: 'text-[#D96A36]',
    muted: 'text-[#FFD9C9]',
    border: 'border-[#FFC7B0]',
    bg: 'bg-[#E9783F]',
  },
  button: {
    primary: 'bg-[#E9783F]',
    primaryHover: 'hover:bg-[#D96A36]',
  },
  icon: {
    bg: 'bg-[#E9783F]/10',
    color: 'text-[#D96A36]',
  },
};

// Get greeting based on time of day
const getGreeting = (timeOfDay: TimeOfDay): string => {
  switch (timeOfDay) {
    case 'morning':
      return 'Good Morning';
    case 'afternoon':
      return 'Good Afternoon';
    case 'evening':
      return 'Good Evening';
    case 'night':
      return 'Good Night';
    default:
      return 'Welcome';
  }
};

// Determine time of day from current hour
const getTimeOfDay = (hour: number): TimeOfDay => {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night'; // 9pm to 6am
};

export function useTimeTheme(): TimeTheme {
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');

  // Hydrate theme override from IndexedDB.
  useEffect(() => {
    let mounted = true;

    const hydrateThemeMode = async (): Promise<void> => {
      try {
        const stored = await getSyncMetaValue<ThemeMode>(THEME_OVERRIDE_KEY);

        if (!mounted) return;
        if (stored === 'auto' || stored === 'navy' || stored === 'crystal') {
          setThemeModeState(stored);
        }
      } catch {
        // Keep default auto mode when persistence is unavailable.
      }
    };

    void hydrateThemeMode();

    return () => {
      mounted = false;
    };
  }, []);

  // Update hour every minute to catch time changes
  useEffect(() => {
    const updateHour = () => {
      setCurrentHour(new Date().getHours());
    };

    // Update immediately
    updateHour();

    // Check every minute
    const interval = setInterval(updateHour, 60000);

    return () => clearInterval(interval);
  }, []);

  // Persist theme mode to IndexedDB
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void setSyncMetaValue(THEME_OVERRIDE_KEY, mode);
  }, []);

  // Toggle between auto -> navy -> crystal -> auto
  const toggleTheme = useCallback(() => {
    if (themeMode === 'auto') {
      setThemeMode('navy');
    } else if (themeMode === 'navy') {
      setThemeMode('crystal');
    } else {
      setThemeMode('auto');
    }
  }, [themeMode, setThemeMode]);

  const theme = useMemo(() => {
    const actualTimeOfDay = getTimeOfDay(currentHour);

    // Select theme based on mode
    let themeColors: TimeThemeColors;
    if (themeMode === 'navy') {
      themeColors = navyTheme;
    } else if (themeMode === 'crystal') {
      themeColors = crystalTheme;
    } else {
      themeColors = themes[actualTimeOfDay];
    }
    const effectiveTimeOfDay = actualTimeOfDay;

    // Night mode is only true if in auto mode AND it's actually night time
    const isNightMode = themeMode === 'auto' && actualTimeOfDay === 'night';

    return {
      timeOfDay: effectiveTimeOfDay,
      greeting: getGreeting(actualTimeOfDay), // Always show actual time greeting
      isNightMode,
      colors: themeColors,
      themeMode,
      setThemeMode,
      toggleTheme,
    };
  }, [currentHour, themeMode, setThemeMode, toggleTheme]);

  return theme;
}

// Export a function to get theme colors for non-hook contexts
// Note: This returns static values without manual override capability
export function getTimeThemeColors(): Omit<
  TimeTheme,
  'setThemeMode' | 'toggleTheme'
> & { setThemeMode: (mode: ThemeMode) => void; toggleTheme: () => void } {
  const hour = new Date().getHours();
  const actualTimeOfDay = getTimeOfDay(hour);
  const themeColors = themes[actualTimeOfDay];

  return {
    timeOfDay: actualTimeOfDay,
    greeting: getGreeting(actualTimeOfDay),
    isNightMode: actualTimeOfDay === 'night',
    colors: themeColors,
    themeMode: 'auto',
    setThemeMode: () => {}, // No-op for non-hook context
    toggleTheme: () => {}, // No-op for non-hook context
  };
}

export default useTimeTheme;
