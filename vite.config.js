import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readFileSync, writeFileSync, copyFileSync, cpSync, existsSync, mkdirSync } from 'fs'

// 复制 manifest.json 和资源到 dist，并修正路径
function copyManifest() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf-8'))

      // 修正构建后的路径
      manifest.background.service_worker = 'background.js'
      manifest.content_scripts[0].js = ['content.js']
      manifest.content_scripts[0].css = ['assets/content.css']

      writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2))

      // 复制 content.css
      if (existsSync('src/styles/content.css')) {
        copyFileSync('src/styles/content.css', 'dist/assets/content.css')
      }

      // 复制 public 目录
      if (existsSync('public')) {
        cpSync('public', 'dist/public', { recursive: true })
      }
    },
  }
}

export default defineConfig({
  plugins: [copyManifest()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.js'),
        content: resolve(__dirname, 'src/content/index.js'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})