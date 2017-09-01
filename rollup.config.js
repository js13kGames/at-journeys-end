import typescript from 'rollup-plugin-typescript2';
import uglify from 'rollup-plugin-uglify';

// `npm start` -> `production` is false
// `npm run build` -> `production` is true
const production = !process.env.ROLLUP_WATCH;

export default {
    input: './src/main.ts',
    output: {
        file: 'dist/bundle.js',
        format: 'iife'
    },
    plugins: [
	typescript(),
        production && uglify()
    ],
    sourcemap: !production
};
