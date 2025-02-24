import { dirname, resolve } from 'path';
import {
  setLogLevel,
  logDone,
  createPiletDeclaration,
  ForceOverwrite,
  matchAnyPilet,
  retrievePiletData,
  combinePiletExternals,
} from '../common';
import { LogLevels } from '../types';

export interface DeclarationPiletOptions {
  /**
   * The source index file (e.g. index.tsx) for collecting all the information
   * @example './src/index'
   */
  entry?: string | Array<string>;

  /**
   * The target directory where the d.ts will be created.
   */
  target?: string;

  /**
   * Specifies ff the target d.ts would be overwrwitten.
   */
  forceOverwrite?: ForceOverwrite;

  /**
   * Sets the log level to use (1-5).
   */
  logLevel?: LogLevels;
}

export const declarationPiletDefaults: DeclarationPiletOptions = {
  entry: './',
  target: './dist',
  forceOverwrite: ForceOverwrite.yes,
  logLevel: LogLevels.info,
};

export async function declarationPilet(baseDir = process.cwd(), options: DeclarationPiletOptions = {}) {
  const {
    entry = declarationPiletDefaults.entry,
    target = declarationPiletDefaults.target,
    forceOverwrite = declarationPiletDefaults.forceOverwrite,
    logLevel = declarationPiletDefaults.logLevel,
  } = options;
  const entryList = Array.isArray(entry) ? entry : [entry];
  const fullBase = resolve(process.cwd(), baseDir);
  setLogLevel(logLevel);

  const allEntries = await matchAnyPilet(fullBase, entryList);

  for (const item of allEntries) {
    const targetDir = dirname(item);
    const { peerDependencies, peerModules, root, apps, piletPackage, ignored, importmap, schema } =
      await retrievePiletData(targetDir);
    const piralInstances = apps.map((m) => m.appPackage.name);
    const externals = combinePiletExternals(piralInstances, peerDependencies, peerModules, importmap);
    const dest = resolve(root, target);
    const outDir = dirname(dest);

    await createPiletDeclaration(
      piletPackage.name,
      piralInstances,
      root,
      item,
      externals,
      outDir,
      forceOverwrite,
      logLevel,
    );
  }

  logDone(`Declaration created successfully in "${target}"!`);
}
