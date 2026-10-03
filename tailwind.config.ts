import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f6f3ee',
          100: '#ebe3d6',
          500: '#a3794b',
          600: '#8a623a',
          700: '#6e4d2e',
          900: '#2b1f14',
        },
      },
    },
  },
  plugins: [],
};

export default config;
