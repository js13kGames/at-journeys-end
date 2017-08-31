import typescript from 'rollup-plugin-typescript2';
import closure from 'rollup-plugin-closure-compiler-js';

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

export default {
    input: './src/main.ts',
    output: {
        file: 'dist/bundle.js',
        format: 'iife'
    },
    plugins: [
	typescript(),
        production && closure()
    ],
    sourcemap: !production
};
