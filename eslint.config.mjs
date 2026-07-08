import globals from 'globals';
import pluginJs from '@eslint/js';
import babelParser from '@babel/eslint-parser';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

/** @type {import('eslint').Linter.Config[]} */
export default [
    { files: ['**/*.{js,mjs,cjs,ts}'] },
    { languageOptions: { globals: globals.node } },
    pluginJs.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    plugins: ['@babel/plugin-syntax-typescript'],
                },
            },
        },
    },
    eslintPluginPrettierRecommended,
    {
        rules: {
            'getter-return': 'off',
            'no-dupe-args': 'off',
            'no-dupe-class-members': 'off',
            'no-redeclare': 'off',
            'no-undef': 'off',
            'no-unused-vars': 'off',
            'no-console': ['error', { allow: ['warn'] }],
            eqeqeq: 'error',
            'prettier/prettier': ['error', { endOfLine: 'auto' }],
        },
    },
];
