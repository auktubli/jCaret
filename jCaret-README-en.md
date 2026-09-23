# jCaret

A lightweight, fully-featured, dependency-free rich text editor for the browser. jCaret lays documents out on real A4 pages — with per-page margins, automatic pagination, page numbers, and a printable PDF that matches the screen exactly — and supports both left-to-right and right-to-left languages out of the box.

Made with love by **[auktubli.com](https://www.auktubli.com)**.

---

## Highlights

- **A4 page layout** — text automatically flows across pages exactly as it will print, with live on-screen page guides.
- **Per-page margins** — every page can have its own top/bottom/left/right margins, adjustable from a floating panel.
- **Print as PDF** — a dedicated print flow that mirrors the on-screen page layout precisely, with clickable links preserved.
- **Download any page as PNG** — export a single page as a crisp, print-quality image without any external library.
- **Watermark** — one diagonal, semi-transparent watermark applied across every page (present and future), saved between sessions.
- **Handwriting / drawing** — draw directly on the page with a pen and highlighter, erase strokes, and re-open any drawing later to keep editing it — it is never flattened into a plain image.
- **Draggable, resizable, rotatable images** — images and drawings float freely on the page: drag them anywhere, resize them, or rotate them, and they intelligently stay within the printable area.
- **Rich text formatting** — bold, italic, underline, strikethrough, super/subscript, headings via font size, font family, font color, highlight colors, blockquotes, ordered/unordered lists, alignment, and "remove formatting."
- **Code blocks** — turn any selection into a syntax-highlighted code block or inline code snippet, with automatic language detection (JavaScript, Python, HTML, SQL, Shell, CSS, PHP, Go and more).
- **Tables** — insert tables up to 10 columns, add/remove rows and columns, and tables automatically shrink to fit inside the page margins.
- **Images & links** — upload and compress images automatically, insert hyperlinks, and auto-linkify plain-text URLs and email addresses when printing.
- **Emoji picker**, **captions** for images and tables, and a built-in **keyboard-shortcuts reference**.
- **Full undo/redo** history and optional **localStorage** persistence (including margins, the watermark, and hand-drawn strokes — everything survives a page reload).
- **Bilingual, out of the box** — English and Arabic interfaces with correct RTL/LTR text direction, mirrored UI, and Arabic-appropriate font choices.

---

## Getting started

Include the script and create a container element:

```html
<div id="editor-container"></div>
<script src="jcaret.js"></script>
<script>
  const editor = new jCaret('#editor-container', {
    width: '880px',
    height: '400px',
    heightMode: 'fixed',       // 'fixed' or 'min' (grows with content)
    useLocalStorage: true,
    language: 'en',            // 'en' or 'ar'
    showPageBreaks: true,      // enable the A4 page system
    margins: { top: 20, bottom: 20, left: 20, right: 20 }
  });
</script>
```

That's it — the toolbar, the page area, and every modal dialog are created automatically inside the container you provide.

---

## Configuration options

| Option | Default | Description |
|---|---|---|
| `width` | `'880px'` | Maximum width of the editor container. |
| `height` | `'400px'` | Height (or minimum height) of the editor area. |
| `heightMode` | `'fixed'` | `'fixed'` for a set height, or `'min'` to let the editor grow with its content. |
| `useLocalStorage` | `false` | Persist content, margins, and the watermark across page reloads. |
| `language` | `'en'` | Interface language: `'en'` or `'ar'`. Sets text direction automatically. |
| `borderRadius` | `'0'` | Border radius of the editor container. |
| `showPageBreaks` | `true` | Enables the A4 page system (margins, page numbers, "Add page," per-page margin panel). |
| `margins` | `{top:10, bottom:10, left:10, right:10}` | Default page margins in millimetres, used unless a page has its own override. |
| `pageNumberInset` | `15` | Distance, in millimetres, from the right edge of the sheet to the "1 / 3" page number. |

---

## The page system

When `showPageBreaks` is enabled, the editor behaves like a page-based word processor:

- Content automatically flows onto a new page once it no longer fits, exactly as it will when printed.
- Each page can have its **own margins** — click the small margin icon on any page, or the "Margins" toolbar button, to open the floating margin panel. From there you can also **apply one page's margins to every page**, **reset** a page to the defaults, or **download that page as a PNG**.
- The **"Add Page"** button inserts a manual page break.
- A small badge in the corner always shows which page the caret is currently on and how many pages the document has.
- **Print as PDF** lays the document out identically to the screen — same margins, same page breaks, same watermark and page numbers — and keeps links clickable in the saved PDF.

---

## Watermark

Click the watermark button in the toolbar to set one line of diagonal, semi-transparent text (for example "CONFIDENTIAL" or "DRAFT"). It is applied to:

- every page currently in the document,
- every page added afterward, automatically,
- the printed PDF,
- and any page downloaded as a PNG —

all using the exact same text, color, opacity, and angle, so the four never disagree with one another. The watermark is remembered between sessions when `useLocalStorage` is enabled.

---

## Handwriting and drawing

Click the handwriting (pen) button to open a small floating toolbar with a **pen**, a **highlighter**, and an **eraser**, a color palette, an adjustable size, undo/redo, and Done/Cancel. Drawing happens directly on top of the page — not in a separate box — so you can sketch right next to your text.

A finished drawing becomes a small, self-contained figure on the page that you can drag, resize, and rotate like an image. Unlike a normal image, though, it is never flattened: **double-click any drawing to reopen it**, add more strokes, or erase part of it, and the changes are saved back into that same drawing.

---

## Images, drawings, and how they sit on the page

Both uploaded images and hand-drawn figures:

- **Drag** freely anywhere on the page, including into the margins — they are only ever stopped by the edge of the sheet itself.
- **Resize** using the handle in the bottom-right corner; the same page-edge limit applies smoothly as you resize.
- **Rotate** using the small handle above the selected image; rotation snaps gently to every 15° and, again, stays within the page.
- Can be **aligned** (left, center, right, or full width) via the alignment toolbar button, which snaps them to that page's margin.
- Can be **deleted** instantly with the Delete or Backspace key once selected.

---

## Formatting reference

| Category | Tools |
|---|---|
| Text style | Bold, italic, underline, strikethrough, superscript, subscript |
| Font | Font family, font size, font color, highlight color |
| Structure | Blockquote, ordered list, unordered list, code block / inline code |
| Alignment | Left, center, right, justify |
| Insert | Image, table, hyperlink, emoji, handwriting/drawing |
| Page tools | Add page, page margins, watermark, print as PDF |
| Other | Undo, redo, remove formatting, clear all |

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Shift` + `Enter` | New quote line |
| `Ctrl` + `+` | Enlarge text (line level) |
| `Ctrl` + `-` | Shrink text (line level) |
| `Tab` | Insert 4 spaces (or outdent with `Shift` + `Tab`) |
| `Delete` | Remove a selected image, drawing, or table |

(This list is also available inside the editor via the "About" (ⓘ) toolbar button.)

---

## Code blocks

Select any text and click the code button to turn it into a syntax-highlighted code block (or inline code, for a short selection inside one line). The language is detected automatically — JavaScript, Python, HTML, SQL, Shell, CSS, PHP, and Go-style syntax are all recognized — and keywords, strings, comments, numbers, and function names are colored accordingly, both on screen and when printed.

---

## Data persistence

With `useLocalStorage: true`, the editor automatically saves:

- the document's content,
- every page's margins (and the shared defaults),
- the watermark, and
- every hand-drawn stroke of every drawing —

so a page refresh brings everything back exactly as it was left, including the pixels of any drawing (which are redrawn from the saved stroke data, since a saved image alone cannot store a canvas's pixels).

---

## Browser support

jCaret is built on standard `contentEditable`, the Canvas API, and Pointer Events, and works in any modern Chromium-, Firefox-, or Safari-based browser. Printing to PDF uses the browser's own native print dialog — choose **"Save as PDF"** as the destination to keep hyperlinks clickable in the saved file.

---

*Made with love by [www.auktubli.com](https://www.auktubli.com)*
