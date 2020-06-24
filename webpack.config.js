module.exports = {
    mode: 'development',
    entry: './src/index.tsx',
    output: {
        filename: 'main.js',
        path: __dirname + '/dist'
    },
    devtool: 'source-map',
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: [
            { test: /\.tsx?$/, loader: "ts-loader" },
            {
                test: /\.s[ac]ss$/i,
                use: [
                  'style-loader',
                  'css-loader',
                  'sass-loader'
                ]
            },
            {
                test: /\.(woff|woff2|eot|ttf|svg)$/,
                exclude: /node_modules/,
                loader: 'file-loader',
                options: {
                  limit: 1024,
                  name: '[name].[ext]',
                  publicPath: 'dist/assets/',
                  outputPath: 'dist/assets/'
                }
            }
        ]
    },
    devServer: {
        contentBase: __dirname + '/dist',
        publicPath: '/dist'
    }
};
