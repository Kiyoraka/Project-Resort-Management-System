# Illustration Assets - Sourcing Guide

This folder holds all **vector illustrations (SVG)** used across the Resort Management System for empty states, decorative section accents, and 404 pages. The visual language is **coastal-themed** — palm leaves, waves, shells, umbrellas — rendered in the Modern Beach Resort 2026 palette (teal, coral, olive). All assets must be CC0 or have a clear free-use commercial license.

## Recommended Sources

- **unDraw** (https://undraw.co) — primary source. CC0, customizable primary color directly on the site.
- **Storyset** (https://storyset.com) — secondary. Free with attribution, animated SVG options.
- **DrawKit** (https://drawkit.com) — premium but with a generous free section. Check license per pack.
- **SVG Repo** (https://svgrepo.com) — wider variety of decorative icons and accents. Most assets CC0; verify per file.

## Required Files

| Filename | Used By | Description | Suggested Search |
|---|---|---|---|
| empty-bookings.svg | resort/bookings.html, user/bookings.html empty state | "No bookings yet" friendly illustration with calendar/clipboard | "empty calendar" on unDraw |
| empty-messages.svg | stall/messages.html, resort/messages.html empty state | "No messages" with envelope/mailbox | "empty inbox" on unDraw |
| empty-cart.svg | stall/pos.html empty cart state | "Cart is empty" with shopping basket | "empty cart" on unDraw |
| empty-stock.svg | stall/stock.html no products state | "No products yet" with empty box | "empty box" on unDraw |
| empty-users.svg | admin/users.html no results state | "No users found" with magnifying glass | "no results" on unDraw |
| 404.svg | 404.html | Friendly lost-at-sea illustration | "lost", "404" on unDraw — set to coastal palette |
| palm-leaf.svg | Decorative accent, section dividers, empty states | Tropical palm leaf in olive-400 tones | SVG Repo "palm leaf" |
| wave.svg | Section dividers between landing sections | Stylized ocean wave svg, teal-500 | SVG Repo "wave divider" |
| shell.svg | Footer accent, gallery decorations | Seashell icon, decorative | SVG Repo "seashell" |
| beach-umbrella.svg | Empty states variation | Beach umbrella with chair | SVG Repo "beach umbrella" |
| boat.svg | Optional landing section accent | Small wooden fishing boat in silhouette | SVG Repo "fishing boat" |
| sunset-horizon.svg | Footer-top accent or page break | Sun on horizon line | SVG Repo "sunset" |

## unDraw Color Customization Tip

unDraw lets you set the primary illustration color via a color picker on the site (top-right of any illustration page). Set it to the project teal **#1F7A6F** (or coral **#E36F4D** for warm-toned illustrations) to match the Modern Beach Resort 2026 palette **before** downloading. This saves a manual find-replace pass in the SVG source after the fact.

## License

- **unDraw** is CC0 — no attribution required, but appreciated.
- **Storyset** and **DrawKit free tier** require attribution in `CREDITS.md` or in the site footer.
- **SVG Repo** — verify the license badge per file (most are CC0, some are MIT or BY).

## File Format Guidance

- **SVG preferred** for all illustrations — scales infinitely, theme-color-friendly via `fill="currentColor"` / `stroke="currentColor"`.
- Optimize with **SVGO** before committing (https://jakearchibald.github.io/svgomg/) — typical 70-80% size reduction with no visual difference.
- Avoid embedded raster images inside SVG (defeats the purpose) — re-export as pure vector if the source contains bitmaps.
- Keep `viewBox` intact when optimizing; never strip it (breaks responsive scaling).
