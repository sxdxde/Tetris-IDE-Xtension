# Tetris

Highlights every **function declaration** and **function call** in your file in one vivid color — so function-related identifiers pop out of the noise like colored Tetris blocks.

Everything else keeps its normal theme colors untouched.

---

## Screenshot

> _(Add a screenshot here after installing the extension)_

---

## What gets highlighted

| Construct | Example | Highlighted portion |
|---|---|---|
| Named function declaration | `function myFunc(a, b) {` | `function myFunc(a, b)` |
| Async / generator function | `async function* gen(x) {` | `async function* gen(x)` |
| Class / object method | `public async render(props) {` | `public async render(props)` |
| Arrow function (variable name) | `const fn = (x) => x * 2` | `fn` and `=>` |
| Python `def` | `async def fetch(url, timeout=5):` | `async def fetch(url, timeout=5)` |
| Go `func` | `func (r *Router) Handle(path string)` | `func (r *Router) Handle(path string)` |
| Function call | `myFunc(42)` | `myFunc` |

Only **user-defined** functions are highlighted. Built-ins like `console.log`, `setTimeout`, and `print` are skipped.

Highlights appear inside strings and comments too — if the text looks like a function name you declared, it gets colored.

---

## Supported languages

JavaScript · TypeScript · JSX · TSX · Python · Java · C · C++ · Go

---

## Changing the color

Open **Settings** (`⌘,` / `Ctrl+,`) and search for **Tetris**.

| Setting | Default | Description |
|---|---|---|
| `tetris.highlightColor` | `#00FFCC` | Any 6-digit hex color |

Or add it directly to `settings.json`:

```json
"tetris.highlightColor": "#FF6EC7"
```

The color updates live — no reload required.

---

## How it works

Tetris uses VSCode's **TextEditor Decoration API** with per-language regex patterns to locate function declarations and calls, then applies a foreground color + subtle background tint. The decoration type is recreated whenever you change the color setting, so live updates are instant.
