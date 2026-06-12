/** @type {import('tailwindcss').Config} */
import daisyui from 'daisyui';
import daisyuiThemes from 'daisyui/src/theming/themes';
import tailwindAnimate from 'tailwindcss-animate';
import tailwindColors from 'tailwindcss/colors';
import type { Config } from 'tailwindcss/types/config';

const colorSafeList: string[] = [];

// Skip these to avoid a load of deprecated warnings when tailwind starts up
const deprecated = ['lightBlue', 'warmGray', 'trueGray', 'coolGray', 'blueGray'];

const themeColors = {
  turquoise: {
    '50': 'rgba(130, 218, 216, 0.5)',
    '200': '#82dad8',
    '300': '#42cbc9',
    '400': '#00c8c8', // from highfivve styleguide
    '600': '#56a9a8'
  },
  blue: {
    '50': 'rgba(183, 203, 226, 0.5)',
    '200': '#b7cbe2',
    '300': '#7da6d7',
    '400': '#052e53'
  },
  berry: {
    '50': '#bba1b0',
    '200': '#c45f8d',
    '400': '#ba0e5f', // from highfivve styleguide
    '500': '#c5015d'
  },
  purple: {
    '50': 'rgba(172, 149, 232, 0.5)',
    '400': '#ac95e8',
    '500': '#8a7de0'
  },
  pink: {
    '50': 'rgba(241, 118, 175, 0.5)',
    '400': '#f176af'
  },
  yellow: {
    '50': 'rgba(232, 208, 106, 0.5)',
    '400': '#e8d06a'
  },
  orange: {
    '50': 'rgba(234, 148, 69, 0.5)',
    '400': '#ea9445'
  },
  red: {
    '50': 'rgba(248, 131, 131, 0.5)',
    '400': '#f88383'
  },
  gray: {
    '50': 'rgba(66, 203, 201, 0.05)',
    '200': 'rgba(203, 0, 95, 0.04)',
    '400': '#e7e7e7',
    '450': '#e1e1e1'
  },
  darkgray: {
    '200': '#a2a3a5'
  },
  green: {
    '400': '#49817B',
    '600': '#006E65'
  },
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))'
  },
  popover: {
    DEFAULT: 'hsl(var(--popover))',
    foreground: 'hsl(var(--popover-foreground))'
  },
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))'
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))'
  },
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))'
  },
  accent: {
    DEFAULT: 'hsl(var(--accent))',
    foreground: 'hsl(var(--accent-foreground))'
  },
  destructive: {
    DEFAULT: 'hsl(var(--destructive))',
    foreground: 'hsl(var(--destructive-foreground))'
  },
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  chart: {
    '1': 'hsl(var(--chart-1))',
    '2': 'hsl(var(--chart-2))',
    '3': 'hsl(var(--chart-3))',
    '4': 'hsl(var(--chart-4))',
    '5': 'hsl(var(--chart-5))'
  }
};

const themeAndTailwindColors = { ...themeColors, ...tailwindColors };

// First step for proper access
type TailwindColor = keyof typeof themeAndTailwindColors;

for (const colorName in themeAndTailwindColors) {
  if (deprecated.includes(colorName)) {
    continue;
  }

  const shades = [50, 200, 300, 400, 500, 600];
  const color: TailwindColor = colorName as TailwindColor;
  const pallette = themeAndTailwindColors[color];

  if (typeof pallette === 'object') {
    shades.forEach(shade => {
      if (shade in pallette) {
        colorSafeList.push(`stroke-${color}-${shade}`);
        colorSafeList.push(`fill-${color}-${shade}`);
        colorSafeList.push(`bg-${color}-${shade}`);
        colorSafeList.push(`text-${color}-${shade}`);
      }
    });
  }
}

export default {
  darkMode: ['class'],
  // preflight resets element styles via html/body selectors that don't exist
  // inside the console shadow root, so it's disabled
  corePlugins: {
    preflight: false
  },
  content: ['./ad-tag/source/ts/console/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Simple 3 rows, 2 column layout. header, main, footer | sidebar
      gridTemplateRows: {
        layout: 'auto 1fr auto auto'
      },
      gridTemplateColumns: {
        layout: 'minmax(300px, max-content) minmax(0, 1fr)'
      },
      colors: themeColors,
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        fadeInOut: {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        'loading-screen-rotate': 'loading-screen-rotate 2s linear infinite',
        'loading-screen-dash': 'loading-screen-dash 1.5s ease-in-out infinite',
        fadeIn: 'fadeInOut 1s ease-in-out'
      },
      fontFamily: {
        sans: ['Brownfox-Formular', 'ui-sans-serif', 'system-ui'],
        BrownfoxFormular: ['Brownfox-Formular'],
        roboto: ['Roboto', 'Arial', 'sans-serif']
      }
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1515px',
      tall: {
        raw: '(min-height: 1100px)'
      },
      xTall: {
        raw: '(min-height: 1300px)'
      },
      xxTall: {
        raw: '(min-height: 1500px)'
      }
    }
  },
  /*
   needed to make dynamic classNames (e.g. colors) possible - no custom colors possible (turquoise!)
   see https://stackoverflow.com/questions/69687530/dynamically-build-classnames-in-tailwindcss
   */
  safelist: colorSafeList,
  plugins: [tailwindAnimate, daisyui],
  daisyui: {
    // prefix daisyUI component classes to make them distinguishable from
    // tailwind utilities and custom classes
    prefix: 'd-',
    logs: false,
    themes: [
      {
        light: {
          ...daisyuiThemes.light,
          primary: '#000000',
          secondary: '#00c8c8', // highfivve turquoise
          accent: '#ba0e5f', // highfivve berry
          info: '#7da6d7',
          success: '#006e65',
          warning: '#e8d06a',
          error: '#c5015d'
        },
        dark: {
          ...daisyuiThemes.dark,
          // inverted primary so black-on-light becomes white-on-dark
          primary: '#ffffff',
          secondary: '#00c8c8', // highfivve turquoise
          accent: '#ba0e5f', // highfivve berry
          info: '#7da6d7',
          success: '#42cbc9',
          warning: '#e8d06a',
          error: '#f88383'
        }
      }
    ],
    darkTheme: 'dark'
  }
} satisfies Config & { daisyui?: Record<string, unknown> };
