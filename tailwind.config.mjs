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
        // Tema claro — suave a la vista (blanco cálido, texto pizarra), azul de
        // marca + dorado como acento.
        church: {
          "primary": "#1e40af", // Azul de marca
          "primary-content": "#ffffff",
          "secondary": "#51607a", // Azul pizarra
          "secondary-content": "#ffffff",
          "accent": "#b5892f", // Dorado cálido
          "accent-content": "#ffffff",
          "neutral": "#1b2436", // Azul noche (footer)
          "neutral-content": "#e7e5e0",
          "base-100": "#fdfcfa", // Blanco cálido, sin brillo agresivo
          "base-200": "#f4f1ea", // Crema muy suave
          "base-300": "#e6e1d6", // Arena
          "base-content": "#1f2733", // Pizarra oscuro (no negro puro)
          "info": "#2b6cb0",
          "info-content": "#ffffff",
          "success": "#3f7d54",
          "success-content": "#ffffff",
          "warning": "#b5892f",
          "warning-content": "#ffffff",
          "error": "#b04a3f",
          "error-content": "#ffffff",
        },
      },
      {
        // Tema oscuro — navy coherente con el claro (mismo azul/dorado), no el
        // gris genérico de DaisyUI.
        churchdark: {
          "primary": "#7aa2ff", // Azul claro para contraste sobre navy
          "primary-content": "#0b1220",
          "secondary": "#93a6c4",
          "secondary-content": "#0b1220",
          "accent": "#d8b45f", // Dorado luminoso
          "accent-content": "#1a1608",
          "neutral": "#0b1220",
          "neutral-content": "#e7e9ee",
          "base-100": "#0f1523", // Navy profundo (no negro)
          "base-200": "#161d2e",
          "base-300": "#222b3d",
          "base-content": "#e6e9f0",
          "info": "#6fb0e6",
          "info-content": "#0b1220",
          "success": "#6bbf85",
          "success-content": "#0b1220",
          "warning": "#d8b45f",
          "warning-content": "#1a1608",
          "error": "#e08079",
          "error-content": "#0b1220",
        },
      },
    ],
    darkTheme: "churchdark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: false,
    themeRoot: ":root",
  },
}
