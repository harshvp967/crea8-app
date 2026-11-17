import type { Config } from 'jest';

const config: Config = {
  projects: [
    '<rootDir>/libraries/nestjs-libraries/jest.config.cjs',
    '<rootDir>/apps/frontend/jest.config.cjs',
  ],
};

export default config;
