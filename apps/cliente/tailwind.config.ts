import type { Config } from 'tailwindcss';
import preset from '@mq/design-system/tailwind-preset';

const config: Config = {
  presets: [preset as Config],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
