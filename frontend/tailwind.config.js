/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        heading: ['"Sora"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        nav: '#0B1120',
        surface: '#F8FAFC',
        surfaceHover: '#F1F5F9',
        accent: '#0EA5E9',
        accentHover: '#0284C7',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        baseSlate: '#64748B',
        slateDark: '#334155',
        slateLight: '#94A3B8',
        white: '#FFFFFF',
        black: '#000000',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'float': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'sm': '0.125rem',
        DEFAULT: '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
      }
    },
  },
  plugins: [],
}
