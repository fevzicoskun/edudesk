import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/vitest/setup/vitest-setup.ts'],
    include: ['tests/vitest/**/*.test.ts'],

    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          setupFiles: ['./tests/vitest/setup/vitest-setup.ts'],
          include: ['tests/vitest/unit/**/*.test.ts'],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          setupFiles: ['./tests/vitest/setup/vitest-setup.ts'],
          include: ['tests/vitest/integration/**/*.test.ts'],
          pool: 'forks',
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/domains/**/*.ts',
        'lib/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/types/**',
        '**/events/**',
        '**/validators/**',
      ],
      thresholds: {
        branches:  70,
        functions: 70,
        lines:     70,
        statements: 70,
      },
    },
  },
})
