"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
// ─── Supported languages ──────────────────────────────────────────────────────
const SUPPORTED = new Set([
    'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
    'python', 'java', 'c', 'cpp', 'go',
    'csharp', 'rust', 'php', 'swift', 'kotlin', 'ruby',
]);
const LANG_GLOB = '**/*.{js,ts,jsx,tsx,py,java,c,cpp,h,hpp,go,cs,rs,php,swift,kt,rb}';
// ─── Keyword blocklists ───────────────────────────────────────────────────────
const JS_KW = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally', 'return', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'class', 'extends', 'import', 'export', 'from', 'default', 'async', 'await', 'yield', 'function', 'var', 'let', 'const', 'this', 'super', 'null', 'undefined', 'true', 'false', 'void', 'throw', 'case', 'break', 'continue', 'debugger', 'static', 'public', 'private', 'protected', 'get', 'set', 'abstract', 'override', 'readonly', 'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'as', 'is', 'satisfies']);
const PY_KW = new Set(['if', 'elif', 'else', 'for', 'while', 'with', 'try', 'except', 'finally', 'return', 'yield', 'raise', 'pass', 'break', 'continue', 'import', 'from', 'as', 'class', 'lambda', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'global', 'nonlocal', 'del', 'assert', 'print']);
const GO_KW = new Set(['if', 'else', 'for', 'switch', 'select', 'return', 'go', 'defer', 'fallthrough', 'break', 'continue', 'goto', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'range', 'import', 'package', 'func', 'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'close', 'panic', 'recover', 'print', 'println']);
const C_KW = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'return', 'break', 'continue', 'goto', 'sizeof', 'struct', 'union', 'enum', 'typedef', 'extern', 'static', 'void', 'int', 'float', 'double', 'char', 'long', 'short', 'unsigned', 'signed', 'const', 'volatile', 'register', 'auto', 'inline', 'restrict', 'true', 'false', 'NULL', 'null']);
const JAVA_KW = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'return', 'break', 'continue', 'new', 'class', 'interface', 'extends', 'implements', 'super', 'this', 'null', 'true', 'false', 'void', 'int', 'float', 'double', 'char', 'boolean', 'long', 'short', 'byte', 'final', 'static', 'abstract', 'synchronized', 'native', 'transient', 'volatile', 'public', 'private', 'protected', 'throw', 'throws', 'try', 'catch', 'finally', 'import', 'package', 'instanceof', 'enum', 'assert', 'default', 'goto', 'strictfp']);
const CSHARP_KW = new Set(['if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'return', 'break', 'continue', 'new', 'class', 'interface', 'struct', 'enum', 'namespace', 'using', 'public', 'private', 'protected', 'internal', 'static', 'abstract', 'virtual', 'override', 'sealed', 'readonly', 'const', 'void', 'int', 'long', 'short', 'byte', 'float', 'double', 'decimal', 'char', 'bool', 'string', 'object', 'var', 'null', 'true', 'false', 'this', 'base', 'throw', 'try', 'catch', 'finally', 'delegate', 'event', 'out', 'ref', 'in', 'params', 'async', 'await', 'yield', 'is', 'as', 'typeof', 'sizeof', 'checked', 'unchecked', 'lock', 'goto', 'default', 'case', 'where', 'record', 'init', 'with', 'required', 'file', 'scoped']);
const RUST_KW = new Set(['if', 'else', 'for', 'while', 'loop', 'match', 'return', 'break', 'continue', 'fn', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'crate', 'super', 'self', 'Self', 'move', 'async', 'await', 'where', 'type', 'static', 'extern', 'unsafe', 'in', 'ref', 'true', 'false', 'None', 'Some', 'Ok', 'Err', 'dyn', 'box', 'as', 'macro_rules']);
const PHP_KW = new Set(['if', 'else', 'elseif', 'while', 'for', 'foreach', 'do', 'switch', 'return', 'break', 'continue', 'function', 'class', 'interface', 'extends', 'implements', 'new', 'echo', 'print', 'include', 'require', 'use', 'namespace', 'public', 'private', 'protected', 'static', 'abstract', 'final', 'null', 'true', 'false', 'NULL', 'TRUE', 'FALSE', '$this', 'self', 'parent', 'yield', 'throw', 'try', 'catch', 'finally', 'match', 'fn', 'readonly', 'enum']);
const SWIFT_KW = new Set(['if', 'else', 'guard', 'for', 'while', 'repeat', 'switch', 'return', 'break', 'continue', 'fallthrough', 'defer', 'throw', 'func', 'var', 'let', 'class', 'struct', 'enum', 'protocol', 'extension', 'import', 'public', 'private', 'internal', 'fileprivate', 'open', 'static', 'final', 'override', 'init', 'deinit', 'super', 'self', 'true', 'false', 'nil', 'in', 'is', 'as', 'try', 'catch', 'throws', 'rethrows', 'async', 'await', 'some', 'any', 'where', 'case', 'default', 'typealias', 'associatedtype', 'willSet', 'didSet', 'get', 'set', 'actor', 'isolated', 'nonisolated', 'consuming', 'borrowing']);
const KOTLIN_KW = new Set(['if', 'else', 'for', 'while', 'do', 'when', 'return', 'break', 'continue', 'fun', 'val', 'var', 'class', 'interface', 'object', 'companion', 'init', 'constructor', 'super', 'this', 'null', 'true', 'false', 'in', 'is', 'as', 'try', 'catch', 'throw', 'finally', 'import', 'package', 'public', 'private', 'protected', 'internal', 'abstract', 'open', 'final', 'override', 'data', 'sealed', 'enum', 'annotation', 'by', 'where', 'out', 'crossinline', 'noinline', 'reified', 'suspend', 'inline', 'typealias', 'it', 'lateinit', 'const', 'object', 'tailrec', 'operator', 'infix', 'external', 'actual', 'expect']);
const RUBY_KW = new Set(['if', 'elsif', 'else', 'unless', 'while', 'until', 'for', 'do', 'case', 'when', 'then', 'begin', 'rescue', 'ensure', 'retry', 'return', 'yield', 'raise', 'fail', 'next', 'break', 'def', 'end', 'class', 'module', 'in', 'and', 'or', 'not', 'true', 'false', 'nil', 'self', 'super', '__FILE__', '__LINE__', '__method__', 'lambda', 'proc', 'puts', 'print', 'p', 'require', 'require_relative', 'include', 'extend', 'attr_accessor', 'attr_reader', 'attr_writer']);
function kwFor(lang) {
    if (lang === 'python')
        return PY_KW;
    if (lang === 'go')
        return GO_KW;
    if (lang === 'c' || lang === 'cpp')
        return C_KW;
    if (lang === 'java')
        return JAVA_KW;
    if (lang === 'csharp')
        return CSHARP_KW;
    if (lang === 'rust')
        return RUST_KW;
    if (lang === 'php')
        return PHP_KW;
    if (lang === 'swift')
        return SWIFT_KW;
    if (lang === 'kotlin')
        return KOTLIN_KW;
    if (lang === 'ruby')
        return RUBY_KW;
    return JS_KW;
}
// ─── Color generation ─────────────────────────────────────────────────────────
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
            .toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}
function slotToColor(slot) {
    return hslToHex(Math.round((slot * 137.508) % 360), 95, 60);
}
function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
}
let extCtx;
function colorKey(uri) { return `tetris.cm.${uri}`; }
function resolveColors(uri, names) {
    const stored = extCtx.workspaceState.get(colorKey(uri), { map: {}, next: 0 });
    let changed = false;
    for (const name of names) {
        if (!(name in stored.map)) {
            stored.map[name] = stored.next++;
            changed = true;
        }
    }
    if (changed)
        extCtx.workspaceState.update(colorKey(uri), stored);
    return names.map(n => slotToColor(stored.map[n]));
}
function makeCD(color) {
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
// Single shared dim decoration — applied to all non-function-body ranges
let dimDecType;
function makeDimDecType() {
    return vscode.window.createTextEditorDecorationType({
        opacity: '0.35',
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
}
const docDecs = new Map();
const docCache = new Map();
// ─── Brace / body matching ────────────────────────────────────────────────────
function braceEnd(text, openAt) {
    let i = openAt + 1, depth = 1;
    while (i < text.length && depth > 0) {
        const c = text[i];
        if (c === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n')
                i++;
            continue;
        }
        if (c === '/' && text[i + 1] === '*') {
            i += 2;
            while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/'))
                i++;
            i += 2;
            continue;
        }
        if (c === '"' || c === "'") {
            const q = c;
            i++;
            while (i < text.length && text[i] !== q) {
                if (text[i] === '\\')
                    i++;
                i++;
            }
            i++;
            continue;
        }
        if (c === '`') {
            i++;
            while (i < text.length && text[i] !== '`') {
                if (text[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (text[i] === '$' && text[i + 1] === '{') {
                    i += 2;
                    let d = 1;
                    while (i < text.length && d > 0) {
                        if (text[i] === '{')
                            d++;
                        else if (text[i] === '}')
                            d--;
                        i++;
                    }
                    continue;
                }
                i++;
            }
            i++;
            continue;
        }
        if (c === '{')
            depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) {
                i++;
                break;
            }
        }
        i++;
    }
    return depth === 0 ? i : null;
}
function nextBrace(text, from) {
    for (let i = from; i < text.length; i++) {
        if (text[i] === '{')
            return i;
        if (text[i] === ';')
            return null;
    }
    return null;
}
function pyBodyEnd(text, colonAt) {
    let ls = colonAt;
    while (ls > 0 && text[ls - 1] !== '\n')
        ls--;
    let defInd = 0;
    while (ls + defInd < text.length && (text[ls + defInd] === ' ' || text[ls + defInd] === '\t'))
        defInd++;
    let i = colonAt + 1, last = colonAt;
    while (i < text.length) {
        while (i < text.length && text[i] !== '\n')
            i++;
        if (i >= text.length) {
            last = text.length;
            break;
        }
        i++;
        const lStart = i;
        let ind = 0;
        while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
            ind++;
            i++;
        }
        if (i >= text.length) {
            last = text.length;
            break;
        }
        if (text[i] === '\n')
            continue;
        if (ind <= defInd) {
            last = lStart > 0 ? lStart - 1 : 0;
            break;
        }
        while (i < text.length && text[i] !== '\n') {
            last = i + 1;
            i++;
        }
    }
    return last;
}
function rubyBodyEnd(text, from) {
    let i = from, depth = 1;
    while (i < text.length && depth > 0) {
        if (text[i] === '#') {
            while (i < text.length && text[i] !== '\n')
                i++;
            continue;
        }
        if (text[i] === "'") {
            i++;
            while (i < text.length && text[i] !== "'") {
                if (text[i] === '\\')
                    i++;
                i++;
            }
            i++;
            continue;
        }
        if (text[i] === '"') {
            i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === '\\')
                    i++;
                i++;
            }
            i++;
            continue;
        }
        if (/[a-zA-Z_]/.test(text[i])) {
            let j = i;
            while (j < text.length && /\w/.test(text[j]))
                j++;
            const prev = i > 0 ? text[i - 1] : ' ';
            const word = text.slice(i, j);
            if (!/\w/.test(prev)) {
                if (word === 'end') {
                    depth--;
                    if (depth === 0) {
                        i = j;
                        break;
                    }
                    i = j;
                    continue;
                }
                if (['def', 'class', 'module', 'begin', 'case'].includes(word)) {
                    depth++;
                    i = j;
                    continue;
                }
                if (['if', 'unless', 'while', 'until', 'for'].includes(word)) {
                    let ls = i - 1;
                    while (ls >= 0 && text[ls] !== '\n') {
                        if (text[ls] !== ' ' && text[ls] !== '\t') {
                            ls = -1;
                            break;
                        }
                        ls--;
                    }
                    if (ls >= 0 || i === 0)
                        depth++;
                    i = j;
                    continue;
                }
                if (word === 'do') {
                    depth++;
                    i = j;
                    continue;
                }
            }
            i = j;
            continue;
        }
        i++;
    }
    return i;
}
// ─── Shared brace extractor ───────────────────────────────────────────────────
function braceExtract(text, re, nameGroup, wsGroup, kw) {
    const out = [];
    let m;
    while ((m = re.exec(text)) !== null) {
        const name = m[nameGroup];
        if (!name || kw.has(name))
            continue;
        const sigS = m.index + (wsGroup >= 0 ? m[wsGroup].length : 0);
        const sigE = m.index + m[0].length;
        const ob = nextBrace(text, sigE);
        const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
        out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    return out;
}
// ─── Language-specific extraction ─────────────────────────────────────────────
function extractFuncs(text, lang) {
    const kw = kwFor(lang);
    const out = [];
    let m;
    if (lang === 'csharp') {
        const re = /^(\s*)((?:(?:public|private|protected|internal|static|abstract|virtual|override|sealed|async|new|extern|partial|readonly|unsafe|explicit|implicit)\s+)*)(?:[\w<>\[\],?.* ]+\s+)(\w+)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+where\s+[^{]+)?(?=\s*[{;])/gm;
        return braceExtract(text, re, 3, 1, kw);
    }
    if (lang === 'rust') {
        const re = /\b((?:pub(?:\s*\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+)(\w+)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
        while ((m = re.exec(text)) !== null) {
            const name = m[2];
            if (kw.has(name))
                continue;
            const sigS = m.index, sigE = m.index + m[0].length;
            const ob = nextBrace(text, sigE);
            const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    if (lang === 'php') {
        const re = /\b((?:(?:public|private|protected|static|abstract|final)\s+)*)function\s+(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s*:\s*[\w\\|?! ]+)?/g;
        while ((m = re.exec(text)) !== null) {
            const name = m[2];
            if (kw.has(name))
                continue;
            const sigS = m.index, sigE = m.index + m[0].length;
            const ob = nextBrace(text, sigE);
            const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    if (lang === 'swift') {
        const re = /\b((?:(?:private|public|internal|fileprivate|open|static|class|override|mutating|nonmutating|final|required|convenience|dynamic|lazy|optional|nonisolated|isolated)\s+)*)func\s+(\w+)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
        while ((m = re.exec(text)) !== null) {
            const name = m[2];
            if (kw.has(name))
                continue;
            const sigS = m.index, sigE = m.index + m[0].length;
            const ob = nextBrace(text, sigE);
            const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    if (lang === 'kotlin') {
        const re = /\b((?:(?:private|public|internal|protected|override|abstract|open|final|suspend|inline|infix|operator|external|tailrec|actual|expect)\s+)*)fun\s+(\w+)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
        while ((m = re.exec(text)) !== null) {
            const name = m[2];
            if (kw.has(name))
                continue;
            const sigS = m.index, sigE = m.index + m[0].length;
            let k = sigE;
            while (k < text.length && text[k] !== '{' && text[k] !== '=' && text[k] !== '\n')
                k++;
            let bE;
            if (k < text.length && text[k] === '{') {
                bE = braceEnd(text, k) ?? sigE;
            }
            else if (k < text.length && text[k] === '=') {
                let end = k + 1;
                while (end < text.length && text[end] !== '\n')
                    end++;
                bE = end;
            }
            else {
                bE = sigE;
            }
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    if (lang === 'ruby') {
        const re = /\b(def\s+(?:self\.)?(\w+)(?:\s*\([^)]*\))?)/g;
        while ((m = re.exec(text)) !== null) {
            const name = m[2];
            if (kw.has(name))
                continue;
            const sigS = m.index, sigE = m.index + m[0].length;
            const bE = rubyBodyEnd(text, sigE);
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    if (lang === 'python') {
        const re = /\b((?:async\s+)?def\s+(\w+)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)(?:\s*->[^:]+)?)\s*(:)/g;
        while ((m = re.exec(text)) !== null) {
            const name = m[2];
            if (kw.has(name))
                continue;
            const sigS = m.index, sigE = m.index + m[1].length;
            const colonAt = m.index + m[0].length - 1;
            const bE = pyBodyEnd(text, colonAt);
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    if (lang === 'go') {
        const re = /\bfunc\s+(?:\([^)]*\)\s+)?(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
        while ((m = re.exec(text)) !== null) {
            const name = m[1];
            if (kw.has(name))
                continue;
            const sigS = m.index, sigE = m.index + m[0].length;
            const ob = nextBrace(text, sigE);
            const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    if (lang === 'java') {
        const re = /^(\s*)((?:(?:public|private|protected|static|final|abstract|synchronized|native|default)\s+)*)(?:[\w<>\[\],? ]+\s+)(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+throws\s+[\w,\s]+)?(?=\s*\{)/gm;
        while ((m = re.exec(text)) !== null) {
            const name = m[3];
            if (kw.has(name))
                continue;
            const sigS = m.index + m[1].length, sigE = m.index + m[0].length;
            const ob = nextBrace(text, sigE);
            const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    if (lang === 'c' || lang === 'cpp') {
        const re = /^(\s*)((?:(?:static|extern|inline|virtual|explicit|constexpr|override|const)\s+)*)(?:[\w:*& ]+\s+)(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+const)?(?=\s*[{;])/gm;
        while ((m = re.exec(text)) !== null) {
            const name = m[3];
            if (kw.has(name))
                continue;
            const sigS = m.index + m[1].length, sigE = m.index + m[0].length;
            const ob = nextBrace(text, sigE);
            const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
            out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
        }
        return out;
    }
    // JavaScript / TypeScript
    const namedFn = /\b((?:async\s+)?function\s*\*?\s*)(\w[\w$]*)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
    while ((m = namedFn.exec(text)) !== null) {
        const name = m[2];
        if (kw.has(name))
            continue;
        const sigS = m.index, sigE = m.index + m[0].length;
        const ob = nextBrace(text, sigE);
        const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
        out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    const method = /^(\s*)((?:(?:async|static|get|set|public|private|protected|override|abstract|readonly)\s+)*)([a-zA-Z_$][\w$]*)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s*:\s*[\w<>\[\]|& ,.?!*]+)?(?=\s*[{;])/gm;
    while ((m = method.exec(text)) !== null) {
        const name = m[3];
        if (kw.has(name))
            continue;
        const sigS = m.index + m[1].length, sigE = m.index + m[0].length;
        const ob = nextBrace(text, sigE);
        const bE = ob !== null ? (braceEnd(text, ob) ?? sigE) : sigE;
        out.push({ name, sig: [{ s: sigS, e: sigE }], bS: sigS, bE });
    }
    const arrow = /\b(const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(async\s+)?(?:<[^>]*>)?\s*(?:\([^)]*(?:\([^)]*\)[^)]*)*\)|[\w$]+)\s*(=>)/g;
    while ((m = arrow.exec(text)) !== null) {
        const name = m[2];
        if (kw.has(name))
            continue;
        const klen = m[1].length;
        const nameOff = m[0].indexOf(name, klen);
        const nameS = m.index + nameOff, nameE = nameS + name.length;
        const arrowOff = m[0].lastIndexOf('=>');
        const arrowS = m.index + arrowOff;
        const afterArrow = m.index + m[0].length;
        let k = afterArrow;
        while (k < text.length && (text[k] === ' ' || text[k] === '\t'))
            k++;
        let bE;
        if (k < text.length && text[k] === '{') {
            bE = braceEnd(text, k) ?? afterArrow;
        }
        else {
            let end = k;
            while (end < text.length && text[end] !== '\n' && text[end] !== ';')
                end++;
            bE = end;
        }
        out.push({ name, sig: [{ s: nameS, e: nameE }, { s: arrowS, e: arrowS + 2 }], bS: nameS, bE });
    }
    return out;
}
// ─── Call site extraction ─────────────────────────────────────────────────────
function extractCalls(text, names) {
    const out = new Map();
    const re = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const name = m[1];
        if (!names.has(name))
            continue;
        const arr = out.get(name) ?? [];
        arr.push({ s: m.index, e: m.index + name.length });
        out.set(name, arr);
    }
    return out;
}
// ─── Dim range computation ────────────────────────────────────────────────────
// Returns ranges covering everything OUTSIDE function bodies.
function computeDimRanges(doc, funcs) {
    if (funcs.length === 0)
        return [];
    const textLen = doc.getText().length;
    // Merge overlapping/adjacent body spans
    const sorted = [...funcs].sort((a, b) => a.bS - b.bS);
    const merged = [];
    for (const f of sorted) {
        if (merged.length === 0 || f.bS > merged[merged.length - 1].e) {
            merged.push({ s: f.bS, e: f.bE });
        }
        else {
            merged[merged.length - 1].e = Math.max(merged[merged.length - 1].e, f.bE);
        }
    }
    // Complement: gaps between merged spans
    const gaps = [];
    let cur = 0;
    for (const { s, e } of merged) {
        if (cur < s)
            gaps.push({ s: cur, e: s });
        cur = e;
    }
    if (cur < textLen)
        gaps.push({ s: cur, e: textLen });
    return gaps.map(g => new vscode.Range(doc.positionAt(g.s), doc.positionAt(g.e)));
}
// ─── Offset → Position (without opening a TextDocument) ───────────────────────
function offsetToPos(text, offset) {
    const before = text.slice(0, Math.min(offset, text.length));
    const lines = before.split('\n');
    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
}
// ─── Main apply logic ─────────────────────────────────────────────────────────
function applyTo(editor) {
    const uri = editor.document.uri.toString();
    const lang = editor.document.languageId;
    const doc = editor.document;
    if (!SUPPORTED.has(lang)) {
        const old = docDecs.get(uri);
        if (old) {
            for (const c of old) {
                c.bg.dispose();
                c.fg.dispose();
            }
            docDecs.delete(uri);
        }
        editor.setDecorations(dimDecType, []);
        return;
    }
    const text = doc.getText();
    const funcs = extractFuncs(text, lang);
    const seen = new Set();
    const order = [];
    for (const f of funcs) {
        if (!seen.has(f.name)) {
            order.push(f.name);
            seen.add(f.name);
        }
    }
    if (order.length === 0) {
        const old = docDecs.get(uri);
        if (old) {
            for (const c of old) {
                c.bg.dispose();
                c.fg.dispose();
            }
            docDecs.delete(uri);
        }
        editor.setDecorations(dimDecType, []);
        return;
    }
    // Resolve persistent colors — same name always gets the same color
    const colors = resolveColors(uri, order);
    const nameIdx = new Map(order.map((n, i) => [n, i]));
    const newDecs = colors.map(makeCD);
    const bgBuckets = newDecs.map(() => []);
    const fgBuckets = newDecs.map(() => []);
    for (const f of funcs) {
        const ci = nameIdx.get(f.name);
        bgBuckets[ci].push(new vscode.Range(doc.positionAt(f.bS), doc.positionAt(f.bE)));
        for (const r of f.sig) {
            fgBuckets[ci].push(new vscode.Range(doc.positionAt(r.s), doc.positionAt(r.e)));
        }
    }
    const calls = extractCalls(text, new Set(order));
    for (const [name, ors] of calls) {
        const ci = nameIdx.get(name);
        for (const r of ors) {
            fgBuckets[ci].push(new vscode.Range(doc.positionAt(r.s), doc.positionAt(r.e)));
        }
    }
    // Apply function decorations first, dispose old ones after (prevents flicker)
    for (let i = 0; i < newDecs.length; i++) {
        editor.setDecorations(newDecs[i].bg, bgBuckets[i]);
        editor.setDecorations(newDecs[i].fg, fgBuckets[i]);
    }
    const old = docDecs.get(uri);
    if (old) {
        for (const c of old) {
            c.bg.dispose();
            c.fg.dispose();
        }
    }
    docDecs.set(uri, newDecs);
    // Dim everything outside function bodies
    editor.setDecorations(dimDecType, computeDimRanges(doc, funcs));
    // Update navigation cache
    docCache.set(uri, { funcs, calls });
}
// ─── Debounce ─────────────────────────────────────────────────────────────────
const debMap = new Map();
function applyDebounced(editor, ms = 300) {
    const key = editor.document.uri.toString();
    const t = debMap.get(key);
    if (t !== undefined)
        clearTimeout(t);
    debMap.set(key, setTimeout(() => { debMap.delete(key); applyTo(editor); }, ms));
}
function applyAll() {
    for (const e of vscode.window.visibleTextEditors)
        applyTo(e);
}
// ─── Cross-file caller search ─────────────────────────────────────────────────
async function findCallersAcrossWorkspace(funcName, currentUri, token) {
    const locations = [];
    const files = await vscode.workspace.findFiles(LANG_GLOB, '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**,**/out/**}');
    for (const fileUri of files) {
        if (token.isCancellationRequested)
            break;
        if (fileUri.toString() === currentUri)
            continue;
        try {
            const bytes = await vscode.workspace.fs.readFile(fileUri);
            const text = new TextDecoder().decode(bytes);
            const calls = extractCalls(text, new Set([funcName]));
            const ors = calls.get(funcName) ?? [];
            for (const or of ors) {
                locations.push(new vscode.Location(fileUri, new vscode.Range(offsetToPos(text, or.s), offsetToPos(text, or.e))));
            }
        }
        catch { /* skip unreadable files */ }
    }
    return locations;
}
// ─── Navigation commands ──────────────────────────────────────────────────────
async function cmdGoToCallers() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const uri = editor.document.uri.toString();
    const cache = docCache.get(uri);
    if (!cache) {
        vscode.window.showInformationMessage('Tetris: no function data for this file yet.');
        return;
    }
    const offset = editor.document.offsetAt(editor.selection.active);
    const func = cache.funcs
        .filter(f => offset >= f.bS && offset <= f.bE)
        .sort((a, b) => b.bS - a.bS)[0];
    if (!func) {
        vscode.window.showInformationMessage('Tetris: place cursor inside a function declaration.');
        return;
    }
    // Call sites outside the function's own body
    const allCalls = cache.calls.get(func.name) ?? [];
    const localCallers = allCalls.filter(or => !(or.s >= func.bS && or.e <= func.bE));
    const localLocations = localCallers.map(or => new vscode.Location(editor.document.uri, new vscode.Range(editor.document.positionAt(or.s), editor.document.positionAt(or.e))));
    if (localLocations.length > 0) {
        await vscode.commands.executeCommand('editor.action.goToLocations', editor.document.uri, editor.selection.active, localLocations, localLocations.length === 1 ? 'goto' : 'peek', `No callers of '${func.name}' found`);
        return;
    }
    // No local callers — search the whole workspace
    let workspaceLocations = [];
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Tetris: searching workspace for callers of '${func.name}'...`, cancellable: true }, async (_, token) => { workspaceLocations = await findCallersAcrossWorkspace(func.name, uri, token); });
    if (workspaceLocations.length === 0) {
        vscode.window.showInformationMessage(`Tetris: no callers of '${func.name}' found anywhere in the workspace.`);
        return;
    }
    await vscode.commands.executeCommand('editor.action.goToLocations', editor.document.uri, editor.selection.active, workspaceLocations, workspaceLocations.length === 1 ? 'goto' : 'peek', `No callers of '${func.name}' found`);
}
async function cmdGoToDeclaration() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const uri = editor.document.uri.toString();
    const cache = docCache.get(uri);
    if (!cache) {
        vscode.window.showInformationMessage('Tetris: no function data for this file yet.');
        return;
    }
    const offset = editor.document.offsetAt(editor.selection.active);
    let funcName;
    outer: for (const [name, ors] of cache.calls) {
        for (const or of ors) {
            if (offset >= or.s && offset <= or.e) {
                funcName = name;
                break outer;
            }
        }
    }
    if (!funcName) {
        vscode.window.showInformationMessage('Tetris: place cursor on a function call.');
        return;
    }
    const decls = cache.funcs.filter(f => f.name === funcName);
    if (decls.length === 0) {
        vscode.window.showInformationMessage(`Tetris: declaration of '${funcName}' not found in this file.`);
        return;
    }
    const locations = decls.map(f => new vscode.Location(editor.document.uri, new vscode.Range(editor.document.positionAt(f.bS), editor.document.positionAt(f.bE))));
    await vscode.commands.executeCommand('editor.action.goToLocations', editor.document.uri, editor.selection.active, locations, decls.length === 1 ? 'goto' : 'peek', `Declaration of '${funcName}' not found`);
}
// ─── Activation ───────────────────────────────────────────────────────────────
function activate(ctx) {
    extCtx = ctx;
    dimDecType = makeDimDecType();
    applyAll();
    ctx.subscriptions.push({ dispose: () => dimDecType.dispose() }, vscode.window.onDidChangeActiveTextEditor(e => { if (e)
        applyTo(e); }), vscode.window.onDidChangeVisibleTextEditors(es => { for (const e of es)
        applyTo(e); }), vscode.workspace.onDidChangeTextDocument(ev => {
        const e = vscode.window.visibleTextEditors.find(x => x.document === ev.document);
        if (e)
            applyDebounced(e);
    }), vscode.commands.registerCommand('tetris.goToCallers', cmdGoToCallers), vscode.commands.registerCommand('tetris.goToDeclaration', cmdGoToDeclaration));
}
function deactivate() {
    for (const decs of docDecs.values()) {
        for (const c of decs) {
            c.bg.dispose();
            c.fg.dispose();
        }
    }
    for (const t of debMap.values())
        clearTimeout(t);
}
//# sourceMappingURL=extension.js.map