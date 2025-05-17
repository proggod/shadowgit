const esbuild = require("esbuild");
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

async function main() {
  // Build extension (Node.js environment)
  const extensionCtx = await esbuild.context({
    entryPoints: [
      'src/extension.ts'
    ],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'], // Only exclude vscode, include all other dependencies
    logLevel: 'silent',
    plugins: [
      esbuildProblemMatcherPlugin,
    ],
  });

  if (watch) {
    await extensionCtx.watch();
  } else {
    await extensionCtx.rebuild();
    await extensionCtx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});