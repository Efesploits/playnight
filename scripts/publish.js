/**
 * PLAY NIGHT — YAYINLAMA
 *
 *   npm run publish
 *
 * Yaptıkları:
 *   1. package.json'daki sürümü okur, dist/ içindeki exe'leri bulur
 *   2. Kurulum dosyalarını ayrı bir `dist` dalına koyup zorla iter
 *      (öksüz dal: main'in geçmişi 70 MB'lık binary'lerle şişmez)
 *   3. Sürüm bilgisini update.json'a yazıp main'e iter
 *
 * Uygulama açılışta update.json'a bakar; yeni sürüm varsa kurulum dosyasını
 * dist dalından indirir. GitHub Releases'e ya da API kimliğine gerek yoktur —
 * yalnızca `git push` yetiyor.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BIN_BRANCH = 'dist';
const RAW = (repo, branch, file) =>
  `https://raw.githubusercontent.com/${repo}/${branch}/${encodeURIComponent(file)}`;

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const gitLoud = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' });

function die(msg) {
  console.error('\n  HATA: ' + msg + '\n');
  process.exit(1);
}

/* ------------------------------------------------------------- hazırlık */
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

/* uzak depo adresinden "kullanici/depo" çıkar */
let repo;
try {
  const url = git('remote', 'get-url', 'origin');
  const m = url.match(/github\.com[:/]+([^/]+\/[^/.]+)/i);
  if (!m) die('origin bir GitHub deposu değil: ' + url);
  repo = m[1];
} catch {
  die('git remote "origin" bulunamadı');
}

const distDir = path.join(ROOT, 'dist');
if (!fs.existsSync(distDir)) die('dist/ yok. Önce "npm run dist" çalıştır.');

const setupSrc = path.join(distDir, `PlayNight-${version}-setup.exe`);
const portSrc = path.join(distDir, `PlayNight-${version}-portable.exe`);
if (!fs.existsSync(setupSrc)) die(`${path.basename(setupSrc)} yok. Önce "npm run dist" çalıştır.`);

/* Dosya adları sürümsüz: her yayında ÜSTÜNE yazılır, adres hep aynı kalır. */
const SETUP_NAME = 'PlayNight-setup.exe';
const PORT_NAME = 'PlayNight-portable.exe';

const clean = git('status', '--porcelain');
if (clean) {
  console.log('  Not: çalışma ağacında kaydedilmemiş değişiklikler var.');
}
const startBranch = git('rev-parse', '--abbrev-ref', 'HEAD');

/* ------------------------------------------- 1) binary'leri dist dalına */
console.log(`\n  Play Night v${version} -> ${repo}\n`);
console.log('  [1/3] Kurulum dosyaları "dist" dalına yükleniyor…');

const staging = path.join(require('os').tmpdir(), 'playnight-publish-' + Date.now());
fs.mkdirSync(staging, { recursive: true });

try {
  /* Ayrı bir çalışma kopyası: ana klasördeki dosyalara dokunmayalım */
  execFileSync('git', ['worktree', 'add', '--detach', staging], { cwd: ROOT, stdio: 'pipe' });

  const wt = (...args) =>
    execFileSync('git', args, { cwd: staging, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  /* öksüz dal: geçmiş biriktirmesin, her yayında sıfırdan */
  wt('checkout', '--orphan', BIN_BRANCH);
  wt('rm', '-rf', '--cached', '.');
  for (const f of fs.readdirSync(staging)) {
    if (f === '.git') continue;
    fs.rmSync(path.join(staging, f), { recursive: true, force: true });
  }

  fs.copyFileSync(setupSrc, path.join(staging, SETUP_NAME));
  if (fs.existsSync(portSrc)) fs.copyFileSync(portSrc, path.join(staging, PORT_NAME));
  fs.writeFileSync(path.join(staging, 'README.md'),
    `# Play Night — kurulum dosyaları\n\n` +
    `Bu dal yalnızca uygulamanın indirdiği kurulum dosyalarını tutar.\n` +
    `Kaynak kod \`main\` dalındadır. Her yayında bu dal sıfırdan yazılır.\n\n` +
    `Güncel sürüm: **v${version}**\n`);

  wt('add', '-A');
  wt('-c', 'user.name=Play Night Publisher', '-c', 'user.email=publisher@users.noreply.github.com',
    'commit', '-q', '-m', `Play Night v${version} kurulum dosyalari`);
  console.log('        gönderiliyor (70+ MB, biraz sürebilir)…');
  execFileSync('git', ['push', '--force', 'origin', `HEAD:${BIN_BRANCH}`],
    { cwd: staging, stdio: 'inherit' });
} finally {
  try { execFileSync('git', ['worktree', 'remove', '--force', staging], { cwd: ROOT, stdio: 'pipe' }); } catch {}
  try { fs.rmSync(staging, { recursive: true, force: true }); } catch {}
}

/* -------------------------------------------------- 2) manifesti yaz -- */
console.log('  [2/3] update.json yazılıyor…');

let notes = '';
const notesPath = path.join(ROOT, 'RELEASE_NOTES.md');
if (fs.existsSync(notesPath)) {
  notes = fs.readFileSync(notesPath, 'utf8')
    .replace(/^#\s*Play Night.*$/m, '')      // başlığı at
    .trim()
    .slice(0, 3500);
}

const stat = (p) => (fs.existsSync(p) ? fs.statSync(p).size : 0);
const manifest = {
  version,
  publishedAt: new Date().toISOString(),
  notes,
  pageUrl: `https://github.com/${repo}`,
  setup: { name: SETUP_NAME, url: RAW(repo, BIN_BRANCH, SETUP_NAME), size: stat(setupSrc) },
  portable: fs.existsSync(portSrc)
    ? { name: PORT_NAME, url: RAW(repo, BIN_BRANCH, PORT_NAME), size: stat(portSrc) }
    : null,
};
fs.writeFileSync(path.join(ROOT, 'update.json'), JSON.stringify(manifest, null, 2) + '\n');

/* ---------------------------------------------- 3) manifesti main'e it */
console.log('  [3/3] Manifest gönderiliyor…');
git('add', 'update.json');
try {
  git('commit', '-q', '-m', `Surum yayinla: v${version}`);
} catch {
  console.log('        (manifest değişmemiş, yeni commit yok)');
}
gitLoud('push', 'origin', startBranch);

console.log(`\n  Yayınlandı: v${version}`);
console.log(`  Manifest : ${RAW(repo, startBranch, 'update.json')}`);
console.log(`  Kurulum  : ${manifest.setup.url}`);
console.log('\n  Uygulamalar açılışta bunu görüp güncellemeyi teklif edecek.\n');
