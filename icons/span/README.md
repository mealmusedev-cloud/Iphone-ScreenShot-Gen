# Span · menu icon set

Four mobile puzzle-game menu icons — **Store, Versus, Create, Arcade** — built as
one cohesive set for Span's interface.

| File | What it is |
| --- | --- |
| `store.svg` `versus.svg` `create.svg` `arcade.svg` | Standalone icons, transparent background |
| `span-menu-icons.svg` | The four icons in a clean 2×2 presentation |
| `SpanMenuIcons.jsx` | React components (`StoreIcon`, `VersusIcon`, `CreateIcon`, `ArcadeIcon`, `SpanIconSheet`) |

## Shared construction

Every icon uses exactly the same frame, so the set reads as one system:

| Property | Value |
| --- | --- |
| Canvas | 96 × 96 (viewBox), transparent |
| Tint well | circle r 44 centred, primary color at 14% opacity |
| Symbol envelope | ~56 × 56, centred (≈20 units padding) |
| Stroke weight | 7, round caps and joins (filled forms carry a matching 3–4 self-stroke for rounded corners) |
| Corner radius | 9 on rounded squares, 2.5 on small corners |
| Perspective | flat, front-on, no 3D |

Flat colors only. No gradients, texture, lighting, gloss, beveling, words, borders, tiles, scenery or decorative particles.

## Porcelain palette

| Role | Hex |
| --- | --- |
| Dark ink | `#202124` |
| Polished blue | `#3973E6` |
| Deep blue | `#2859B8` |
| Warm yellow | `#FFC14A` |
| Coral (competition) | `#E5655B` |

The well of each icon is tinted with that icon's primary color (blue, coral, blue, yellow).
Change `tint` on `SpanIcon` to use one shared neutral well instead.

## Subject descriptions

- **Store** — A bold rounded artist's paint palette with three simple circular paint wells and one thumb opening. Polished blue outline, deep blue wells.
- **Versus** — Two simplified rounded player silhouettes facing one another, balanced symmetrically, with one small centered competition spark. Coral-red primary color, warm yellow spark.
- **Create** — A bold rounded pencil crossing the lower-right edge of a simple rounded-square board outline, clearly communicating board creation. Polished blue board, deep blue pencil.
- **Arcade** — A single bold lightning bolt, centered and slightly forward-leaning, communicating quick energetic play. Warm yellow primary color.

## Using the JSX

```jsx
import { StoreIcon, VersusIcon, CreateIcon, ArcadeIcon, SpanIconSheet } from "./SpanMenuIcons";

<StoreIcon size={24} />          // menu row, 24 pt
<VersusIcon size={20} well={false} />
<SpanIconSheet size={96} gap={64} />
```

Each component takes `size` (px, default 24), `well` (show the tint well, default true), `title` (accessible label; pass `""` for decorative) and any other SVG props.
