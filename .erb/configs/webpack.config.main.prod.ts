/**
 * Webpack config for production electron main process
 */

import path from 'path';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import dotenv from 'dotenv';
import baseConfig from './webpack.config.base.js';
import webpackPaths from './webpack.paths.js';
import checkNodeEnv from '../scripts/check-node-env.js';
import deleteSourceMaps from '../scripts/delete-source-maps.js';

// Load .env file for production build
dotenv.config();

checkNodeEnv('production');
deleteSourceMaps();

const configuration: webpack.Configuration = {
  devtool: 'source-map',

  mode: 'production',

  target: 'electron-main',

  entry: {
    main: path.join(webpackPaths.srcMainPath, 'main.ts'),
    preload: path.join(webpackPaths.srcMainPath, 'preload.ts'),
  },

  output: {
    path: webpackPaths.distMainPath,
    filename: '[name].js',
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
    ],
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
    ],
  },

  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
      analyzerPort: 8888,
    }),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
      START_MINIMIZED: false,
      // Supabase config from .env at build time
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      // ICD API credentials for WHO ICD-11 service
      ICD_CLIENT_ID: process.env.ICD_CLIENT_ID || '',
      ICD_CLIENT_SECRET: process.env.ICD_CLIENT_SECRET || '',
      ICD_TOKEN_URL:
        process.env.ICD_TOKEN_URL ||
        'https://icdaccessmanagement.who.int/connect/token',
      ICD_API_BASE:
        process.env.ICD_API_BASE || 'https://id.who.int/icd/release/10/2010',
      // AI Clinical Assistant
      AI_PROVIDER: process.env.AI_PROVIDER || 'ollama',
      GROQ_API_KEY: process.env.GROQ_API_KEY || '',
      GROQ_CHAT_MODEL: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      OLLAMA_API_KEY: process.env.OLLAMA_API_KEY || '',
      OLLAMA_CHAT_MODEL:
        process.env.OLLAMA_CHAT_MODEL || 'qwen3-coder:480b-cloud',
      OLLAMA_EMBEDDING_MODEL:
        process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
      OLLAMA_EMBEDDING_DIMENSIONS:
        process.env.OLLAMA_EMBEDDING_DIMENSIONS || '768',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      GEMINI_CHAT_MODEL:
        process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash-lite',
      GEMINI_EMBEDDING_MODEL:
        process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      OPENAI_EMBEDDING_MODEL:
        process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    }),

    new webpack.DefinePlugin({
      'process.type': '"browser"',
    }),
  ],

  /**
   * Disables webpack processing of __dirname and __filename.
   * If you run the bundle in node.js it falls back to these values of node.js.
   * https://github.com/webpack/webpack/issues/2010
   */
  node: {
    __dirname: false,
    __filename: false,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
  },
};

export default configuration;
