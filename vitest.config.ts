import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/vitest/setup/vitest-setup.ts'],
    include: ['tests/vitest/**/*.test.ts', 'tests/permissions/**/*.test.ts'],

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
          // signInTestUser auth hız sınırında 30 sn'ye kadar bekleyip yeniden dener; kurulumda birkaç giriş olur
          hookTimeout: 120_000,
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'permissions',
          globals: true,
          environment: 'node',
          setupFiles: ['./tests/vitest/setup/vitest-setup.ts'],
          include: ['tests/permissions/**/*.test.ts'],
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
        branches:   20,
        functions:  20,
        lines:      20,
        statements: 20,
      },
    },
  },
})
