import { defineConfig } from 'vite';

// Per aggiungere Svelte, React o Vue basta installare il plugin e inserirlo in `plugins`.
export default defineConfig({
    base: './', // percorsi relativi: funziona sia su dominio proprio sia su utente.github.io/cityrhythm
    plugins: [],
    server: {
        watch: { ignored: ['**/music/**', '**/sound-lab/**', '**/.cache_data/**', '**/cityrhythm_simulation_week.*'] },
    },
    build: { outDir: 'dist', chunkSizeWarningLimit: 3000 },
});
