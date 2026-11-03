// Pruebas de integración: la API completa contra un PostgreSQL temporal
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testRegex: '\\.e2e\\.ts$',
  globalSetup: '<rootDir>/test/setup-global.js',
  globalTeardown: '<rootDir>/test/teardown-global.js',
  testTimeout: 30000,
};
