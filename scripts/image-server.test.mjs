import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { renderImageServer, syncImageServer } from './sync-image-server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'backend', 'images.php'), 'utf8');
const destination = readFileSync(join(root, 'public', 'images.php'), 'utf8');
const block = text => text.match(/^\$CONFIG = \[\r?\n[\s\S]*?^\];/m)[0];

test('distribuição mantém a implementação canônica, a configuração local e os caminhos relativos', () => {
  assert.equal(renderImageServer(source, destination), destination);
  assert.equal(block(renderImageServer(source, destination)), block(destination));
  const normalized = destination.replace(/^\/\/ Arquivo gerado[^\n]*\n\/\/ Neste destino[^\n]*\n/m, '').replace(block(destination), () => block(source));
  assert.equal(normalized, source);
  assert.match(destination, /'upload_dir'\s*=> __DIR__ \. '\/uploads\/images\/'/);
  assert.match(destination, /'cache_dir'\s*=> __DIR__ \. '\/uploads\/cache\/'/);
});

test('geração preserva personalizações de configuração sem interpolar seu conteúdo', () => {
  const customConfig = "$CONFIG = [\n    'password' => 'destino-$&-$1',\n    'upload_dir' => __DIR__ . '/arquivos/',\n    'cache_dir' => __DIR__ . '/miniaturas/',\n    'max_initial_width' => 900,\n];";
  const customized = destination.replace(block(destination), () => customConfig);
  const rendered = renderImageServer(source, customized);
  assert.equal(block(rendered), customConfig);
  assert.match(rendered, /function handleUpload\(/);
  assert.equal(renderImageServer(source, rendered), rendered);
});

test('verificação detecta divergência sem escrever e sincronização é idempotente', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zap-images-'));
  try {
    mkdirSync(join(dir, 'backend'));
    mkdirSync(join(dir, 'public'));
    const changedSource = source.replace('function handleUpload(', '// Revisão da implementação\nfunction handleUpload(');
    writeFileSync(join(dir, 'backend', 'images.php'), changedSource);
    writeFileSync(join(dir, 'public', 'images.php'), destination);
    assert.throws(() => syncImageServer(dir, { check: true }), /desatualizado/);
    assert.equal(readFileSync(join(dir, 'public', 'images.php'), 'utf8'), destination);
    assert.equal(syncImageServer(dir), true);
    assert.equal(block(readFileSync(join(dir, 'public', 'images.php'), 'utf8')), block(destination));
    assert.equal(syncImageServer(dir), false);
    assert.equal(syncImageServer(dir, { check: true }), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('geração recusa origem ou configuração ambígua antes de produzir a distribuição', () => {
  assert.throws(() => renderImageServer('sem abertura PHP', destination), /origem PHP/);
  assert.throws(() => renderImageServer(source, '<?php\n'), /Destino/);
  assert.throws(() => renderImageServer(source, `${destination}\n${block(destination)}`), /Destino/);
});
