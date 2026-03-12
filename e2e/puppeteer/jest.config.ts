export default {
  preset: 'jest-puppeteer',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  testMatch: ['<rootDir>/**/*.test.ts'],
  testTimeout: 30000,
};
