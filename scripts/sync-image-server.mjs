import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const generatedNotice = '// Arquivo gerado por npm run images:sync a partir de backend/images.php.\n' +
  '// Neste destino, edite somente o bloco $CONFIG; altere a implementação na origem.\n';

function configBlock(source, label) {
  const blocks = [...source.matchAll(/^\$CONFIG = \[\r?\n[\s\S]*?^\];/gm)];
  if (blocks.length !== 1) {
    throw new Error(`${label}: esperado um único bloco $CONFIG delimitado por linhas próprias.`);
  }
  return blocks[0][0];
}

export function renderImageServer(source, destination) {
  if (!source.startsWith('<?php\n')) {
    throw new Error('A origem PHP deve começar com <?php e uma quebra de linha LF.');
  }
  const sourceConfig = configBlock(source, 'Origem');
  const destinationConfig = configBlock(destination, 'Destino');
  const implementation = source.replace(sourceConfig, () => destinationConfig);
  return implementation.replace('<?php\n', `<?php\n${generatedNotice}`);
}

export function syncImageServer(rootDir, { check = false } = {}) {
  const sourcePath = join(rootDir, 'backend', 'images.php');
  const destinationPath = join(rootDir, 'public', 'images.php');
  const source = readFileSync(sourcePath, 'utf8');
  // O destino é necessário para preservar sua configuração, inclusive a senha.
  const destination = readFileSync(destinationPath, 'utf8');
  const generated = renderImageServer(source, destination);
  if (generated === destination) return false;
  if (check) {
    throw new Error('public/images.php está desatualizado. Execute npm run images:sync e revise a diferença.');
  }
  writeFileSync(destinationPath, generated);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const changed = syncImageServer(rootDir, { check: process.argv.includes('--check') });
    console.log(changed ? 'Distribuição PHP atualizada; configuração do destino preservada.' : 'Distribuição PHP consistente com a origem.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
