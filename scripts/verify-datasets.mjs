import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset, loadConfig } from './prepare-dataset.mjs';

function fail(message) {
  throw new Error(`Dataset verification failed: ${message}`);
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--help' || option === '-h') return { help: true };
    if (option !== '--source-root') {
      fail(`unknown option "${option}"`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`option "${option}" requires a value`);
    }
    options.sourceRoot = value;
    index += 1;
  }
  return options;
}

function usage() {
  return 'Usage: npm run data:verify -- --source-root <raw-data-dir>';
}

async function verifyDatasets(sourceRoot) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const configDirectory = path.join(repositoryRoot, 'data', 'datasets');
  const publishedDirectory = path.join(repositoryRoot, 'static', 'datasets');
  const configFiles = (await readdir(configDirectory))
    .filter((filename) => filename.endsWith('.json'))
    .sort();
  if (configFiles.length === 0) fail('no dataset configurations were found');

  const workspace = await mkdtemp(path.join(tmpdir(), 'dazniausi-zodziai-verify-'));
  try {
    for (const filename of configFiles) {
      const config = await loadConfig(path.join(configDirectory, filename));
      const generatedPath = path.join(workspace, `${config.id}.json`);
      const publishedPath = path.join(publishedDirectory, `${config.id}.json`);
      await buildDataset({ config, sourceRoot, outputPath: generatedPath });
      const [generated, published] = await Promise.all([readFile(generatedPath), readFile(publishedPath)]);
      if (!generated.equals(published)) {
        fail(`published ${config.id}.json does not match a fresh build from ${filename}`);
      }
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }

  return configFiles.length;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else if (!options.sourceRoot) {
      fail(`option "--source-root" is required\n${usage()}`);
    } else {
      const verified = await verifyDatasets(options.sourceRoot);
      console.log(`Verified ${verified} dataset${verified === 1 ? '' : 's'} byte-for-byte.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

export { verifyDatasets };
