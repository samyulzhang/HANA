# ForegoneAI — HANA

Static front-end for ForegoneAI and its flagship intelligence platform, HANA.
No build step, no dependencies, no framework. Plain HTML, CSS and JavaScript.

## Run it

Fonts and videos need to be served over HTTP — opening `index.html` straight from
the filesystem will fall back to system fonts. From this folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
# or
npx serve .
```

## Deploy

Upload the contents of this folder to any static host — GitHub Pages, Netlify,
Vercel, Cloudflare Pages, S3. There is nothing to compile.

For GitHub Pages, push this folder as the repo root (or `/docs`) and add an empty
`.nojekyll` file so the `assets/` directory is served verbatim.

## Structure

```
index.html        Home — hero, why we exist, HANA, systems, approach, partners
company.html      Why ForegoneAI exists, built from inside the work, the approach
hana.html         The platform, what HANA does, how HANA approaches intelligence
systems.html      H9N · H1S · H5B, future systems
future.html       Long-term areas of interest, deliberate expansion
careers.html      Who we're interested in, how we work
contact.html      Contact details + inquiry form

assets/css/main.css   Design tokens + every component
assets/js/main.js     Motion layer (see below)
assets/fonts/         Parkinsans, Onest, Darker Grotesque (variable, OFL)
assets/img/           WebP, 1920w + 960w + poster frames
assets/video/         MP4 + WebM, ~1 MB each
```

## Design system

Everything is driven by custom properties at the top of `main.css`.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#08070A` | Page base |
| `--amber` | `#E8963A` | Primary accent |
| `--amber-hot` / `--amber-soft` | `#FF7A2F` / `#F4C67A` | Gradient ends |
| `--dusk-teal` / `--dusk-rose` | `#79C3BD` / `#E5A3AE` | Secondary accents |
| `--ink` → `--ink-4` | `#EDE8E1` → `#55504B` | Text ramp |

Type: **Parkinsans** for display, **Onest** for body and UI, **Darker Grotesque**
for oversized statement lines. All three are variable fonts under the SIL Open
Font License (see `assets/fonts/OFL-*.txt`).

## Motion layer

`assets/js/main.js` is a single IIFE with fourteen independent modules — sticky
nav, scroll progress, reveal-on-scroll, hero line reveal, custom cursor, parallax,
card pointer glow, count-up, the network canvas, a WebGL amber field, visibility-
gated video playback, marquee, form handling and the year stamp.

Markup hooks:

| Attribute | Effect |
|---|---|
| `data-rv` | Reveal on scroll. Values: `fade`, `left`, `right`, `scale`, `clip` |
| `data-rv-delay="0.2"` | Delay in seconds |
| `data-rv-stagger="0.07"` | On a parent — auto-delays its `[data-rv]` children |
| `data-para="0.08"` | Parallax; higher = more travel |
| `data-net` | Renders the node-network canvas (hero) |
| `data-field` | Renders the WebGL dusk field (CTA) |
| `data-auto` | Video plays only while on screen |
| `data-count="12"` | Counts up when scrolled into view |

Every effect is skipped under `prefers-reduced-motion: reduce`, and the WebGL
field silently no-ops when the context is unavailable.

## Before launch

- The contact form is front-end only. Point `form[data-form]` at your mail
  service or CRM endpoint in `forms()` (`main.js`).
- Placeholder addresses in `contact.html` use `@foregoneai.com` — swap for real
  inboxes.
- Add real `og:image` artwork sized 1200×630 if you want richer link previews.
