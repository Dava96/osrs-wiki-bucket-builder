/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    "**/src/tests/**/*_test.ts"
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/generated/**"
  ],
  coverageDirectory: "coverage",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
          },
          target: 'es2022',
        },
        module: {
          type: 'es6',
        },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
};

export default config;
