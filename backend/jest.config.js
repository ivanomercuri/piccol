module.exports = {
  testEnvironment: 'node',
  // Durante la migrazione incrementale a TypeScript, i test .js (non ancora
  // convertiti) e i futuri test .ts convivono nella stessa suite: entrambi i
  // pattern restano validi finché la Fase 3 non converte l'ultimo file.
  testMatch: ['<rootDir>/__tests__/**/*.test.{js,ts}'],
  // ts-jest trasforma solo i file .ts/.tsx; i file .js proseguono senza
  // trasformazione, come prima di questa modifica (nessun impatto sui test
  // .js esistenti).
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
  verbose: true,
};
