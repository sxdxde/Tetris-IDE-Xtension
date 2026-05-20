"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
// ─── Supported languages ──────────────────────────────────────────────────────
const SUPPORTED = new Set([
    'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
    'python', 'java', 'c', 'cpp', 'go',
]);
// ─── Keyword blocklists ───────────────────────────────────────────────────────
const JS_KW = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally', 'return', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'class', 'extends', 'import', 'export', 'from', 'default', 'async', 'await', 'yield', 'function', 'var', 'let', 'const', 'this', 'super', 'null', 'undefined', 'true', 'false', 'void', 'throw', 'case', 'break', 'continue', 'debugger', 'static', 'public', 'private', 'protected', 'get', 'set', 'abstract', 'override', 'readonly', 'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'as', 'is', 'satisfies']);
const PY_KW = new Set(['if', 'elif', 'else', 'for', 'while', 'with', 'try', 'except', 'finally', 'return', 'yield', 'raise', 'pass', 'break', 'continue', 'import', 'from', 'as', 'class', 'lambda', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'global', 'nonlocal', 'del', 'assert', 'print']);
const GO_KW = new Set(['if', 'else', 'for', 'switch', 'select', 'return', 'go', 'defer', 'fallthrough', 'break', 'continue', 'goto', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'range', 'import', 'package', 'func', 'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'close', 'panic', 'recover', 'print', 'println']);
const C_KW = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'return', 'break', 'continue', 'goto', 'sizeof', 'struct', 'union', 'enum', 'typedef', 'extern', 'static', 'void', 'int', 'float', 'double', 'char', 'long', 'short', 'unsigned', 'signed', 'const', 'volatile', 'register', 'auto', 'inline', 'restrict', 'true', 'false', 'NULL', 'null']);
const JAVA_KW = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'return', 'break', 'continue', 'new', 'class', 'interface', 'extends', 'implements', 'super', 'this', 'null', 'true', 'false', 'void', 'int', 'float', 'double', 'char', 'boolean', 'long', 'short', 'byte', 'final', 'static', 'abstract', 'synchronized', 'native', 'transient', 'volatile', 'public', 'private', 'protected', 'throw', 'throws', 'try', 'catch', 'finally', 'import', 'package', 'instanceof', 'enum', 'assert', 'default', 'goto', 'strictfp']);
function kwFor(lang) {
    if (lang === 'python')
        return PY_KW;
    if (lang === 'go')
        return GO_KW;
    if (lang === 'c' || lang === 'cpp')
        return C_KW;
    if (lang === 'java')
        return JAVA_KW;
    return JS_KW;
}
// ─── Color generation ─────────────────────────────────────────────────────────
// Produces N maximally-distinct colors via evenly-spaced HSL hues.
// No two entries are ever the same as long as N ≤ 360.
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
function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
}
function makePalette(n) {
    if (n === 0)
        return [];
    // Golden-angle distribution gives better perceptual spread than uniform spacing
    return Array.from({ length: n }, (_, i) => hslToHex(Math.round((i * 137.508) % 360), 95, 60));
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
// Per-document active decoration types (keyed by document URI string)
const docDecs = new Map();
const docCache = new Map();
// ─── Brace / body matching ────────────────────────────────────────────────────
// Finds the position after the closing '}' that matches the '{' at openAt.
function braceEnd(text, openAt) {
    let i = openAt + 1, depth = 1;
    while (i < text.length && depth > 0) {
        const c = text[i];
        // Line comment
        if (c === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n')
                i++;
            continue;
        }
        // Block comment
        if (c === '/' && text[i + 1] === '*') {
            i += 2;
            while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/'))
                i++;
            i += 2;
            continue;
        }
        // String literals
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
        // Template literals
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
// Scans forward from `from` to find the next '{', stopping at ';'.
function nextBrace(text, from) {
    for (let i = from; i < text.length; i++) {
        if (text[i] === '{')
            return i;
        if (text[i] === ';')
            return null;
    }
    return null;
}
// For Python: finds the end offset of the indented body after `colonAt`.
function pyBodyEnd(text, colonAt) {
    // Determine indentation of the `def` line
    let ls = colonAt;
    while (ls > 0 && text[ls - 1] !== '\n')
        ls--;
    let defInd = 0;
    while (ls + defInd < text.length && (text[ls + defInd] === ' ' || text[ls + defInd] === '\t'))
        defInd++;
    let i = colonAt + 1, last = colonAt;
    while (i < text.length) {
        while (i < text.length && text[i] !== '\n')
            i++; // advance to EOL
        if (i >= text.length) {
            last = text.length;
            break;
        }
        i++; // consume \n
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
            continue; // blank line — keep going
        if (ind <= defInd) {
            last = lStart > 0 ? lStart - 1 : 0;
            break;
        } // body ended
        while (i < text.length && text[i] !== '\n') {
            last = i + 1;
            i++;
        } // include line
    }
    return last;
}
// ─── Language-specific extraction ─────────────────────────────────────────────
function extractFuncs(text, lang) {
    const kw = kwFor(lang);
    const out = [];
    let m;
    // ── Python ──────────────────────────────────────────────────────────────────
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
    // ── Go ───────────────────────────────────────────────────────────────────────
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
    // ── Java ─────────────────────────────────────────────────────────────────────
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
    // ── C / C++ ──────────────────────────────────────────────────────────────────
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
    // ── JavaScript / TypeScript ───────────────────────────────────────────────────
    // Named functions: function [*] name<T>(params)
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
    // Class / object methods
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
    // Arrow functions: const/let/var name = [async] <T>(params) =>
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
        // Find body end
        let k = afterArrow;
        while (k < text.length && (text[k] === ' ' || text[k] === '\t'))
            k++;
        let bE;
        if (k < text.length && text[k] === '{') {
            bE = braceEnd(text, k) ?? afterArrow;
        }
        else {
            // Expression body — highlight to end of expression (next ; or \n)
            let end = k;
            while (end < text.length && text[end] !== '\n' && text[end] !== ';')
                end++;
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
// ─── Main apply logic ─────────────────────────────────────────────────────────
function applyTo(editor) {
    const uri = editor.document.uri.toString();
    const lang = editor.document.languageId;
    const doc = editor.document;
    // Clear and bail for unsupported languages
    if (!SUPPORTED.has(lang)) {
        const old = docDecs.get(uri);
        if (old) {
            for (const c of old) {
                c.bg.dispose();
                c.fg.dispose();
            }
            docDecs.delete(uri);
        }
        return;
    }
    const text = doc.getText();
    const funcs = extractFuncs(text, lang);
    // Collect unique names in order of first appearance (top → bottom)
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
        return;
    }
    const palette = makePalette(order.length); // N distinct colors
    const nameIdx = new Map(order.map((n, i) => [n, i]));
    const newDecs = palette.map(makeCD);
    const bgBuckets = newDecs.map(() => []);
    const fgBuckets = newDecs.map(() => []);
    // Function bodies → bg; signature ranges → fg
    for (const f of funcs) {
        const ci = nameIdx.get(f.name);
        bgBuckets[ci].push(new vscode.Range(doc.positionAt(f.bS), doc.positionAt(f.bE)));
        for (const r of f.sig) {
            fgBuckets[ci].push(new vscode.Range(doc.positionAt(r.s), doc.positionAt(r.e)));
        }
    }
    // Call sites → fg
    const calls = extractCalls(text, new Set(order));
    for (const [name, ors] of calls) {
        const ci = nameIdx.get(name);
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
    if (old) {
        for (const c of old) {
            c.bg.dispose();
            c.fg.dispose();
        }
    }
    docDecs.set(uri, newDecs);
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
    const locations = externalCalls.map(or => new vscode.Location(editor.document.uri, new vscode.Range(editor.document.positionAt(or.s), editor.document.positionAt(or.e))));
    await vscode.commands.executeCommand('editor.action.goToLocations', editor.document.uri, editor.selection.active, locations, externalCalls.length === 1 ? 'goto' : 'peek', `No callers of '${func.name}' found`);
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
    // Find which call site the cursor is on
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
    // Find declaration — if multiple (overloads), show all
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
    applyAll();
    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => { if (e)
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