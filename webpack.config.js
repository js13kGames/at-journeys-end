const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: "./src/index.ts",
    plugins: [
        new HtmlWebpackPlugin({
            inject: false,
            title: 'JS13k Game!',
            template: require('html-webpack-template'),
            appMountId: 'app',
            minify: {
                collapseWhitespace: true
            },
            filename: 'dist/index.html'
        })
    ],
    output: {
        filename: "./dist/bundle.js"
    },

    devtool: "source-map",

    resolve: {
        extensions: [".webpack.js", ".web.js", ".ts", ".js"]
    },

    module: {
        rules: [
            { test: /\.ts$/, loader: "ts-loader" },
            { test: /\.js$/, enforce: "pre", loader: "source-map-loader" }
        ]
    }
};
