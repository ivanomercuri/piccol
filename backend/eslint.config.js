const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
    js.configs.recommended,
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
                { blankLine: 'always', prev: '*', next: 'cjs-export' }
            ],
        },
    },
    prettierConfig,
];