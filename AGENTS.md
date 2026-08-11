# Repository working agreement

## Scope and safety

- Preserve the extension's selection and identity-detection behavior unless a task explicitly changes it.
- Keep the extension privacy-limited: no new host permissions, storage, network calls, or dependencies without an explicit requirement.
- Treat `fixtures/listings.html` as the deterministic manual regression surface for supported site shapes.

## Code style

- Follow the existing dependency-free JavaScript style: two-space indentation, single quotes, and no semicolons.
- Prefer small named helpers and shared UI primitives over duplicated markup or CSS.
- Route every content-hiding rule through the shared filter-target boundary helper. Hide the repeated grid, flex, or list cell rather than only an inner detected card so surrounding content reflows without blank spaces.
- Keep injected controls inside the existing Shadow DOM so host-page CSS cannot style them.
- Define injected typography through the shared `--selector-*` tokens and `.selector-type` primitive in `content.js`.
- Use explicit `font-size`, `font-weight`, and `line-height` properties. Do not combine `inherit` with other values in the `font` shorthand because the whole declaration becomes invalid.
- Any text inside a fixed-width or grid container must wrap, truncate, or shrink within that container. Use `minmax(0, 1fr)` or `min-width: 0` where grid or flex content could overflow.

## Verification

- Run `npm run check` after JavaScript changes.
- For injected UI changes, verify the local fixture at wide and narrow viewport widths and confirm long identity labels remain contained.
- Keep changes focused and avoid rewriting unrelated user edits.
