import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import path from 'path'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
    {
      name: 'copy-dts',
      closeBundle() {
        const src = 'src/react-select-country.d.ts';
        const dest = 'dist/react-select-country.d.ts';
        if (existsSync(src)) {
          copyFileSync(src, dest);
        } else {
          // console.error(`Error: ${src} does not exist.`);
        }
      }
    }
  ],
  css: {
    postcss: {
      plugins: [],
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/App.tsx'),
      name: 'react-select-country-mw',
      fileName: (format) => `react-select-country.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    },
    cssCodeSplit: false
  }
})
