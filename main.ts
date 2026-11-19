// Vice Cover Studio — entry program for gta6-cover-art-01.
// Node 22, standard library only. It assembles the submission: copy the
// app/ and screenshots/ trees from this repository into the output folder
// and write output/dossier.json with buildDossier from the vendored
// make.fun library (vendor/makefun-app.ts, kit copy, left untouched).
//
// Local check:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader MAKEFUN_OUTPUT_DIR is unset, so /output is used.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Directory this file lives in = the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Gate limits from the competition (reference/gate.json). The dossier text
// cap shapes the bytes; the other limits only refuse what the scorer
// would refuse anyway.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function main(): void {
  // Wipe the output directory first so stale files can never leak in.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  copyTree(join(repoRoot, 'app'), join(outDir, 'app'));
  if (existsSync(join(repoRoot, 'screenshots'))) {
    copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
  } else {
    mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
}

main();
