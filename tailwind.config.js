/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'claude-bg': '#1a1a1a',
        'claude-surface': '#2a2a2a',
        'claude-surface-hover': '#3a3a3a',
        'claude-border': '#404040',
        'claude-text': '#e5e5e5',
        'claude-text-secondary': '#a0a0a0',
        'claude-accent': '#d97757',
        'claude-accent-hover': '#e08868',
        'claude-success': '#4ade80',
        'claude-warning': '#fbbf24',
        'claude-error': '#f87171',
      },
      fontFamily: {
        mono: ['Monaco', 'Menlo', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
