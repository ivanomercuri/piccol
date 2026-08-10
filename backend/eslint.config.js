const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  // tseslint.configs.recommended, di per sé, non è vincolato a nessuna
  // estensione di file: applicato con lo spread andrebbe a colpire anche i
  // .js esistenti (parser TS compreso), rompendo `require()` ovunque nel
  // progetto. tseslint.config({ files, extends }) applica invece il preset
  // solo ai file che rispettano `files`, esattamente come vogliamo per una
  // migrazione incrementale dove .js e .ts convivono.
  ...tseslint.config({
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
  }),
  {
    // Applica queste regole a tutti i file JS
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node, // Risolve 'require', 'module', 'process'
        ...globals.jest, // <--- RISOLVE IL PAPOCCHIO: Riconosce 'describe', 'it', 'expect'
      },
    },
    rules: {
      // Ignora le variabili non usate se iniziano con "_" o se sono "next" (comune in Express)
      'no-unused-vars': ['warn', { argsIgnorePattern: 'next|^_' }],

      // Gestione degli spazi vuoti
      'padding-line-between-statements': [
        'error',

        // 1. Spazio dopo le variabili (const/let)
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },

        // 2. Spazio prima del return
        { blankLine: 'always', prev: '*', next: 'return' },

        // 3. <--- RISOLVE IL TUO PROBLEMA TRA LE ROTTE
        // Mette spazio tra due espressioni (es. router.get e router.post)
        { blankLine: 'always', prev: 'expression', next: 'expression' },

        // 4. Mette spazio prima di esportare il modulo (module.exports)
        { blankLine: 'always', prev: '*', next: 'cjs-export' },
      ],
    },
  },
  {
    // Stesse regole di globals/padding dei file JS, applicate ai file .ts
    // via via che vengono convertiti; `no-unused-vars` è disattivata a
    // favore dell'equivalente di typescript-eslint (già abilitata da
    // tseslint.configs.recommended sopra), perché la versione base non
    // capisce i tipi e darebbe falsi positivi su import usati solo come tipo.
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: 'next|^_' },
      ],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'expression', next: 'expression' },
        { blankLine: 'always', prev: '*', next: 'cjs-export' },
      ],
    },
  },
  prettierConfig,
];
