/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'bounce-slow': 'bounce 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { 
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideInRight: {
          '0%': {
            opacity: '0',
            transform: 'translateX(-20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        church: {
          "primary": "#1e3a8a", // Azul profundo, sobrio y solemne
          "primary-content": "#ffffff",
          "secondary": "#51607a", // Azul pizarra
          "secondary-content": "#ffffff",
          "accent": "#c19a3e", // Dorado cálido y elegante
          "accent-content": "#1c1917", // Texto oscuro sobre dorado (contraste AA)
          "neutral": "#1b2436", // Azul noche
          "neutral-content": "#e7e5e0",
          "base-100": "#fffdf9", // Blanco cálido (marfil)
          "base-200": "#f6f2ea", // Crema suave
          "base-300": "#e7e0d2", // Arena
          "base-content": "#1f2937",
          "info": "#2b6cb0",
          "info-content": "#ffffff",
          "success": "#3f7d54",
          "success-content": "#ffffff",
          "warning": "#c19a3e",
          "warning-content": "#1c1917",
          "error": "#b04a3f",
          "error-content": "#ffffff",
        },
      },
      "light",
      "dark",
    ],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: false,
    themeRoot: ":root",
  },
}
