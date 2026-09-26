import { useColorScheme } from 'react-native';

export interface Theme {
  dark: boolean;
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  /** The night region behind the rows, from dusk to dawn. */
  night: string;
  gridline: string;
  accent: string;
  /** A device's ON interval. */
  bar: string;
  barMuted: string;
  /** Where a rule asked for an edge before a fence moved it. */
  ghost: string;
  warning: string;
}

const light: Theme = {
  dark: false,
  background: '#f5f5f7',
  surface: '#ffffff',
  border: '#e2e2e7',
  text: '#16161a',
  textMuted: '#6e6e78',
  night: 'rgba(60, 70, 120, 0.10)',
  gridline: '#e2e2e7',
  accent: '#3b5bdb',
  bar: '#4f8f7a',
  barMuted: 'rgba(79, 143, 122, 0.28)',
  ghost: '#a1a1aa',
  warning: '#c92a2a',
};

const dark: Theme = {
  dark: true,
  background: '#0e0e11',
  surface: '#17171c',
  border: '#2a2a32',
  text: '#f2f2f5',
  textMuted: '#9a9aa6',
  night: 'rgba(120, 140, 220, 0.12)',
  gridline: '#2a2a32',
  accent: '#748ffc',
  bar: '#4f8f7a',
  barMuted: 'rgba(79, 143, 122, 0.26)',
  ghost: '#5c5c66',
  warning: '#ff6b6b',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
