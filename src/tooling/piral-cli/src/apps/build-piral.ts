import { join, resolve } from 'path';
import { callPiralBuild } from '../bundler';
import { LogLevels, PiralBuildType } from '../types';
import {
  retrievePiletsInfo,
  retrievePiralRoot,
  removeDirectory,
  logDone,
  checkCliCompatibility,
  progress,
  setLogLevel,
  logReset,
  createEmulatorSources,
  log,
  logInfo,
  runScript,
  packageEmulator,
  normalizePublicUrl,
  getDestination,
  validateSharedDependencies,
  flattenExternals,
  createEmulatorWebsite,
} from '../common';

const allName = 'all';
const releaseName = 'release';
const emulatorName = 'emulator';
const emulatorPackageName = 'package';
const emulatorSourcesName = 'sources';
const emulatorWebsiteName = 'website';

export interface BuildPiralOptions {
  /**
   * The location of the piral
   */
  entry?: string;

  /**
   * Sets the target directory where the output of the bundling should be placed.
   */
  target?: string;

  /**
   * Sets the public URL (path) of the bundle. Only for release output.
   */
  publicUrl?: string;

  /**
   * Performs minification or other post-bundle transformations.
   */
  minify?: boolean;

  /**
   * Sets the log level to use.
   */
  logLevel?: LogLevels;

  /**
   * Places the build's output in an appropriate subdirectory (e.g., "emulator").
   */
  subdir?: boolean;

  /**
   * Performs a fresh build by removing the target directory first.
   */
  fresh?: boolean;

  /**
   * Selects the target type of the build (e.g. 'release'). "all" builds all target types.
   */
  type?: PiralBuildType;

  /**
   * Create associated source maps for the bundles.
   */
  sourceMaps?: boolean;

  /**
   * States if the build should run continuously and re-build when files change.
   */
  watch?: boolean;

  /**
   * Sets the bundler to use for building, if any specific.
   */
  bundlerName?: string;

  /**
   * Appends a hash to the side-bundle files.
   */
  contentHash?: boolean;

  /**
   * States if the node modules should be included for target transpilation
   */
  optimizeModules?: boolean;

  /**
   * Additional arguments for a specific bundler.
   */
  _?: Record<string, any>;

  /**
   * Hooks to be triggered at various stages.
   */
  hooks?: {
    onBegin?(e: any): Promise<void>;
    beforeBuild?(e: any): Promise<void>;
    afterBuild?(e: any): Promise<void>;
    beforeEmulator?(e: any): Promise<void>;
    afterEmulator?(e: any): Promise<void>;
    beforePackage?(e: any): Promise<void>;
    afterPackage?(e: any): Promise<void>;
    onEnd?(e: any): Promise<void>;
  };
}

export const buildPiralDefaults: BuildPiralOptions = {
  entry: './',
  target: './dist',
  publicUrl: '/',
  logLevel: LogLevels.info,
  fresh: false,
  minify: true,
  type: allName,
  subdir: true,
  sourceMaps: true,
  watch: false,
  contentHash: true,
  optimizeModules: false,
};

async function runLifecycle(root: string, scripts: Record<string, string>, type: string) {
  const script = scripts?.[type];

  if (script) {
    log('generalDebug_0003', `Running "${type}" ("${script}") ...`);
    await runScript(script, root);
    log('generalDebug_0003', `Finished running "${type}".`);
  } else {
    log('generalDebug_0003', `No script for "${type}" found ...`);
  }
}

export async function buildPiral(baseDir = process.cwd(), options: BuildPiralOptions = {}) {
  const {
    entry = buildPiralDefaults.entry,
    target = buildPiralDefaults.target,
    publicUrl: originalPublicUrl = buildPiralDefaults.publicUrl,
    logLevel = buildPiralDefaults.logLevel,
    minify = buildPiralDefaults.minify,
    sourceMaps = buildPiralDefaults.sourceMaps,
    watch = buildPiralDefaults.watch,
    contentHash = buildPiralDefaults.contentHash,
    subdir = buildPiralDefaults.subdir,
    fresh = buildPiralDefaults.fresh,
    type = buildPiralDefaults.type,
    optimizeModules = buildPiralDefaults.optimizeModules,
    _ = {},
    hooks = {},
    bundlerName,
  } = options;
  const publicUrl = normalizePublicUrl(originalPublicUrl);
  const fullBase = resolve(process.cwd(), baseDir);
  const useSubdir = type === 'all' || subdir;
  setLogLevel(logLevel);

  await hooks.onBegin?.({ options, fullBase });
  progress('Reading configuration ...');
  const entryFiles = await retrievePiralRoot(fullBase, entry);
  const {
    name,
    root,
    ignored,
    externals,
    scripts,
    emulator = emulatorPackageName,
  } = await retrievePiletsInfo(entryFiles);
  const piralInstances = [name];
  const dest = getDestination(entryFiles, resolve(fullBase, target));

  await checkCliCompatibility(root);

  validateSharedDependencies(externals);

  if (fresh) {
    progress('Removing output directory ...');
    await removeDirectory(dest.outDir);
  }

  // either take the explicit type or find out the implicit / default one
  const emulatorType = type === allName || type === emulatorName ? emulator : type.replace(`${emulatorName}-`, '');

  // only applies to an explicit emulator target (e.g., "emulator-website") or to "all" / "emulator" with the setting from the piral.json
  if ([emulatorSourcesName, emulatorPackageName, emulatorWebsiteName].includes(emulatorType)) {
    const emulatorPublicUrl = '/';
    const targetDir = useSubdir ? join(dest.outDir, emulatorName) : dest.outDir;
    const appDir = emulatorType !== emulatorWebsiteName ? join(targetDir, 'app') : targetDir;
    progress('Starting emulator build ...');

    // since we create this anyway let's just pretend we want to have it clean!
    await removeDirectory(targetDir);

    await hooks.beforeBuild?.({ root, publicUrl: emulatorPublicUrl, externals, entryFiles, targetDir, piralInstances });

    logInfo(`Bundle ${emulatorName} ...`);
    const {
      dir: outDir,
      name: outFile,
      hash,
    } = await callPiralBuild(
      {
        root,
        piralInstances,
        emulator: true,
        standalone: false,
        optimizeModules,
        sourceMaps,
        watch,
        contentHash,
        minify: false,
        externals: flattenExternals(externals),
        publicUrl: emulatorPublicUrl,
        entryFiles,
        logLevel,
        ignored,
        outDir: appDir,
        outFile: dest.outFile,
        _,
      },
      bundlerName,
    );

    await hooks.afterBuild?.({
      root,
      publicUrl: emulatorPublicUrl,
      externals,
      entryFiles,
      targetDir,
      piralInstances,
      hash,
      outDir,
      outFile,
    });

    await runLifecycle(root, scripts, 'piral:postbuild');
    await runLifecycle(root, scripts, `piral:postbuild-${emulatorName}`);

    await hooks.beforeEmulator?.({ root, externals, targetDir, outDir });

    let rootDir = root;

    switch (emulatorType) {
      case emulatorPackageName:
        rootDir = await createEmulatorSources(root, externals, outDir, outFile, logLevel);
        await hooks.beforePackage?.({ root, externals, targetDir, outDir, rootDir });
        await packageEmulator(rootDir);
        await hooks.afterPackage?.({ root, externals, targetDir, outDir, rootDir });
        break;
      case emulatorSourcesName:
        rootDir = await createEmulatorSources(root, externals, outDir, outFile, logLevel);
        logDone(`Emulator package sources available in "${rootDir}".`);
        break;
      case emulatorWebsiteName:
        rootDir = await createEmulatorWebsite(root, externals, outDir, outFile, logLevel);
        logDone(`Emulator website available in "${rootDir}".`);
        break;
    }

    await hooks.afterEmulator?.({ root, externals, targetDir, outDir, rootDir });
    logReset();
  }

  // either 'release' or 'all'
  if (type === releaseName || type === allName) {
    const targetDir = useSubdir ? join(dest.outDir, releaseName) : dest.outDir;
    progress('Starting release build ...');

    // since we create this anyway let's just pretend we want to have it clean!
    await removeDirectory(targetDir);

    logInfo(`Bundle ${releaseName} ...`);

    await hooks.beforeBuild?.({ root, publicUrl, externals, entryFiles, targetDir, piralInstances });

    const {
      dir: outDir,
      name: outFile,
      hash,
    } = await callPiralBuild(
      {
        root,
        piralInstances,
        emulator: false,
        standalone: false,
        optimizeModules,
        sourceMaps,
        watch,
        contentHash,
        minify,
        externals: flattenExternals(externals),
        publicUrl,
        outFile: dest.outFile,
        outDir: targetDir,
        entryFiles,
        logLevel,
        ignored,
        _,
      },
      bundlerName,
    );

    await hooks.afterBuild?.({
      root,
      publicUrl,
      externals,
      entryFiles,
      targetDir,
      piralInstances,
      outDir,
      outFile,
      hash,
    });

    await runLifecycle(root, scripts, 'piral:postbuild');
    await runLifecycle(root, scripts, `piral:postbuild-${releaseName}`);

    logDone(`Files for publication available in "${outDir}".`);
    logReset();
  }

  await hooks.onEnd?.({ root });
}
