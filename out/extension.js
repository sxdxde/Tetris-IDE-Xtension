"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
// ---------------------------------------------------------------------------
// Language keyword sets — names matching these are never highlighted
// ---------------------------------------------------------------------------
const JS_KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally', 'return',
    'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'class', 'extends', 'import',
    'export', 'from', 'default', 'async', 'await', 'yield', 'function', 'var', 'let',
    'const', 'this', 'super', 'null', 'undefined', 'true', 'false', 'void', 'throw',
    'case', 'break', 'continue', 'debugger', 'static', 'public', 'private', 'protected',
    'get', 'set', 'abstract', 'override', 'readonly', 'interface', 'type', 'enum',
    'namespace', 'module', 'declare', 'as', 'is', 'satisfies',
]);
const PYTHON_KEYWORDS = new Set([
    'if', 'elif', 'else', 'for', 'while', 'with', 'try', 'except', 'finally', 'return',
    'yield', 'raise', 'pass', 'break', 'continue', 'import', 'from', 'as', 'class',
    'lambda', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'global',
    'nonlocal', 'del', 'assert', 'print',
]);
const GO_KEYWORDS = new Set([
    'if', 'else', 'for', 'switch', 'select', 'return', 'go', 'defer', 'fallthrough',
    'break', 'continue', 'goto', 'var', 'const', 'type', 'struct', 'interface', 'map',
    'chan', 'range', 'import', 'package', 'func', 'make', 'new', 'len', 'cap', 'append',
    'copy', 'delete', 'close', 'panic', 'recover', 'print', 'println',
]);
const C_KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'return', 'break', 'continue', 'goto',
    'sizeof', 'struct', 'union', 'enum', 'typedef', 'extern', 'static', 'void', 'int',
    'float', 'double', 'char', 'long', 'short', 'unsigned', 'signed', 'const', 'volatile',
    'register', 'auto', 'inline', 'restrict', 'true', 'false', 'NULL', 'null',
]);
const JAVA_KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'return', 'break', 'continue', 'new',
    'class', 'interface', 'extends', 'implements', 'super', 'this', 'null', 'true',
    'false', 'void', 'int', 'float', 'double', 'char', 'boolean', 'long', 'short', 'byte',
    'final', 'static', 'abstract', 'synchronized', 'native', 'transient', 'volatile',
    'strictfp', 'public', 'private', 'protected', 'throw', 'throws', 'try', 'catch',
    'finally', 'import', 'package', 'instanceof', 'enum', 'assert', 'default', 'goto',
]);
function getKeywords(lang) {
    if (lang === 'python')
        return PYTHON_KEYWORDS;
    if (lang === 'go')
        return GO_KEYWORDS;
    if (lang === 'c' || lang === 'cpp')
        return C_KEYWORDS;
    if (lang === 'java')
        return JAVA_KEYWORDS;
    return JS_KEYWORDS;
}
const SUPPORTED_LANGUAGES = new Set([
    'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
    'python', 'java', 'c', 'cpp', 'go',
]);
// ---------------------------------------------------------------------------
// Decoration state
// ---------------------------------------------------------------------------
let activeDecorationType;
const debounceMap = new Map();
function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
function getConfigColor() {
    return vscode.workspace.getConfiguration('tetris').get('highlightColor', '#00FFCC');
}
function makeDecorationType(color) {
    return vscode.window.createTextEditorDecorationType({
        color,
        backgroundColor: hexToRgba(color, 0.12),
        fontWeight: '600',
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
}
function push(out, start, end) {
    if (start < end)
        out.push({ start, end });
}
// ---------------------------------------------------------------------------
// Declaration + arrow extraction per language
// Returns: the offset ranges to highlight AND the set of declared names
// ---------------------------------------------------------------------------
function extractJsTs(text, keywords) {
    const ranges = [];
    const names = new Set();
    let m;
    // Named functions (including async, generator)
    // Handles optional generics <T> before params
    const namedFn = /\b((?:async\s+)?function\s*\*?\s*)(\w[\w$]*)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))/g;
    while ((m = namedFn.exec(text)) !== null) {
        const name = m[2];
        if (keywords.has(name))
            continue;
        names.add(name);
        push(ranges, m.index, m.index + m[0].length);
    }
    // Class / object methods: [modifiers] name<generics>(params) [: ReturnType] {
    // Leading whitespace is captured in group 1 so we can skip it.
    const methodPat = /^(\s*)((?:(?:async|static|get|set|public|private|protected|override|abstract|readonly)\s+)*)([a-zA-Z_$][\w$]*)\s*(?:<[^>]*>)?\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s*:\s*(?:[\w<>\[\]|& ,.?!*]+))?(?=\s*[{;])/gm;
    while ((m = methodPat.exec(text)) !== null) {
        const name = m[3];
        if (keywords.has(name))
            continue;
        names.add(name);
        const leadingWS = m[1].length;
        push(ranges, m.index + leadingWS, m.index + m[0].length);
    }
    // Arrow functions: const/let/var name = [async] (params) =>
    const arrowPat = /\b(const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(async\s+)?(?:\([^)]*(?:\([^)]*\)[^)]*)*\)|[\w$]+)\s*(=>)/g;
    while ((m = arrowPat.exec(text)) !== null) {
        const name = m[2];
        if (keywords.has(name))
            continue;
        names.add(name);
        // Highlight just the variable name
        const kw = m[1]; // "const" | "let" | "var"
        const nameOffset = m[0].indexOf(name, kw.length);
        push(ranges, m.index + nameOffset, m.index + nameOffset + name.length);
        // Highlight the arrow token =>
        const arrowOffset = m[0].lastIndexOf('=>');
        push(ranges, m.index + arrowOffset, m.index + arrowOffset + 2);
    }
    return { ranges, names };
}
function extractPython(text, keywords) {
    const ranges = [];
    const names = new Set();
    let m;
    // def / async def — highlight from keyword through closing paren of params
    const defPat = /\b((?:async\s+)?def\s+(\w+)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)(?:\s*->[^:]+)?)\s*:/g;
    while ((m = defPat.exec(text)) !== null) {
        const name = m[2];
        if (keywords.has(name))
            continue;
        names.add(name);
        // m[1] is the full signature without the colon
        push(ranges, m.index, m.index + m[1].length);
    }
    return { ranges, names };
}
function extractGo(text, keywords) {
    const ranges = [];
    const names = new Set();
    let m;
    // func [receiver] name(params)
    const funcPat = /\bfunc\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)/g;
    while ((m = funcPat.exec(text)) !== null) {
        const name = m[1];
        if (keywords.has(name))
            continue;
        names.add(name);
        push(ranges, m.index, m.index + m[0].length);
    }
    return { ranges, names };
}
function extractJava(text, keywords) {
    const ranges = [];
    const names = new Set();
    let m;
    // [modifiers] ReturnType name(params) [throws ...] {
    // ReturnType matched loosely as "word tokens + spaces/generics/arrays before the name"
    const methodPat = /^(\s*)((?:(?:public|private|protected|static|final|abstract|synchronized|native|default)\s+)*)(?:[\w<>\[\],? ]+\s+)(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+throws\s+[\w,\s]+)?(?=\s*\{)/gm;
    while ((m = methodPat.exec(text)) !== null) {
        const name = m[3];
        if (keywords.has(name))
            continue;
        names.add(name);
        const ws = m[1].length;
        push(ranges, m.index + ws, m.index + m[0].length);
    }
    return { ranges, names };
}
function extractC(text, keywords) {
    const ranges = [];
    const names = new Set();
    let m;
    // [modifiers] ReturnType[*] name(params) [const] { or ;
    const funcPat = /^(\s*)((?:(?:static|extern|inline|virtual|explicit|constexpr|override|const)\s+)*)(?:[\w:*& ]+\s+)(\w+)\s*(\([^)]*(?:\([^)]*\)[^)]*)*\))(?:\s+const)?(?=\s*[{;])/gm;
    while ((m = funcPat.exec(text)) !== null) {
        const name = m[3];
        if (keywords.has(name))
            continue;
        names.add(name);
        const ws = m[1].length;
        push(ranges, m.index + ws, m.index + m[0].length);
    }
    return { ranges, names };
}
function extractDeclarations(text, lang) {
    const kw = getKeywords(lang);
    if (lang === 'python')
        return extractPython(text, kw);
    if (lang === 'go')
        return extractGo(text, kw);
    if (lang === 'java')
        return extractJava(text, kw);
    if (lang === 'c' || lang === 'cpp')
        return extractC(text, kw);
    return extractJsTs(text, kw);
}
// ---------------------------------------------------------------------------
// Call-site detection
// ---------------------------------------------------------------------------
function extractCalls(text, declaredNames) {
    const ranges = [];
    const callPat = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
    let m;
    while ((m = callPat.exec(text)) !== null) {
        const name = m[1];
        if (declaredNames.has(name)) {
            push(ranges, m.index, m.index + name.length);
        }
    }
    return ranges;
}
// ---------------------------------------------------------------------------
// Main highlight computation
// ---------------------------------------------------------------------------
function computeRanges(document) {
    if (!SUPPORTED_LANGUAGES.has(document.languageId))
        return [];
    const text = document.getText();
    const { ranges: declRanges, names } = extractDeclarations(text, document.languageId);
    const callRanges = extractCalls(text, names);
    return [...declRanges, ...callRanges].map(({ start, end }) => new vscode.Range(document.positionAt(start), document.positionAt(end)));
}
function applyDecorations(editor) {
    if (!activeDecorationType)
        return;
    editor.setDecorations(activeDecorationType, computeRanges(editor.document));
}
function applyDebounced(editor, delayMs = 250) {
    const key = editor.document.uri.toString();
    const existing = debounceMap.get(key);
    if (existing !== undefined)
        clearTimeout(existing);
    debounceMap.set(key, setTimeout(() => {
        debounceMap.delete(key);
        applyDecorations(editor);
    }, delayMs));
}
function applyToAllVisible() {
    for (const editor of vscode.window.visibleTextEditors) {
        applyDecorations(editor);
    }
}
// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------
function activate(context) {
    let currentColor = getConfigColor();
    activeDecorationType = makeDecorationType(currentColor);
    applyToAllVisible();
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor)
            applyDecorations(editor);
    }), vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors)
            applyDecorations(editor);
    }), vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
        if (editor)
            applyDebounced(editor);
    }), vscode.workspace.onDidChangeConfiguration(event => {
        if (!event.affectsConfiguration('tetris.highlightColor'))
            return;
        const newColor = getConfigColor();
        if (newColor === currentColor)
            return;
        currentColor = newColor;
        activeDecorationType?.dispose();
        activeDecorationType = makeDecorationType(currentColor);
        applyToAllVisible();
    }));
}
function deactivate() {
    activeDecorationType?.dispose();
    for (const t of debounceMap.values())
        clearTimeout(t);
    debounceMap.clear();
}
//# sourceMappingURL=extension.js.map