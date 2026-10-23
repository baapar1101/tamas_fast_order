/** Mechanical, property-aware migration. Print/catalog dimensions and data palettes are excluded. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import ts from 'typescript';

const root = path.resolve('apps/web/src');
const write = process.argv.includes('--write');
const excluded = /(?:reference\.css|productsPortal\.css|temp_append\.css|CatalogPrintView|CatalogExportPage|MobileGlassCatalog|ProformaDocument|PrintInvoiceLayout|proforma\.css)$/;
const foreground = new Map(Object.entries({
  '#111827': 'text', '#0f172a': 'text', '#172033': 'text', '#182638': 'text', '#1e293b': 'text', '#102033': 'text',
  '#334155': 'text-secondary', '#475569': 'text-secondary', '#64748b': 'text-muted', '#6b7280': 'text-muted', '#94a3b8': 'text-muted', '#7b8795': 'text-muted',
  '#ef4444': 'danger', '#dc2626': 'danger', '#c52a40': 'danger', '#d1344a': 'danger', '#b91c1c': 'danger',
  '#10b981': 'success', '#059669': 'success', '#16a34a': 'success', '#15803d': 'success', '#07835c': 'success', '#088057': 'success',
  '#d97706': 'warning', '#f59e0b': 'warning', '#b45309': 'warning',
  '#0284c7': 'info', '#2563eb': 'info', '#3b82f6': 'info', '#0580fa': 'interactive',
  '#fff': 'on-interactive', '#ffffff': 'on-interactive',
}));
const surfaces = new Map(Object.entries({
  '#fff': 'surface', '#ffffff': 'surface', '#f8fafc': 'surface-subtle', '#f1f5f9': 'surface-subtle', '#f9fafb': 'surface-subtle', '#f4f7fb': 'canvas', '#f5f6f8': 'canvas',
  '#eff6ff': 'info-soft', '#e7f1ff': 'info-soft', '#dbeafe': 'info-soft', '#eff7ff': 'info-soft', '#e0f2fe': 'info-soft',
  '#dcfce7': 'success-soft', '#ecfdf5': 'success-soft', '#d1fae5': 'success-soft', '#dff8ec': 'success-soft',
  '#fee2e2': 'danger-soft', '#fef2f2': 'danger-soft', '#fee8e8': 'danger-soft',
  '#fef3c7': 'warning-soft', '#fffbeb': 'warning-soft', '#fff7ed': 'warning-soft',
}));
const borders = new Map(['#e2e8f0', '#e5e7eb', '#dce5ec', '#d1d5db', '#e7edf2', '#cbd5e1'].map((value) => [value, value === '#cbd5e1' ? 'border-strong' : 'border']));
const typeScale = new Map([[10,'2xs'],[11,'xs'],[12,'caption'],[13,'sm'],[14,'md'],[15,'md'],[16,'lg'],[18,'lead'],[20,'xl'],[22,'title'],[23,'title'],[24,'title'],[26,'2xl'],[27,'2xl'],[28,'2xl'],[30,'3xl'],[32,'3xl'],[36,'display'],[40,'display']]);
const spaces = new Map([[0,'0'],[4,'1'],[8,'2'],[12,'3'],[16,'4'],[20,'5'],[24,'6'],[32,'8'],[40,'10'],[48,'12'],[64,'16']]);
function tokenValue(property, value, media = false) {
  const prop = property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  if (prop === 'font-family' && !/inherit|mono|var\(/i.test(value)) return 'var(--ds-font-sans)';
  if (prop === 'font-size') {
    const match = /^(\d+(?:\.\d+)?)px$/.exec(value);
    const token = match ? typeScale.get(Number(match[1])) : null;
    if (token) return `var(--ds-text-${token})`;
  }
  if (/^(?:padding|margin)(?:-.*)?$|^(?:row-|column-)?gap$/.test(prop)) {
    return value.replace(/(?<![\w.-])(\d+)px\b/g, (raw, number) => spaces.has(Number(number)) ? `var(--ds-space-${spaces.get(Number(number))})` : raw);
  }
  const map = prop.includes('border') ? borders : /background/.test(prop) ? surfaces : /^(color|fill|stroke)$/.test(prop) ? foreground : null;
  if (!map || value.includes('var(')) return value;
  return value.replace(/#[\da-f]{3,8}\b/gi, (hex) => {
    const key = hex.toLowerCase();
    const name = media && /background/.test(prop) && ['#fff','#ffffff'].includes(key) ? 'media-surface' : map.get(key);
    return name ? `var(--ds-${name})` : hex;
  });
}
async function files(directory) {
  const output = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, item.name);
    if (item.isDirectory()) output.push(...await files(target)); else output.push(target);
  }
  return output;
}
const changed = [];
const writes = new Map();
for (const file of await files(root)) {
  if (file.includes(`${path.sep}styles${path.sep}`) || excluded.test(file.replace(/\.tsx$/, ''))) continue;
  const original = await readFile(file, 'utf8');
  let next = original;
  if (file.endsWith('.css')) {
    const css = postcss.parse(original, { from: file });
    css.walkDecls((declaration) => {
      let parent = declaration.parent;
      while (parent) {
        if (parent.type === 'atrule' && (parent.name === 'font-face' || (parent.name === 'media' && parent.params.includes('print')))) return;
        parent = parent.parent;
      }
      const media = /image|thumb|media|stage|logo/.test(declaration.parent?.selector ?? '');
      declaration.value = tokenValue(declaration.prop, declaration.value, media);
    });
    next = css.toString();
  } else if (file.endsWith('.tsx')) {
    const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const changes = [];
    function visit(node) {
      if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
        let parent = node.parent;
        let insideStyle = false;
        while (parent && !ts.isSourceFile(parent)) {
          if (ts.isJsxAttribute(parent) && parent.name.getText(source) === 'style') { insideStyle = true; break; }
          parent = parent.parent;
        }
        if (insideStyle) {
          const convert = (valueNode) => {
            if (ts.isConditionalExpression(valueNode)) { convert(valueNode.whenTrue); convert(valueNode.whenFalse); return; }
            if (!ts.isStringLiteral(valueNode) && !ts.isNumericLiteral(valueNode)) return;
            const value = ts.isNumericLiteral(valueNode) ? `${valueNode.text}px` : valueNode.text;
            const converted = tokenValue(node.name.text, value);
            if (converted !== value) changes.push({ start: valueNode.getStart(source), end: valueNode.end, text: JSON.stringify(converted) });
          };
          convert(node.initializer);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const change of changes.sort((a, b) => b.start - a.start)) next = next.slice(0, change.start) + change.text + next.slice(change.end);
  }
  if (next !== original) {
    changed.push(path.relative(root, file));
    if (write) writes.set(file, next);
  }
}
for (const [file, content] of writes) await writeFile(file, content);
console.log(JSON.stringify({ mode: write ? 'write' : 'audit', files: changed.length, changed }, null, 2));
if (process.argv.includes('--check') && changed.length) process.exitCode = 1;
