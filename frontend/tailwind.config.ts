import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Tajawal"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0fdf6',
          100: '#dcfce9',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
