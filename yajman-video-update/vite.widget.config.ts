import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/widget.tsx',
      name: 'YajmanVideoWidget',
      formats: ['es'],
      fileName: 'yajman-video-widget',
    },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
  },
});
