/**
 * Build config for electron renderer process
 */

import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { merge } from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import dotenv from 'dotenv';
import baseConfig from './webpack.config.base.js';
import webpackPaths from './webpack.paths.js';
import deleteSourceMaps from '../scripts/delete-source-maps.js';
import checkNodeEnv from '../scripts/check-node-env.js';

// Load .env file for production builds
dotenv.config();

checkNodeEnv('production');
deleteSourceMaps();

const configuration: webpack.Configuration = {
  // Disable source maps in production for smaller bundle (saves ~14.5MB)
  devtool: false as const,

  mode: 'production',

  target: ['web', 'electron-renderer'],

  entry: [path.join(webpackPaths.srcRendererPath, 'index.tsx')],

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: './',
    filename: '[name].renderer.js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
    library: {
      type: 'umd',
    },
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
      {
        test: /\.s?(a|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
            },
          },
          'postcss-loader',
          'sass-loader',
        ],
        include: /\.module\.s?(c|a)ss$/,
      },
      {
        test: /\.s?(a|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
          'sass-loader',
        ],
        exclude: /\.module\.s?(c|a)ss$/,
      },
      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      // Images
      {
        test: /\.(png|jpg|jpeg|gif|webp)$/i,
        type: 'asset/resource',
      },
      // SVG
      {
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              prettier: false,
              svgo: false,
              svgoConfig: {
                plugins: [{ removeViewBox: false }],
              },
              titleProp: true,
              ref: true,
            },
          },
          'file-loader',
        ],
      },
    ],
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            // Strip all console.* calls in production — saves CPU from
            // string serialisation + object inspection on every event.
            drop_console: true,
            // Keep console.error so genuine errors still surface in Electron.
            pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
          },
        },
      }),
      new CssMinimizerPlugin(),
    ],
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 20,
      minSize: 20000,
      cacheGroups: {
        // General node_modules fallback (lowest priority)
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        // Charts — recharts + d3 tree is ~900 KB; only used in Analytics module
        recharts: {
          test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
          name: 'charts',
          chunks: 'all',
          priority: 20,
        },
        // Supabase client — loaded on every page but isolated for long-term caching
        supabase: {
          test: /[\\/]node_modules[\\/]@supabase[\\/]/,
          name: 'supabase',
          chunks: 'all',
          priority: 20,
        },
        // PDF export — jsPDF + jspdf-autotable are ~500 KB; only needed when printing
        // These are lazy-imported in Billing, NHIS, Reports, and ClinicalExport
        pdfExport: {
          test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable)[\\/]/,
          name: 'exports-pdf',
          chunks: 'async',
          priority: 30,
          enforce: true,
        },
        // XLSX — ~700 KB; only needed for Excel export actions
        xlsxExport: {
          test: /[\\/]node_modules[\\/]xlsx[\\/]/,
          name: 'exports-xlsx',
          chunks: 'async',
          priority: 30,
          enforce: true,
        },
        // Rich-text editor — react-quill ~400 KB; only used in MedicalReports
        richText: {
          test: /[\\/]node_modules[\\/](react-quill|quill)[\\/]/,
          name: 'rich-text-editor',
          chunks: 'async',
          priority: 30,
          enforce: true,
        },
      },
    },
  },

  plugins: [
    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     *
     * Supabase config is loaded from .env file at build time
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
      // Load Supabase config from .env at build time
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    }),

    new MiniCssExtractPlugin({
      filename: 'style.css',
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
      analyzerPort: 8889,
    }),

    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: false,
    }),

    new webpack.DefinePlugin({
      'process.type': '"renderer"',
    }),
  ],
};

export default merge(baseConfig, configuration);
