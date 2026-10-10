/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/../helpers/src/$1',
    '^@gitroom/react/(.*)$': '<rootDir>/../react-shared-libraries/src/$1',
    '^@gitroom/backend/(.*)$': '<rootDir>/../../apps/backend/src/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          strict: false,
          skipLibCheck: true,
          module: 'commonjs',
          target: 'ES2020',
          moduleResolution: 'node',
        },
      },
    ],
  },
};
