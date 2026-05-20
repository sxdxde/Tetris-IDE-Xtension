import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Supported languages
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES = new Set([
  'javascript','typescript','javascriptreact','typescriptreact',
  'python','java','c','cpp','go',
]);

// ---------------------------------------------------------------------------
// Tetris palette — one color per piece type, assigned by function name hash
// ---------------------------------------------------------------------------

const PALETTE = [
  '#00FFFF', // I — cyan
  '#FFD700', // O — gold
  '#CC44FF', // T — purple
  '#00EE44', // S — green
  '#FF4444', // Z — red
  '#4488FF', // J — blue
  '#FF8800', // L — orange
];

function nameToColorIdx(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
  }
  return h % PALETTE.length;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha})`;
}

// ---------------------------------------------------------------------------
// Decoration types — one per palette entry, recreated on demand
// ---------------------------------------------------------------------------

let decorationTypes: vscode.TextEditorDecorationType[] = [];

function makeDecorationTypes(): vscode.TextEditorDecorationType[] {
  return PALETTE.map(color =>
    vscode.window.createTextEditorDecorationType({
      color,
      backgroundColor: hexToRgba(color, 0.13),
      fontWeight: '600',
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    })
  );
}

// ---------------------------------------------------------------------------
// Keyword block-lists
// ---------------------------------------------------------------------------

const JS_KW = new Set([
  'if','else','for','while','do','switch','try','catch','finally','return',
  'new','delete','typeof','instanceof','in','of','class','extends','import',
  'export','from','default','async','await','yield','function','var','let',
  'const','this','super','null','undefined','true','false','void','throw',
  'case','break','continue','debugger','static','public','private','protected',
  'get','set','abstract','override','readonly','interface','type','enum',
  'namespace','module','declare','as','is','satisfies',
]);

const PY_KW = new Set([
  'if','elif','else','for','while','with','try','except','finally','return',
  'yield','raise','pass','break','continue','import','from','as','class',
  'lambda','and','or','not','in','is','None','True','False','global',
  'nonlocal','del','assert','print',
]);

const GO_KW = new Set([
  'if','else','for','switch','select','return','go','defer','fallthrough',
  'break','continue','goto','var','const','type','struct','interface','map',
  'chan','range','import','package','func','make','new','len','cap','append',
  'copy','delete','close','panic','recover','print','println',
]);

const C_KW = new Set([
  'if','else','for','while','do','switch','return','break','continue','goto',
  'sizeof','struct','union','enum','typedef','extern','static','void','int',
  'float','double','char','long','short','unsigned','signed','const','volatile',
  'register','auto','inline','restrict','true','false','NULL','null',
]);

const JAVA_KW = new Set([
  'if','else','for','while','do','switch','return','break','continue','new',
  'class','interface','extends','implements','super','this','null','true',
  'false','void','int','float','double','char','boolean','long','short','byte',
  'final','static','abstract','synchronized','native','transient','volatile',
  'public','private','protected','throw','throws','try','catch','finally',
  'import','package','instanceof','enum','assert','default','goto','strictfp',
]);

function kw(lang: string): Set<string> {
  if (lang === 'python') return PY_KW;
  if (lang === 'go') return GO_KW;
  if (lang === 'c' || lang === 'cpp') return C_KW;
  if (lang === 'java') return JAVA_KW;
  return JS_KW;
}

// ---------------------------------------------------------------------------
// Offset-range helpers
// ---------------------------------------------------------------------------

interface OR { start: number; end: number; }

function add(map: Map<string, OR[]>, name: string, s: number, e: number): void {
  if (s >= e) return;
  const arr = map.get(name) ?? [];
  arr.push({ start: s, end: e });
  map.set(name, arr);
}

// ---------------------------------------------------------------------------
// Declaration extraction — returns Map<funcName, OR[]>
// ---------------------------------------------------------------------------

function extractJsTs(text: string, keywords: Set<string>): Map<string, OR[]> {
  const out = new Map<string, OR[]>();
  let m: RegExpExecArray | null;

  // Named functions (including async / generator)
  const namedFn = /\b((?:async\s+)?function\s*\*?\s*)(\w[\w$]*)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
  while ((m = namedFn.exec(text)) !== null) {
    const name = m[2];
    if (keywords.has(name)) continue;
    add(out, name, m.index, m.index + m[0].length);
  }

  // Class / object methods
  const method = /^(\s*)((?:(?:async|static|get|set|public|private|protected|override|abstract|readonly)\s+)*)([a-zA-Z_$][\w$]*)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s*:\s*(?:[\w<>\[\]|& ,.?!*]+))?(?=\s*[{;])/gm;
  while ((m = method.exec(text)) !== null) {
    const name = m[3];
    if (keywords.has(name)) continue;
    add(out, name, m.index + m[1].length, m.index + m[0].length);
  }

  // Arrow functions — highlight variable name AND the => token
  const arrow = /\b(const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(async\s+)?(?:\([^)]*(?:\([^)]*\)[^)]*)*\)|[\w$]+)\s*(=>)/g;
  while ((m = arrow.exec(text)) !== null) {
    const name = m[2];
    if (keywords.has(name)) continue;
    const nameOff = m[0].indexOf(name, m[1].length);
    add(out, name, m.index + nameOff, m.index + nameOff + name.length);
    const arrowOff = m[0].lastIndexOf('=>');
    add(out, name, m.index + arrowOff, m.index + arrowOff + 2);
  }

  return out;
}

function extractPython(text: string, keywords: Set<string>): Map<string, OR[]> {
  const out = new Map<string, OR[]>();
  const def = /\b((?:async\s+)?def\s+(\w+)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)(?:\s*->[^:]+)?)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = def.exec(text)) !== null) {
    const name = m[2];
    if (keywords.has(name)) continue;
    add(out, name, m.index, m.index + m[1].length);
  }
  return out;
}

function extractGo(text: string, keywords: Set<string>): Map<string, OR[]> {
  const out = new Map<string, OR[]>();
  const fn = /\bfunc\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)/g;
  let m: RegExpExecArray | null;
  while ((m = fn.exec(text)) !== null) {
    const name = m[1];
    if (keywords.has(name)) continue;
    add(out, name, m.index, m.index + m[0].length);
  }
  return out;
}

function extractJava(text: string, keywords: Set<string>): Map<string, OR[]> {
  const out = new Map<string, OR[]>();
  const method = /^(\s*)((?:(?:public|private|protected|static|final|abstract|synchronized|native|default)\s+)*)(?:[\w<>\[\],? ]+\s+)(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+throws\s+[\w,\s]+)?(?=\s*\{)/gm;
  let m: RegExpExecArray | null;
  while ((m = method.exec(text)) !== null) {
    const name = m[3];
    if (keywords.has(name)) continue;
    add(out, name, m.index + m[1].length, m.index + m[0].length);
  }
  return out;
}

function extractC(text: string, keywords: Set<string>): Map<string, OR[]> {
  const out = new Map<string, OR[]>();
  const fn = /^(\s*)((?:(?:static|extern|inline|virtual|explicit|constexpr|override|const)\s+)*)(?:[\w:*& ]+\s+)(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+const)?(?=\s*[{;])/gm;
  let m: RegExpExecArray | null;
  while ((m = fn.exec(text)) !== null) {
    const name = m[3];
    if (keywords.has(name)) continue;
    add(out, name, m.index + m[1].length, m.index + m[0].length);
  }
  return out;
}

function extractDeclarations(text: string, lang: string): Map<string, OR[]> {
  const k = kw(lang);
  if (lang === 'python') return extractPython(text, k);
  if (lang === 'go') return extractGo(text, k);
  if (lang === 'java') return extractJava(text, k);
  if (lang === 'c' || lang === 'cpp') return extractC(text, k);
  return extractJsTs(text, k);
}

// ---------------------------------------------------------------------------
// Call extraction — only for names that were declared in this file
// ---------------------------------------------------------------------------

function extractCalls(text: string, declared: Set<string>): Map<string, OR[]> {
  const out = new Map<string, OR[]>();
  const pat = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = pat.exec(text)) !== null) {
    const name = m[1];
    if (declared.has(name)) add(out, name, m.index, m.index + name.length);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Apply decorations to an editor
// ---------------------------------------------------------------------------

function applyDecorations(editor: vscode.TextEditor): void {
  const lang = editor.document.languageId;

  if (!SUPPORTED_LANGUAGES.has(lang)) {
    for (const dt of decorationTypes) editor.setDecorations(dt, []);
    return;
  }

  const text = editor.document.getText();
  const declMap = extractDeclarations(text, lang);
  const callMap = extractCalls(text, new Set(declMap.keys()));

  // Sort ranges into per-color buckets
  const buckets: vscode.Range[][] = PALETTE.map(() => []);

  function flush(map: Map<string, OR[]>) {
    for (const [name, offsets] of map) {
      const ci = nameToColorIdx(name);
      for (const { start, end } of offsets) {
        buckets[ci].push(
          new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(end))
        );
      }
    }
  }

  flush(declMap);
  flush(callMap);

  for (let i = 0; i < decorationTypes.length; i++) {
    editor.setDecorations(decorationTypes[i], buckets[i]);
  }
}

// ---------------------------------------------------------------------------
// Debounce helper
// ---------------------------------------------------------------------------

const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

function applyDebounced(editor: vscode.TextEditor, ms = 250): void {
  const key = editor.document.uri.toString();
  const t = debounceMap.get(key);
  if (t !== undefined) clearTimeout(t);
  debounceMap.set(key, setTimeout(() => {
    debounceMap.delete(key);
    applyDecorations(editor);
  }, ms));
}

function applyToAllVisible(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    applyDecorations(editor);
  }
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  decorationTypes = makeDecorationTypes();
  applyToAllVisible();

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) applyDecorations(editor);
    }),
    vscode.window.onDidChangeVisibleTextEditors(editors => {
      for (const e of editors) applyDecorations(e);
    }),
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
      if (editor) applyDebounced(editor);
    }),
  );
}

export function deactivate(): void {
  for (const dt of decorationTypes) dt.dispose();
  for (const t of debounceMap.values()) clearTimeout(t);
}
