# Mute by Entity

An early Chrome extension prototype for selecting the content container around a
listing, post, or result. This repository intentionally does not use UTags code
or dependencies.

## Milestone 1

The extension currently provides the interaction foundation only:

- A privacy-limited Manifest V3 extension using `activeTab` and `scripting`
- A popup that starts selection mode on demand
- Isolated hover and confirmation UI rendered in a Shadow DOM
- Semantic and repeated-sibling container scoring
- Arrow-key adjustment between nested candidate boxes
- Escape-to-cancel and a non-destructive confirmation step

It does **not** infer an author or seller, save rules, or hide content yet.

## Try it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this directory.
4. Open a normal webpage and press the extension icon.
5. Choose **Start selecting**.

Use the up/down arrow keys if a page has nested candidate containers. Press
Escape to cancel.

## Local selection fixture

Serve the repository with any static server and open
`fixtures/listings.html`. For example:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173/fixtures/listings.html` and use the **Start
selector demo** button. The fixture includes semantic `<article>` listings and
plain repeated `<div>` result rows.

## Structure

- `manifest.json` — minimal Chrome MV3 permissions and popup registration
- `hello.html`, `popup.css`, `popup.js` — extension popup
- `content.js` — page-local container-selection controller and isolated UI
- `fixtures/listings.html` — deterministic visual test page

The controller emits a `mute-by-entity:container-selected` event with a small,
non-persistent description of the chosen box. A later milestone can replace
that boundary with inferred entity and rule data without redesigning the UI.
