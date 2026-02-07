/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
  preset: 'ts-jest/presets/default-esm', // Use ESM preset
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    "**/src/tests/**/*_test.ts"
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/generated/**",
    "!src/types.ts",
    "!src/manual_verify.ts"
  ],
  coverageDirectory: "coverage",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json'
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
};

export default config;
