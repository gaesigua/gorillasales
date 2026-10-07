/** @type {import('tailwindcss').Config} */
// Classic business-web theme: square corners, no shadows or blur, Verdana, compact pixel type scale.
const none = { none: 'none', sm: 'none', DEFAULT: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none', '3xl': 'none', inner: 'none' };

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    borderRadius: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '0' },
    boxShadow: none,
    dropShadow: none,
    backdropBlur: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0' },
    fontSize: {
      '2xs': ['10px', '14px'],
      xs: ['11px', '15px'],
      sm: ['12px', '17px'],
      base: ['13px', '19px'],
      lg: ['14px', '20px'],
      xl: ['16px', '22px'],
      '2xl': ['18px', '24px'],
      '3xl': ['20px', '26px'],
      '4xl': ['24px', '30px'],
      '5xl': ['28px', '34px'],
      '6xl': ['32px', '38px'],
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        brand: { DEFAULT: 'var(--brand)', light: 'var(--brand-light)' },
        link: 'var(--link)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        positive: { DEFAULT: 'var(--positive)', bg: 'var(--positive-bg)' },
        negative: { DEFAULT: 'var(--negative)', bg: 'var(--negative-bg)' },
        warning: { DEFAULT: 'var(--warning)', bg: 'var(--warning-bg)' },
        info: { DEFAULT: 'var(--info)', bg: 'var(--info-bg)' },
      },
      fontFamily: {
        sans: ['Verdana', 'Tahoma', 'Geneva', 'DejaVu Sans', 'sans-serif'],
      },
    },
  },
  // No shouting labels: uppercase and letter-spacing utilities are switched off app-wide
  corePlugins: { textTransform: false, letterSpacing: false },
  plugins: [require('@tailwindcss/typography')],
};
