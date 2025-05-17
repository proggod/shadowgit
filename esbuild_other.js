const esbuild = require("esbuild");
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const fs = require('fs');
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

	// Build webview (browser environment)
	const webviewCtx = await esbuild.context({
		entryPoints: {
			'webview': 'src/webview/index.tsx',
			'ai-editor': 'src/webview/ai-editor.tsx',
			'context-viewer': 'src/webview/context-viewer.tsx'
			// 'tool-call-debugger' entry point removed - no longer needed
		},
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outdir: 'dist',
		logLevel: 'silent',
		loader: {
			'.tsx': 'tsx',
			'.ts': 'ts',
			'.js': 'js',
			'.jsx': 'jsx',
			'.css': 'css',
			'.svg': 'dataurl',
			'.png': 'dataurl',
			'.jpg': 'dataurl',
			'.gif': 'dataurl'
		},
		plugins: [
			esbuildProblemMatcherPlugin,
			{
				name: 'postcss-plugin',
				setup(build) {
					build.onResolve({ filter: /\.css$/ }, args => {
						// Handle Prism.js CSS imports
						if (args.path.includes('prismjs')) {
							const prismPath = path.join(process.cwd(), 'node_modules', args.path);
							return { path: prismPath };
						}
						return { path: path.resolve(args.resolveDir, args.path) };
					});

					build.onLoad({ filter: /\.css$/ }, async (args) => {
						const css = await fs.promises.readFile(args.path, 'utf8');
						// Only process with PostCSS if it's not a Prism.js CSS file
						if (!args.path.includes('prismjs')) {
							const result = await postcss([tailwindcss, autoprefixer]).process(css, {
								from: args.path,
								to: args.path,
								map: { inline: true },
							});
							return {
								contents: result.css,
								loader: 'css',
							};
						}
						return {
							contents: css,
							loader: 'css',
						};
					});
				},
			},
		],
		resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'],
	});
	if (watch) {
		await Promise.all([
			extensionCtx.watch(),
			webviewCtx.watch()
		]);
	} else {
		await Promise.all([
			extensionCtx.rebuild(),
			webviewCtx.rebuild()
		]);
		await Promise.all([
			extensionCtx.dispose(),
			webviewCtx.dispose()
		]);
	}
}

/**
 * Copy package.json to dist directory with any necessary modifications
 */
function copyPackageJson() {
	const packageJsonPath = path.join(process.cwd(), 'package.json');
	const distPackageJsonPath = path.join(process.cwd(), 'dist', 'package.json');

	try {
		// Read the package.json file
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

		// Ensure enabledApiProposals exists
		if (!packageJson.enabledApiProposals) {
			packageJson.enabledApiProposals = [
				"extensionRuntime",
				"fileSearchProvider"
			];
		}

		// Create a minimal package.json for the dist directory
		// Include only the necessary fields to reduce size
		const distPackageJson = {
			name: packageJson.name,
			displayName: packageJson.displayName,
			description: packageJson.description,
			version: packageJson.version,
			publisher: packageJson.publisher,
			engines: packageJson.engines,
			main: packageJson.main,
			activationEvents: packageJson.activationEvents,
			contributes: packageJson.contributes,
			dependencies: packageJson.dependencies,
			enabledApiProposals: packageJson.enabledApiProposals,
			buildNumber: packageJson.buildNumber
		};

		// Write the modified package.json to the dist directory
		fs.writeFileSync(distPackageJsonPath, JSON.stringify(distPackageJson, null, 2));
		console.log(`Successfully copied package.json to dist directory`);
	} catch (error) {
		console.error(`Error copying package.json: ${error}`);
	}
}

async function runBuild() {
	await main();

	// Copy package.json to dist directory
	copyPackageJson();
}

runBuild().catch(e => {
	console.error(e);
	process.exit(1);
});
