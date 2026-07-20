import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'www/js/core/utils.js',
        'www/js/core/storage.js',
        'www/js/modules/checkin.js',
        'www/js/modules/habit.js',
        'www/js/modules/stats.js',
        'www/js/modules/water.js',
        'www/js/data/constants.js'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    },
    // 测试执行时间限制
    testTimeout: 5000,
    // 确保 jsdom 环境完整
    unstubGlobals: true,
    server: {
      deps: {
        // 内联 www/js 目录，让 IIFE 脚本正确执行
        inline: [/www\/js/]
      }
    }
  },
  resolve: {
    alias: {
      '@www': resolve(__dirname, 'www')
    }
  }
});
