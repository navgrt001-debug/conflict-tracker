/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0a0e1a',
        card: '#111827',
        border: '#1f2937',
        accent: {
          red: '#ef4444',
          blue: '#3b82f6',
          amber: '#f59e0b',
          green: '#10b981',
          purple: '#8b5cf6',
        },
      },
    },
  },
  plugins: [],
};
