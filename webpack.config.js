module.exports = {
    entry: "./src/main.ts",
    output: {filename: "./dist/bundle.js"},
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
