module.exports = {
    collectCoverage: true,
    collectCoverageFrom: ['../src/**/*.js'],
    coverageReporters: ['text-summary'],
    moduleFileExtensions: ['js'],
    testRegex: '((\\.|/*.)(spec))\\.js?$',
    setupFilesAfterEnv: ['<rootDir>/setup.js'],
    moduleNameMapper: { '\\.(css)$': '<rootDir>/empty-module.js' }
  };
  
  