/** @type {import('jest').Config} */
module.exports = {
  displayName: 'frontend-partner',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/components/partner/compose.partner.flow.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          strict: false,
          module: 'commonjs',
          target: 'ES2020',
          moduleResolution: 'node',
        },
      },
    ],
  },
};
