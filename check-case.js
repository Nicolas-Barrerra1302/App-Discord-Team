#!/usr/bin/env node
/**
 * check-case.js — Detecta imports con case-mismatch en Linux/Vercel.
 * Uso: node check-case.js
 * Escanea src/ y alerta si la ruta importada no coincide exactamente
 * con el nombre del archivo real en disco.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'src');
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IMPORT_RE = /(?:import|from|require)\s*[\(\s]*['"]([^'"]+)['"]/g;

// Resuelve la ruta real con case exacto usando readdir
function resolveRealPath(importedPath) {
  const parts = importedPath.split('/');
  let current = parts[0].startsWith('/')
    ? '/'
    : path.isAbsolute(importedPath)
    ? ''
    : null;

  if (current === null) return null; // alias (@/) o módulo externo — skip

  for (const part of parts) {
    if (!part) continue;
    try {
      const entries = fs.readdirSync(current || '/');
      const match = entries.find(e => e === part);
      if (!match) return null; // no existe
      current = path.join(current || '/', match);
    } catch {
      return null;
    }
  }
  return current;
}

// Convierte @/... o rutas relativas a rutas absolutas de disco
function resolveImportPath(importStr, fromFile) {
  if (importStr.startsWith('@/')) {
    return path.join(__dirname, 'src', importStr.slice(2));
  }
  if (importStr.startsWith('.')) {
    return path.resolve(path.dirname(fromFile), importStr);
  }
  return null; // node_modules u otro alias — skip
}

// Dado un path sin extensión, prueba extensiones y /index.*
function findFileOnDisk(base) {
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const idx = path.join(base, 'index' + ext);
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

// Recorre src/ recursivamente y devuelve todos los archivos TS/TSX/JS/JSX
function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

// Compara path importado con el path real en disco usando readdirSync (case-sensitive)
function hasCaseMismatch(importedAbs, fromFile) {
  const parts = importedAbs.split(path.sep);
  let current = parts[0] + path.sep; // raíz (C:\ en Win, / en Linux)

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    let entries;
    try {
      entries = fs.readdirSync(current);
    } catch {
      return false; // no se puede leer — skip
    }
    const exactMatch = entries.find(e => e === part);
    const caseInsensitiveMatch = entries.find(
      e => e.toLowerCase() === part.toLowerCase()
    );

    if (!exactMatch && caseInsensitiveMatch) {
      return {
        expected: path.join(current, caseInsensitiveMatch),
        got: path.join(current, part),
      };
    }
    if (!exactMatch && !caseInsensitiveMatch) {
      return false; // el archivo no existe en absoluto — otro problema
    }
    current = path.join(current, part);
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const files = walkDir(ROOT);
const errors = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  IMPORT_RE.lastIndex = 0;

  while ((match = IMPORT_RE.exec(content)) !== null) {
    const importStr = match[1];
    const absBase = resolveImportPath(importStr, file);
    if (!absBase) continue;

    const absFile = findFileOnDisk(absBase) ?? absBase;
    const mismatch = hasCaseMismatch(absFile, file);

    if (mismatch) {
      errors.push({
        file: path.relative(__dirname, file),
        import: importStr,
        diskPath: path.relative(__dirname, mismatch.expected),
        importedAs: path.relative(__dirname, mismatch.got),
      });
    }
  }
}

if (errors.length === 0) {
  console.log('✅  No se encontraron case-mismatches en los imports.\n');
  process.exit(0);
}

console.log(`\n❌  Se encontraron ${errors.length} case-mismatch(es):\n`);
for (const e of errors) {
  console.log(`  Archivo: ${e.file}`);
  console.log(`  Import:  "${e.import}"`);
  console.log(`  En disco (real): ${e.diskPath}`);
  console.log(`  Importado como:  ${e.importedAs}`);
  console.log('');
}
process.exit(1);
