import * as vscode from 'vscode';

// ─── Supported languages ──────────────────────────────────────────────────────

const SUPPORTED = new Set([
  'javascript','typescript','javascriptreact','typescriptreact',
  'python','java','c','cpp','go',
  'csharp','rust','php','swift','kotlin','ruby',
]);

// ─── Keyword blocklists ───────────────────────────────────────────────────────

const JS_KW     = new Set(['if','else','for','while','do','switch','try','catch','finally','return','new','delete','typeof','instanceof','in','of','class','extends','import','export','from','default','async','await','yield','function','var','let','const','this','super','null','undefined','true','false','void','throw','case','break','continue','debugger','static','public','private','protected','get','set','abstract','override','readonly','interface','type','enum','namespace','module','declare','as','is','satisfies']);
const PY_KW     = new Set(['if','elif','else','for','while','with','try','except','finally','return','yield','raise','pass','break','continue','import','from','as','class','lambda','and','or','not','in','is','None','True','False','global','nonlocal','del','assert','print']);
const GO_KW     = new Set(['if','else','for','switch','select','return','go','defer','fallthrough','break','continue','goto','var','const','type','struct','interface','map','chan','range','import','package','func','make','new','len','cap','append','copy','delete','close','panic','recover','print','println']);
const C_KW      = new Set(['if','else','for','while','do','switch','return','break','continue','goto','sizeof','struct','union','enum','typedef','extern','static','void','int','float','double','char','long','short','unsigned','signed','const','volatile','register','auto','inline','restrict','true','false','NULL','null']);
const JAVA_KW   = new Set(['if','else','for','while','do','switch','return','break','continue','new','class','interface','extends','implements','super','this','null','true','false','void','int','float','double','char','boolean','long','short','byte','final','static','abstract','synchronized','native','transient','volatile','public','private','protected','throw','throws','try','catch','finally','import','package','instanceof','enum','assert','default','goto','strictfp']);
const CSHARP_KW = new Set(['if','else','for','foreach','while','do','switch','return','break','continue','new','class','interface','struct','enum','namespace','using','public','private','protected','internal','static','abstract','virtual','override','sealed','readonly','const','void','int','long','short','byte','float','double','decimal','char','bool','string','object','var','null','true','false','this','base','throw','try','catch','finally','delegate','event','out','ref','in','params','async','await','yield','is','as','typeof','sizeof','checked','unchecked','lock','goto','default','case','where','record','init','with','required','file','scoped']);
const RUST_KW   = new Set(['if','else','for','while','loop','match','return','break','continue','fn','let','mut','const','struct','enum','impl','trait','pub','use','mod','crate','super','self','Self','move','async','await','where','type','static','extern','unsafe','in','ref','true','false','None','Some','Ok','Err','dyn','box','as','macro_rules']);
const PHP_KW    = new Set(['if','else','elseif','while','for','foreach','do','switch','return','break','continue','function','class','interface','extends','implements','new','echo','print','include','require','use','namespace','public','private','protected','static','abstract','final','null','true','false','NULL','TRUE','FALSE','$this','self','parent','yield','throw','try','catch','finally','match','fn','readonly','enum']);
const SWIFT_KW  = new Set(['if','else','guard','for','while','repeat','switch','return','break','continue','fallthrough','defer','throw','func','var','let','class','struct','enum','protocol','extension','import','public','private','internal','fileprivate','open','static','final','override','init','deinit','super','self','true','false','nil','in','is','as','try','catch','throws','rethrows','async','await','some','any','where','case','default','typealias','associatedtype','willSet','didSet','get','set','actor','isolated','nonisolated','consuming','borrowing']);
const KOTLIN_KW = new Set(['if','else','for','while','do','when','return','break','continue','fun','val','var','class','interface','object','companion','init','constructor','super','this','null','true','false','in','is','as','try','catch','throw','finally','import','package','public','private','protected','internal','abstract','open','final','override','data','sealed','enum','annotation','by','where','out','crossinline','noinline','reified','suspend','inline','typealias','it','lateinit','const','object','tailrec','operator','infix','external','actual','expect']);
const RUBY_KW   = new Set(['if','elsif','else','unless','while','until','for','do','case','when','then','begin','rescue','ensure','retry','return','yield','raise','fail','next','break','def','end','class','module','in','and','or','not','true','false','nil','self','super','__FILE__','__LINE__','__method__','lambda','proc','puts','print','p','require','require_relative','include','extend','attr_accessor','attr_reader','attr_writer']);

function kwFor(lang: string): Set<string> {
  if (lang === 'python')  return PY_KW;
  if (lang === 'go')      return GO_KW;
  if (lang === 'c' || lang === 'cpp') return C_KW;
  if (lang === 'java')    return JAVA_KW;
  if (lang === 'csharp')  return CSHARP_KW;
  if (lang === 'rust')    return RUST_KW;
  if (lang === 'php')     return PHP_KW;
  if (lang === 'swift')   return SWIFT_KW;
  if (lang === 'kotlin')  return KOTLIN_KW;
  if (lang === 'ruby')    return RUBY_KW;
  return JS_KW;
}

// ─── Color generation ─────────────────────────────────────────────────────────
// Produces N maximally-distinct colors via evenly-spaced HSL hues.
// No two entries are ever the same as long as N ≤ 360.

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha})`;
}

function makePalette(n: number): string[] {
  if (n === 0) return [];
  // Golden-angle distribution gives better perceptual spread than uniform spacing
  return Array.from({ length: n }, (_, i) =>
    hslToHex(Math.round((i * 137.508) % 360), 95, 60)
  );
}

// ─── Decoration types ─────────────────────────────────────────────────────────

interface CD {
  bg: vscode.TextEditorDecorationType; // full body — subtle background wash
  fg: vscode.TextEditorDecorationType; // signature text + call sites — bold color
}

function makeCD(color: string): CD {
  return {
    bg: vscode.window.createTextEditorDecorationType({
      backgroundColor: hexToRgba(color, 0.10),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    }),
    fg: vscode.window.createTextEditorDecorationType({
      color,
      backgroundColor: hexToRgba(color, 0.25),
      fontWeight: 'bold',
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    }),
  };
}

// Per-document active decoration types (keyed by document URI string)
const docDecs = new Map<string, CD[]>();

// Per-document parsed data — drives both decorations and navigation commands
interface DocCache { funcs: FI[]; calls: Map<string, OR[]>; }
const docCache = new Map<string, DocCache>();

// ─── Brace / body matching ────────────────────────────────────────────────────

// Finds the position after the closing '}' that matches the '{' at openAt.
function braceEnd(text: string, openAt: number): number | null {
  let i = openAt + 1, depth = 1;
  while (i < text.length && depth > 0) {
    const c = text[i];
    // Line comment
    if (c === '/' && text[i+1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (c === '/' && text[i+1] === '*') {
      i += 2;
      while (i + 1 < text.length && !(text[i] === '*' && text[i+1] === '/')) i++;
      i += 2; continue;
    }
    // String literals
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; i++; }
      i++; continue;
    }
    // Template literals
    if (c === '`') {
      i++;
      while (i < text.length && text[i] !== '`') {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '$' && text[i+1] === '{') {
          i += 2; let d = 1;
          while (i < text.length && d > 0) {
            if (text[i] === '{') d++; else if (text[i] === '}') d--;
            i++;
          }
          continue;
        }
        i++;
      }
      i++; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  return depth === 0 ? i : null;
}

// Scans forward from `from` to find the next '{', stopping at ';'.
function nextBrace(text: string, from: number): number | null {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{') return i;
    if (text[i] === ';') return null;
  }
  return null;
}

// For Python: finds the end offset of the indented body after `colonAt`.
function pyBodyEnd(text: string, colonAt: number): number {
  // Determine indentation of the `def` line
  let ls = colonAt;
  while (ls > 0 && text[ls - 1] !== '\n') ls--;
  let defInd = 0;
  while (ls + defInd < text.length && (text[ls + defInd] === ' ' || text[ls + defInd] === '\t')) defInd++;

  let i = colonAt + 1, last = colonAt;
  while (i < text.length) {
    while (i < text.length && text[i] !== '\n') i++;  // advance to EOL
    if (i >= text.length) { last = text.length; break; }
    i++;  // consume \n
    const lStart = i;
    let ind = 0;
    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) { ind++; i++; }
    if (i >= text.length) { last = text.length; break; }
    if (text[i] === '\n') continue;  // blank line — keep going
    if (ind <= defInd) { last = lStart > 0 ? lStart - 1 : 0; break; }  // body ended
    while (i < text.length && text[i] !== '\n') { last = i + 1; i++; }  // include line
  }
  return last;
}

// For Ruby: finds position after the `end` that closes the `def` starting at `from`.
// Counts def/class/module/begin/case/if/unless/while/until/for/do as openers.
// Skips strings and line comments.
function rubyBodyEnd(text: string, from: number): number {
  let i = from, depth = 1;
  while (i < text.length && depth > 0) {
    // Line comment
    if (text[i] === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    // Single-quoted string
    if (text[i] === "'") {
      i++;
      while (i < text.length && text[i] !== "'") { if (text[i] === '\\') i++; i++; }
      i++; continue;
    }
    // Double-quoted string (skip interpolation for simplicity)
    if (text[i] === '"') {
      i++;
      while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; i++; }
      i++; continue;
    }
    // Word boundary — check for keywords
    if (/[a-zA-Z_]/.test(text[i])) {
      let j = i;
      while (j < text.length && /\w/.test(text[j])) j++;
      const prev = i > 0 ? text[i - 1] : ' ';
      const word = text.slice(i, j);
      // Only count as a keyword if not preceded by a word character (e.g. not inside `end_pos`)
      if (!/\w/.test(prev)) {
        if (word === 'end') {
          depth--;
          if (depth === 0) { i = j; break; }
          i = j; continue;
        }
        // Block openers that always need an `end`
        if (['def','class','module','begin','case'].includes(word)) { depth++; i = j; continue; }
        // Conditional/loop openers — only when at line start (not postfix modifiers)
        if (['if','unless','while','until','for'].includes(word)) {
          let ls = i - 1;
          while (ls >= 0 && text[ls] !== '\n') {
            if (text[ls] !== ' ' && text[ls] !== '\t') { ls = -1; break; }
            ls--;
          }
          if (ls >= 0 || i === 0) { depth++; }
          i = j; continue;
        }
        // `do` used as a block opener (e.g. `each do |x|`)
        if (word === 'do') { depth++; i = j; continue; }
      }
      i = j; continue;
    }
    i++;
  }
  return i;
}

// ─── Function info ────────────────────────────────────────────────────────────

interface OR { s: number; e: number; }

interface FI {
  name: string;
  sig: OR[];    // disjoint signature ranges (bright fg decoration)
  bS: number;   // body block start (bg decoration)
  bE: number;   // body block end
}

// ─── Shared brace-based extractor helper ─────────────────────────────────────

function braceExtract(text: string, re: RegExp, nameGroup: number, wsGroup: number, kw: Set<string>): FI[] {
  const out: FI[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[nameGroup];
    if (!name || kw.has(name)) continue;
    const sigS = m.index + (wsGroup >= 0 ? m[wsGroup].length : 0);
    const sigE = m.index + m[0].length;
    const ob = nextBrace(text, sigE);
    const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
    out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
  }
  return out;
}

// ─── Language-specific extraction ─────────────────────────────────────────────

function extractFuncs(text: string, lang: string): FI[] {
  const kw = kwFor(lang);
  const out: FI[] = [];
  let m: RegExpExecArray | null;

  // ── C# ───────────────────────────────────────────────────────────────────────
  if (lang === 'csharp') {
    // [modifiers] ReturnType Name<T>(params) [where T : ...] { ... }
    const re = /^(\s*)((?:(?:public|private|protected|internal|static|abstract|virtual|override|sealed|async|new|extern|partial|readonly|unsafe|explicit|implicit)\s+)*)(?:[\w<>\[\],?.* ]+\s+)(\w+)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+where\s+[^{]+)?(?=\s*[{;])/gm;
    return braceExtract(text, re, 3, 1, kw);
  }

  // ── Rust ─────────────────────────────────────────────────────────────────────
  if (lang === 'rust') {
    // [pub[(crate)]] [async] [unsafe] fn name<T>(params) [-> ReturnType] [where ...]
    const re = /\b((?:pub(?:\s*\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+)(\w+)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
    while ((m = re.exec(text)) !== null) {
      const name = m[2];
      if (kw.has(name)) continue;
      const sigS = m.index, sigE = m.index + m[0].length;
      const ob = nextBrace(text, sigE);
      const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── PHP ──────────────────────────────────────────────────────────────────────
  if (lang === 'php') {
    // [modifiers] function name(params) [: ReturnType] { ... }
    const re = /\b((?:(?:public|private|protected|static|abstract|final)\s+)*)function\s+(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s*:\s*[\w\\|?! ]+)?/g;
    while ((m = re.exec(text)) !== null) {
      const name = m[2];
      if (kw.has(name)) continue;
      const sigS = m.index, sigE = m.index + m[0].length;
      const ob = nextBrace(text, sigE);
      const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── Swift ────────────────────────────────────────────────────────────────────
  if (lang === 'swift') {
    // [modifiers] func name<T>(params) [async] [throws] [-> ReturnType] { ... }
    const re = /\b((?:(?:private|public|internal|fileprivate|open|static|class|override|mutating|nonmutating|final|required|convenience|dynamic|lazy|optional|nonisolated|isolated)\s+)*)func\s+(\w+)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
    while ((m = re.exec(text)) !== null) {
      const name = m[2];
      if (kw.has(name)) continue;
      const sigS = m.index, sigE = m.index + m[0].length;
      const ob = nextBrace(text, sigE);
      const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── Kotlin ───────────────────────────────────────────────────────────────────
  if (lang === 'kotlin') {
    // [modifiers] fun name<T>(params) [: ReturnType] { ... }  OR  = expression
    const re = /\b((?:(?:private|public|internal|protected|override|abstract|open|final|suspend|inline|infix|operator|external|tailrec|actual|expect)\s+)*)fun\s+(\w+)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
    while ((m = re.exec(text)) !== null) {
      const name = m[2];
      if (kw.has(name)) continue;
      const sigS = m.index, sigE = m.index + m[0].length;
      // Scan past optional `: ReturnType` to find `{` or `=`
      let k = sigE;
      while (k < text.length && text[k] !== '{' && text[k] !== '=' && text[k] !== '\n') k++;
      let bE: number;
      if (k < text.length && text[k] === '{') {
        bE = braceEnd(text, k) ?? sigE;
      } else if (k < text.length && text[k] === '=') {
        let end = k + 1;
        while (end < text.length && text[end] !== '\n') end++;
        bE = end;
      } else {
        bE = sigE;
      }
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── Ruby ─────────────────────────────────────────────────────────────────────
  if (lang === 'ruby') {
    // def [self.]name[(params)]  …  end
    const re = /\b(def\s+(?:self\.)?(\w+)(?:\s*\([^)]*\))?)/g;
    while ((m = re.exec(text)) !== null) {
      const name = m[2];
      if (kw.has(name)) continue;
      const sigS = m.index, sigE = m.index + m[0].length;
      const bE = rubyBodyEnd(text, sigE);
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── Python ──────────────────────────────────────────────────────────────────
  if (lang === 'python') {
    const re = /\b((?:async\s+)?def\s+(\w+)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)(?:\s*->[^:]+)?)\s*(:)/g;
    while ((m = re.exec(text)) !== null) {
      const name = m[2];
      if (kw.has(name)) continue;
      const sigS = m.index, sigE = m.index + m[1].length;
      const colonAt = m.index + m[0].length - 1;
      const bE = pyBodyEnd(text, colonAt);
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── Go ───────────────────────────────────────────────────────────────────────
  if (lang === 'go') {
    const re = /\bfunc\s+(?:\([^)]*\)\s+)?(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
    while ((m = re.exec(text)) !== null) {
      const name = m[1];
      if (kw.has(name)) continue;
      const sigS = m.index, sigE = m.index + m[0].length;
      const ob = nextBrace(text, sigE);
      const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── Java ─────────────────────────────────────────────────────────────────────
  if (lang === 'java') {
    const re = /^(\s*)((?:(?:public|private|protected|static|final|abstract|synchronized|native|default)\s+)*)(?:[\w<>\[\],? ]+\s+)(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+throws\s+[\w,\s]+)?(?=\s*\{)/gm;
    while ((m = re.exec(text)) !== null) {
      const name = m[3];
      if (kw.has(name)) continue;
      const sigS = m.index + m[1].length, sigE = m.index + m[0].length;
      const ob = nextBrace(text, sigE);
      const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── C / C++ ──────────────────────────────────────────────────────────────────
  if (lang === 'c' || lang === 'cpp') {
    const re = /^(\s*)((?:(?:static|extern|inline|virtual|explicit|constexpr|override|const)\s+)*)(?:[\w:*& ]+\s+)(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+const)?(?=\s*[{;])/gm;
    while ((m = re.exec(text)) !== null) {
      const name = m[3];
      if (kw.has(name)) continue;
      const sigS = m.index + m[1].length, sigE = m.index + m[0].length;
      const ob = nextBrace(text, sigE);
      const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
      out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
  }

  // ── JavaScript / TypeScript ───────────────────────────────────────────────────

  // Named functions: function [*] name<T>(params)
  const namedFn = /\b((?:async\s+)?function\s*\*?\s*)(\w[\w$]*)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
  while ((m = namedFn.exec(text)) !== null) {
    const name = m[2];
    if (kw.has(name)) continue;
    const sigS = m.index, sigE = m.index + m[0].length;
    const ob = nextBrace(text, sigE);
    const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
    out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
  }

  // Class / object methods
  const method = /^(\s*)((?:(?:async|static|get|set|public|private|protected|override|abstract|readonly)\s+)*)([a-zA-Z_$][\w$]*)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s*:\s*[\w<>\[\]|& ,.?!*]+)?(?=\s*[{;])/gm;
  while ((m = method.exec(text)) !== null) {
    const name = m[3];
    if (kw.has(name)) continue;
    const sigS = m.index + m[1].length, sigE = m.index + m[0].length;
    const ob = nextBrace(text, sigE);
    const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
    out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
  }

  // Arrow functions: const/let/var name = [async] <T>(params) =>
  const arrow = /\b(const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(async\s+)?(?:<[^>]*>)?\s*(?:\([^)]*(?:\([^)]*\)[^)]*)*\)|[\w$]+)\s*(=>)/g;
  while ((m = arrow.exec(text)) !== null) {
    const name = m[2];
    if (kw.has(name)) continue;
    const klen = m[1].length;
    const nameOff = m[0].indexOf(name, klen);
    const nameS = m.index + nameOff, nameE = nameS + name.length;
    const arrowOff = m[0].lastIndexOf('=>');
    const arrowS = m.index + arrowOff;
    const afterArrow = m.index + m[0].length;

    // Find body end
    let k = afterArrow;
    while (k < text.length && (text[k] === ' ' || text[k] === '\t')) k++;
    let bE: number;
    if (k < text.length && text[k] === '{') {
      bE = braceEnd(text, k) ?? afterArrow;
    } else {
      // Expression body — highlight to end of expression (next ; or \n)
      let end = k;
      while (end < text.length && text[end] !== '\n' && text[end] !== ';') end++;
      bE = end;
    }

    out.push({
      name,
      sig: [{ s: nameS, e: nameE }, { s: arrowS, e: arrowS + 2 }],
      bS: nameS,
      bE,
    });
  }

  return out;
}

// ─── Call site extraction ─────────────────────────────────────────────────────

function extractCalls(text: string, names: Set<string>): Map<string, OR[]> {
  const out = new Map<string, OR[]>();
  const re = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (!names.has(name)) continue;
    const arr = out.get(name) ?? [];
    arr.push({ s: m.index, e: m.index + name.length });
    out.set(name, arr);
  }
  return out;
}

// ─── Main apply logic ─────────────────────────────────────────────────────────

function applyTo(editor: vscode.TextEditor): void {
  const uri  = editor.document.uri.toString();
  const lang = editor.document.languageId;
  const doc  = editor.document;

  // Clear and bail for unsupported languages
  if (!SUPPORTED.has(lang)) {
    const old = docDecs.get(uri);
    if (old) { for (const c of old) { c.bg.dispose(); c.fg.dispose(); } docDecs.delete(uri); }
    return;
  }

  const text  = doc.getText();
  const funcs = extractFuncs(text, lang);

  // Collect unique names in order of first appearance (top → bottom)
  const seen  = new Set<string>();
  const order: string[] = [];
  for (const f of funcs) {
    if (!seen.has(f.name)) { order.push(f.name); seen.add(f.name); }
  }

  if (order.length === 0) {
    const old = docDecs.get(uri);
    if (old) { for (const c of old) { c.bg.dispose(); c.fg.dispose(); } docDecs.delete(uri); }
    return;
  }

  const palette  = makePalette(order.length);          // N distinct colors
  const nameIdx  = new Map(order.map((n, i) => [n, i]));
  const newDecs  = palette.map(makeCD);

  const bgBuckets: vscode.Range[][] = newDecs.map(() => []);
  const fgBuckets: vscode.Range[][] = newDecs.map(() => []);

  // Function bodies → bg; signature ranges → fg
  for (const f of funcs) {
    const ci = nameIdx.get(f.name)!;
    bgBuckets[ci].push(new vscode.Range(doc.positionAt(f.bS), doc.positionAt(f.bE)));
    for (const r of f.sig) {
      fgBuckets[ci].push(new vscode.Range(doc.positionAt(r.s), doc.positionAt(r.e)));
    }
  }

  // Call sites → fg
  const calls = extractCalls(text, new Set(order));
  for (const [name, ors] of calls) {
    const ci = nameIdx.get(name)!;
    for (const r of ors) {
      fgBuckets[ci].push(new vscode.Range(doc.positionAt(r.s), doc.positionAt(r.e)));
    }
  }

  // Apply new decorations first, then dispose old ones (prevents flicker)
  for (let i = 0; i < newDecs.length; i++) {
    editor.setDecorations(newDecs[i].bg, bgBuckets[i]);
    editor.setDecorations(newDecs[i].fg, fgBuckets[i]);
  }

  const old = docDecs.get(uri);
  if (old) { for (const c of old) { c.bg.dispose(); c.fg.dispose(); } }
  docDecs.set(uri, newDecs);

  // Update navigation cache
  docCache.set(uri, { funcs, calls });
}

// ─── Debounce ─────────────────────────────────────────────────────────────────

const debMap = new Map<string, ReturnType<typeof setTimeout>>();

function applyDebounced(editor: vscode.TextEditor, ms = 300): void {
  const key = editor.document.uri.toString();
  const t = debMap.get(key);
  if (t !== undefined) clearTimeout(t);
  debMap.set(key, setTimeout(() => { debMap.delete(key); applyTo(editor); }, ms));
}

function applyAll(): void {
  for (const e of vscode.window.visibleTextEditors) applyTo(e);
}

// ─── Navigation commands ──────────────────────────────────────────────────────

async function cmdGoToCallers(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const uri    = editor.document.uri.toString();
  const cache  = docCache.get(uri);
  if (!cache) {
    vscode.window.showInformationMessage('Tetris: no function data for this file yet.');
    return;
  }

  const offset = editor.document.offsetAt(editor.selection.active);

  // Find the innermost declaration whose body contains the cursor.
  // "Innermost" = largest bS that is still ≤ offset (handles nested functions).
  const func = cache.funcs
    .filter(f => offset >= f.bS && offset <= f.bE)
    .sort((a, b) => b.bS - a.bS)[0];

  if (!func) {
    vscode.window.showInformationMessage('Tetris: place cursor inside a function declaration.');
    return;
  }

  // Exclude call sites that sit within the function's own declaration body
  // (e.g. the recursive call or the name in the signature itself).
  const allCalls = cache.calls.get(func.name) ?? [];
  const externalCalls = allCalls.filter(or => !(or.s >= func.bS && or.e <= func.bE));

  if (externalCalls.length === 0) {
    vscode.window.showInformationMessage(`Tetris: no callers of '${func.name}' found in this file.`);
    return;
  }

  const locations = externalCalls.map(or =>
    new vscode.Location(
      editor.document.uri,
      new vscode.Range(editor.document.positionAt(or.s), editor.document.positionAt(or.e))
    )
  );

  await vscode.commands.executeCommand(
    'editor.action.goToLocations',
    editor.document.uri,
    editor.selection.active,
    locations,
    externalCalls.length === 1 ? 'goto' : 'peek',
    `No callers of '${func.name}' found`
  );
}

async function cmdGoToDeclaration(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const uri   = editor.document.uri.toString();
  const cache = docCache.get(uri);
  if (!cache) {
    vscode.window.showInformationMessage('Tetris: no function data for this file yet.');
    return;
  }

  const offset = editor.document.offsetAt(editor.selection.active);

  // Find which call site the cursor is on
  let funcName: string | undefined;
  outer:
  for (const [name, ors] of cache.calls) {
    for (const or of ors) {
      if (offset >= or.s && offset <= or.e) { funcName = name; break outer; }
    }
  }

  if (!funcName) {
    vscode.window.showInformationMessage('Tetris: place cursor on a function call.');
    return;
  }

  // Find declaration — if multiple (overloads), show all
  const decls = cache.funcs.filter(f => f.name === funcName);
  if (decls.length === 0) {
    vscode.window.showInformationMessage(`Tetris: declaration of '${funcName}' not found in this file.`);
    return;
  }

  const locations = decls.map(f =>
    new vscode.Location(
      editor.document.uri,
      new vscode.Range(editor.document.positionAt(f.bS), editor.document.positionAt(f.bE))
    )
  );

  await vscode.commands.executeCommand(
    'editor.action.goToLocations',
    editor.document.uri,
    editor.selection.active,
    locations,
    decls.length === 1 ? 'goto' : 'peek',
    `Declaration of '${funcName}' not found`
  );
}

// ─── Activation ───────────────────────────────────────────────────────────────

export function activate(ctx: vscode.ExtensionContext): void {
  applyAll();
  ctx.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(e => { if (e) applyTo(e); }),
    vscode.window.onDidChangeVisibleTextEditors(es => { for (const e of es) applyTo(e); }),
    vscode.workspace.onDidChangeTextDocument(ev => {
      const e = vscode.window.visibleTextEditors.find(x => x.document === ev.document);
      if (e) applyDebounced(e);
    }),
    vscode.commands.registerCommand('tetris.goToCallers',     cmdGoToCallers),
    vscode.commands.registerCommand('tetris.goToDeclaration', cmdGoToDeclaration),
  );
}

export function deactivate(): void {
  for (const decs of docDecs.values()) {
    for (const c of decs) { c.bg.dispose(); c.fg.dispose(); }
  }
  for (const t of debMap.values()) clearTimeout(t);
}
