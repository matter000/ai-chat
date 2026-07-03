/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 极简干净型 · 明亮冷灰
        ink: {
          900: '#1F2328',
          700: '#373E47',
          500: '#646A73',
          400: '#8F959E',
          300: '#C9CDD4',
          200: '#E5E6EB',
          100: '#F2F3F5',
          50:  '#F7F8FA',
        },
        accent: {
          DEFAULT: '#2563EB',
          hover:   '#1D4ED8',
          soft:    '#EFF6FF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt:     '#FAFAFA',
          border:  '#E5E6EB',
        },
        // 深色模式
        dark: {
          bg:     '#0F1115',
          panel:  '#171A21',
          subtle: '#1F232C',
          border: '#2A2F3A',
          ink:    '#E6E8EB',
          muted:  '#8A909B',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // 微调：正文 14，标题 13，注释 12
        'xs': ['11px', { lineHeight: '1.5' }],
        'sm': ['13px', { lineHeight: '1.55' }],
        'base': ['14px', { lineHeight: '1.6' }],
        'md': ['15px', { lineHeight: '1.65' }],
      },
      boxShadow: {
        // 极简：只保留轻微阴影
        'xs': '0 1px 2px rgba(15, 17, 21, 0.04)',
        'sm': '0 1px 3px rgba(15, 17, 21, 0.06), 0 1px 2px rgba(15, 17, 21, 0.04)',
        'md': '0 4px 12px rgba(15, 17, 21, 0.08), 0 2px 4px rgba(15, 17, 21, 0.04)',
        'lg': '0 12px 32px rgba(15, 17, 21, 0.12), 0 4px 8px rgba(15, 17, 21, 0.04)',
      },
      transitionDuration: {
        'fast': '120ms',
      },
      transitionTimingFunction: {
        'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in':   'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up':  'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slide-right 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};