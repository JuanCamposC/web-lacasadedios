import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Solo módulos de `src/lib`: son funciones puras que no necesitan un
    // navegador ni el runtime de Astro. Las páginas y componentes quedan fuera
    // a propósito; probarlos exigiría montar Astro entero para muy poco.
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
});
