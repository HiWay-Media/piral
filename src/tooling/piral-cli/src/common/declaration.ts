import { DeclOptions, generateDeclaration, createDiffPlugin, Logger } from 'dets';
import { dirname, basename, resolve, extname } from 'path';
import { progress, log, logWarn, logVerbose, logInfo } from './log';
import { ForceOverwrite } from './enums';
import { retrievePiralRoot, retrievePiletsInfo, flattenExternals, validateSharedDependencies } from './package';
import { entryModuleExtensions, piralBaseRoot, packageJson } from './constants';
import { readText, getEntryFiles, matchFiles, createFileIfNotExists, readJson } from './io';
import { getModulePath } from '../external';
import { LogLevels } from '../types';

const piletApiName = 'PiletApi';

function findPiralBaseRoot(root: string, framework: string) {
  const piralJson = `${framework}/package.json`;

  if (piralJson !== piralBaseRoot) {
    try {
      const packageJsonPath = getModulePath(root, piralJson);
      return dirname(packageJsonPath);
    } catch {}
  }

  return root;
}

async function findPiralInstanceApi(piralInstance: string) {
  if (piralInstance) {
    const path = require.resolve(`${piralInstance}/${packageJson}`);
    const root = dirname(path);
    const data = await readJson(root, packageJson);
    const subpath = data.types || data.typings;

    if (subpath) {
      return [
        {
          file: resolve(root, subpath),
          name: piletApiName,
        },
      ];
    }
  }

  return [];
}

function findPiralBaseApi(root: string, framework: string) {
  // for some package managers, e.g., pnpm we need to first go into
  // some specifics before being able to retrieve "piral-base"
  const baseRoot = findPiralBaseRoot(root, framework);

  try {
    const packageJsonPath = getModulePath(baseRoot, piralBaseRoot);
    const projectDir = dirname(packageJsonPath);
    const project = require(packageJsonPath);
    // By default support for piral-base < 0.15
    const { piletApiTypings = 'lib/types.d.ts' } = project;

    return [
      {
        file: resolve(projectDir, piletApiTypings),
        name: piletApiName,
      },
    ];
  } catch (err) {
    log('generalError_0002', `Could not find the root API of "piral-base" from "${root}": ${err}`);
    return [];
  }
}

function findDeclaredTypings(root: string) {
  try {
    const { typings, extraTypes } = require(resolve(root, 'package.json'));

    if (extraTypes) {
      if (typeof extraTypes === 'string') {
        return [resolve(root, extraTypes)];
      } else if (Array.isArray(extraTypes)) {
        return extraTypes.filter((types) => typeof types === 'string').map((types) => resolve(root, types));
      }
    }

    if (typings) {
      return [resolve(root, typings)];
    }
  } catch {}

  return [];
}

async function getAllFiles(entryModules: Array<string>) {
  const files: Array<string> = [];
  const pattern = '**/+(*.ts|*.tsx|*.js|*.jsx)';
  const allFiles = await Promise.all(entryModules.map((m) => matchFiles(dirname(m), pattern)));

  for (const found of allFiles) {
    files.push(...found.filter((file) => !files.includes(file)));
  }

  return files;
}

async function getEntryModules(entryFiles: string) {
  if (!entryModuleExtensions.includes(extname(entryFiles).toLowerCase())) {
    const appFile = await readText(dirname(entryFiles), basename(entryFiles));
    const entryModules = await getEntryFiles(appFile, dirname(entryFiles));
    return entryModules;
  }

  return [entryFiles];
}

function createLogger(): Logger {
  return {
    error(message) {
      throw new Error(message);
    },
    info(message) {
      logInfo(message);
    },
    verbose(message) {
      logVerbose(message);
    },
    warn(message) {
      logWarn(message);
    },
  };
}

async function createDeclarationFile(
  options: DeclOptions,
  source: string,
  target: string,
  forceOverwrite: ForceOverwrite,
) {
  progress('Bundling declaration file ...');

  try {
    const result = await generateDeclaration(options);

    progress('Writing declaration file ...');
    await createFileIfNotExists(target, 'index.d.ts', result, forceOverwrite);
  } catch (ex) {
    log('declarationCouldNotBeGenerated_0076', source, ex);
  }
}

export async function createPiletDeclaration(
  name: string,
  piralInstances: Array<string>,
  root: string,
  entry: string,
  allowedImports: Array<string>,
  target: string,
  forceOverwrite: ForceOverwrite,
  logLevel: LogLevels,
) {
  const piralInstance = piralInstances[0];
  const apis = await findPiralInstanceApi(piralInstance);
  const file = apis.map((m) => m.file)[0];

  if (file) {
    const files = await getAllFiles([entry]);
    const types = findDeclaredTypings(root);
    const options: DeclOptions = {
      name: piralInstance,
      root,
      files,
      types,
      plugins: [createDiffPlugin(file)],
      apis,
      noModuleDeclaration: true,
      imports: allowedImports,
      logLevel,
      logger: createLogger(),
    };
    return await createDeclarationFile(options, root, target, forceOverwrite);
  }
}

export async function createPiralDeclaration(
  baseDir: string,
  entry: string,
  target: string,
  forceOverwrite: ForceOverwrite,
  logLevel: LogLevels,
) {
  progress('Reading configuration ...');
  const entryFiles = await retrievePiralRoot(baseDir, entry);
  const { name, root, externals, framework } = await retrievePiletsInfo(entryFiles);
  const entryModules = await getEntryModules(entryFiles);
  const files = await getAllFiles(entryModules);
  const options: DeclOptions = {
    name,
    root,
    files,
    types: findDeclaredTypings(root),
    apis: findPiralBaseApi(root, framework),
    noModuleDeclaration: true,
    imports: flattenExternals(externals, true),
    logLevel,
    logger: createLogger(),
  };

  validateSharedDependencies(externals);

  if (options.apis.length) {
    return await createDeclarationFile(options, baseDir, target, forceOverwrite);
  }

  log('declarationCouldNotBeGenerated_0076', baseDir, 'The main Pilet API interface could not be found.');
}
