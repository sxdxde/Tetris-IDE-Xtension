# Tetris

**Tetris** is a VS Code extension that assigns every user-defined function its own persistent, vivid color — so function declarations, bodies, and call sites pop out of the noise like colored Tetris blocks.

Each function gets a unique hue derived from the golden-angle color algorithm, so colors never clash and never shift when you rename or add other functions. Code *outside* function bodies is dimmed, keeping your eye focused on what matters.

---

## Features

### Per-function unique colors
Every function in your file gets its own stable color. The color is tied to the function's name and persisted in workspace state — so if you close and reopen the file, the same function always gets the same color. Colors are generated via HSL + golden-angle spacing (137.5°), giving maximal visual separation without any manual configuration.

### Signature + body + call site highlighting
- The full function **signature** (keyword, name, parameters) gets a bold foreground color + bright background tint.
- The function **body** gets a lighter background tint so the entire block reads as one visual unit.
- Every **call site** of that function anywhere in the file gets the same foreground color, so you can trace a function's usage at a glance.

### Dimming of non-function code
Everything *outside* function bodies is dimmed to 35% opacity. This keeps imports, top-level declarations, and boilerplate visually quiet while your function logic stays vivid.

### Navigate with right-click

Right-click anywhere in the editor to access two navigation commands under the **Tetris** group:

| Command | Description |
|---|---|
| **Go to Callers** | Place cursor inside a function declaration → jumps to (or peeks at) all call sites in the current file. If none are found locally, it searches the entire workspace across all supported files. |
| **Go to Declaration** | Place cursor on a function call → jumps to the function's declaration in the current file. |

---

## Supported languages

| Language | File extensions |
|---|---|
| JavaScript | `.js` |
| TypeScript | `.ts` |
| JSX | `.jsx` |
| TSX | `.tsx` |
| Python | `.py` |
| Java | `.java` |
| C | `.c`, `.h` |
| C++ | `.cpp`, `.hpp` |
| Go | `.go` |
| C# | `.cs` |
| Rust | `.rs` |
| PHP | `.php` |
| Swift | `.swift` |
| Kotlin | `.kt` |
| Ruby | `.rb` |

---

## What gets highlighted

| Construct | Example | Highlighted |
|---|---|---|
| Named function | `function myFunc(a, b) {` | `function myFunc(a, b)` |
| Async / generator | `async function* gen(x) {` | `async function* gen(x)` |
| Class / object method | `public async render(props) {` | `public async render(props)` |
| Arrow function | `const fn = (x) => x * 2` | `fn` and `=>` |
| Python def | `async def fetch(url, timeout=5):` | `async def fetch(url, timeout=5)` |
| Go func | `func (r *Router) Handle(path string)` | full signature |
| Rust fn | `pub async fn process(data: &[u8])` | full signature |
| C# method | `public async Task<int> Compute(int n)` | full signature |
| Swift func | `func viewDidLoad() {` | full signature |
| Kotlin fun | `suspend fun fetchData(): Response` | full signature |
| Ruby def | `def calculate_total(items)` | full signature |
| PHP function | `public function handle(Request $req)` | full signature |
| Function call | `myFunc(42)` | `myFunc` |

Only **user-defined** functions are highlighted. Language built-ins (`console.log`, `setTimeout`, `print`, `len`, `make`, etc.) are filtered out via per-language keyword blocklists.

---

## Installation

### From `.vsix` (local install)

```bash
code --install-extension tetris-0.1.0.vsix
```

Or in VS Code: open the Extensions panel → `···` menu → **Install from VSIX…** → select the file.

### From source

```bash
git clone <repo>
cd Tetris
npm install
npm run compile
```

Press `F5` in VS Code to launch the extension in a development host window.

---

## How it works

1. **Regex-based parsing** — Each supported language has a hand-tuned regular expression that matches function signatures (including modifiers, generics, and parameter lists). No LSP or AST dependency means zero startup latency.
2. **Body detection** — For brace-delimited languages (JS, Go, Java, C, Rust, etc.), the extension walks forward from the signature to find the matching closing brace. Python uses indentation tracking; Ruby uses `def`/`end` depth counting.
3. **Golden-angle colors** — Each unique function name is assigned a slot index (persisted in `workspaceState`). Slot → color uses `hslToHex(slot * 137.508 % 360, 95%, 60%)`, guaranteeing perceptually distinct hues.
4. **Decoration API** — VS Code's `TextEditorDecorationType` applies foreground + background colors to computed ranges. Decorations are recreated on every edit (debounced at 300 ms) and disposed cleanly on file close or language change.
5. **Navigation** — Parsed function declarations and call sites are cached per document URI, enabling instant right-click navigation without re-parsing on command invocation.

---

## Future work

- **Publish to the VS Code Extension Marketplace** — The next milestone is submitting Tetris to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/vscode) so it can be installed directly from the Extensions panel with a single click. This involves setting up a verified publisher account, writing marketplace metadata, and wiring up a CI pipeline to automate `.vsix` builds and releases.
- Language Server Protocol (LSP) integration as an optional fast-path for declaration/caller lookup, improving accuracy for deeply overloaded or dynamically named functions.
- Additional language support: Dart, Lua, Haskell, Elixir, Scala.
- Commands to jump to the next or previous function declaration in the file.
- A panel/tree view listing all functions in the current file with their call counts.
- Theme integration: expose the background tint opacity and saturation as user settings.

---

## Changelog

### 0.1.0 — Initial release
- Per-function unique color assignment using golden-angle HSL generation
- Highlights function declarations (full signature + body tint) and call sites
- Dims code outside function bodies to 35% opacity
- Supports JS, TS, JSX, TSX, Python, Java, C, C++, Go, C#, Rust, PHP, Swift, Kotlin, Ruby
- Arrow functions: variable name + `=>` both highlighted
- Right-click **Go to Callers** (current file + workspace fallback)
- Right-click **Go to Declaration** (current file)
- Persistent colors per function name via workspace state
- 300 ms debounce on text changes for smooth live updates
