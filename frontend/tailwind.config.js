/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', '"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"DM Mono"', 'monospace'],
      },
      colors: {
        // Sidebar / dark surface
        nav: '#0C1322',
        navHover: '#151E30',
        navBorder: 'rgba(255,255,255,0.07)',

        // Page backgrounds
        surface: 'rgb(var(--rgb-surface) / <alpha-value>)',
        surfaceCard: 'rgb(var(--rgb-surface-card) / <alpha-value>)',
        surfaceHover: 'rgb(var(--rgb-surface-hover) / <alpha-value>)',

        // Brand accent — vivid indigo-blue
        accent: 'rgb(var(--rgb-accent) / <alpha-value>)',
        accentHover: 'rgb(var(--rgb-accent-hover) / <alpha-value>)',
        accentLight: 'rgb(var(--rgb-accent-light) / <alpha-value>)',
        accentMuted: 'rgba(var(--rgb-accent), 0.15)',

        // Semantic
        success: '#10B981',
        successLight: '#ECFDF5',
        successDark: '#047857',
        warning: '#F59E0B',
        warningLight: '#FFFBEB',
        warningDark: '#B45309',
        danger: '#EF4444',
        dangerLight: '#FEF2F2',
        dangerDark: '#B91C1C',
        info: '#0EA5E9',
        infoLight: '#F0F9FF',

        // Slate / Dark
        slateDark: '#0F172A',
        slateDarkHover: '#1E293B',

        // Text hierarchy
        textPrimary: 'rgb(var(--rgb-text-primary) / <alpha-value>)',
        textSecondary: 'rgb(var(--rgb-text-secondary) / <alpha-value>)',
        textMuted: 'rgb(var(--rgb-text-muted) / <alpha-value>)',
        textDisabled: 'rgb(var(--rgb-text-disabled) / <alpha-value>)',

        // Borders
        borderBase: 'rgb(var(--rgb-border-base) / <alpha-value>)',
        borderStrong: 'rgb(var(--rgb-border-strong) / <alpha-value>)',
      },
      boxShadow: {
        'xs':    '0 1px 2px 0 rgba(0,0,0,0.05)',
        'card':  '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px 0 rgba(0,0,0,0.04)',
        'float': '0 8px 24px -4px rgba(0,0,0,0.10), 0 2px 8px -2px rgba(0,0,0,0.06)',
        'modal': '0 20px 60px -10px rgba(0,0,0,0.20), 0 4px 16px -4px rgba(0,0,0,0.10)',
        'glow':  '0 0 0 3px rgba(79,110,247,0.25)',
      },
      borderRadius: {
        'sm':   '0.25rem',
        DEFAULT:'0.375rem',
        'md':   '0.5rem',
        'lg':   '0.625rem',
        'xl':   '0.875rem',
        '2xl':  '1rem',
        '3xl':  '1.25rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in':      'fade-in 0.22s ease-out both',
        'slide-in-left':'slide-in-left 0.22s ease-out both',
        'scale-in':     'scale-in 0.2s ease-out both',
        shimmer:        'shimmer 1.6s linear infinite',
      },
      transitionDuration: {
        '200': '200ms',
        '250': '250ms',
      },
    },
  },
  plugins: [],
}
