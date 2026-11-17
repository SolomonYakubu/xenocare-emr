/**
 * Base webpack config used across other specific configs
 */

import * as webpack from 'webpack';
import * as path from 'path';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';

// Load .env file
import * as dotenv from 'dotenv';
import webpackPaths from './webpack.paths.js';

const _require = require;
const { dependencies: externals } = _require('../../release/app/package.json');
dotenv.config();

const configuration: webpack.Configuration = {
  externals: [...Object.keys(externals || {})],

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
            },
          },
        },
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: { type: 'commonjs2' },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // Ensure single copy of React to prevent "Invalid hook call" errors
    alias: {
      react: path.resolve(webpackPaths.rootPath, 'node_modules/react'),
      'react-dom': path.resolve(
        webpackPaths.rootPath,
        'node_modules/react-dom',
      ),
    },
    // There is no need to add aliases here, the paths in tsconfig get mirrored
    plugins: [new TsconfigPathsPlugins()],
  },

  plugins: [
    // IMPORTANT: Every process.env.X used in src/renderer/ MUST be listed here.
    // The renderer runs in a sandboxed browser context where `process` is undefined.
    // EnvironmentPlugin replaces process.env.X at compile time so the `process`
    // global is never accessed at runtime. Missing entries cause:
    //   "Uncaught ReferenceError: process is not defined" → blank green screen.
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: 'false',
      // NOTE: SUPABASE env vars are handled differently in dev vs production:
      // - Development (npm start): Uses .env values via dotenv-webpack in renderer.dev config
      // - Production (npm run package): Empty strings, uses runtime config (localStorage/Electron config)
      // This allows production clients to configure their own server URL at runtime
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      // Supabase resilient-fetch tuning (src/renderer/api/supabaseClient.ts)
      SUPABASE_REQUEST_TIMEOUT_MS: '',
      SUPABASE_RETRY_ATTEMPTS: '',
      SUPABASE_SUCCESS_WARN_THRESHOLD_MS: '',
      SUPABASE_PERF_LOG: '',
      // Observability (src/renderer/utils/observability.ts)
      OBS_REPEAT_SUPPRESS_MS: '',
      // UI feature flags (src/renderer/components/ui/GlobalMutationSyncIndicator.tsx)
      REACT_APP_SHOW_SYNC_INDICATOR: '',
      // Background mutation manager (src/renderer/lib/mutations/backgroundMutationManager.ts)
      BACKGROUND_MUTATION_MAX_CONCURRENT: '',
      BACKGROUND_MUTATION_TELEMETRY: '',
      // AI Clinical Assistant configuration
      AI_PROVIDER: 'ollama',
      GROQ_API_KEY: '',
      GROQ_CHAT_MODEL: 'llama-3.3-70b-versatile',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OLLAMA_API_KEY: '',
      OLLAMA_CHAT_MODEL: 'qwen3-coder:480b-cloud',
      OLLAMA_EMBEDDING_MODEL: 'nomic-embed-text',
      OLLAMA_EMBEDDING_DIMENSIONS: '768',
      GEMINI_API_KEY: '',
      GEMINI_CHAT_MODEL: 'gemini-2.5-flash-lite',
      GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
      OPENAI_API_KEY: '',
      OPENAI_CHAT_MODEL: 'gpt-4o-mini',
      OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
    }),
  ],
};

export default configuration;
