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
- Read-only seller/author/commenter detection while hovering
- Bounded fallback to a surrounding box when the inner box has no identity
- Container selection remains available when identity detection is uncertain or unavailable
- LinkedIn actor/profile-link and YouTube channel-link recognition
- Carousell `/u/<username>` seller-link recognition
- Etsy listing-card `data-shop-id` extraction, preserving the stable numeric shop ID
- YouTube watch-player lookup when the visible owner link sits beside the player
- YouTube video-unit lookup across thumbnail/channel sibling branches, including rich grids
- One bounded retry for YouTube components that hydrate shortly after hover
- Profile, company, and channel headers inferred from matching LinkedIn/YouTube page routes
- LinkedIn social-context links such as “a connection liked this” are demoted below the post author
- Ambiguity detection when a box has competing identities
- An always-visible **Exit** button in addition to Escape
- Escape-to-cancel and a non-destructive confirmation step

Identity detection is heuristic and read-only. The extension does **not** select
an identity action, save rules, or hide content yet.

TLDR current state: the detection works for Linkedin and Carousell and Youtube and Reddit (around 90%, edge cases to be ironed out later without sacrificing the main working functionality). Doesn't work at all for Ebay (expected because seller names are not displayed until you click on a specific listing). Etsy listing cards expose a stable numeric `data-shop-id`, which is now captured directly without depending on the displayed shop name.

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
selector demo** button. The fixture includes semantic `<article>` listings,
plain repeated `<div>` result rows, a LinkedIn-shaped post with a nested
comment and social attribution, plus YouTube-shaped video cards with and
without a detectable channel. It also includes a Carousell username link and a
multi-column YouTube rich-grid structure, an overlapping multi-identity box,
and an Etsy card with separate listing and shop IDs.

## Structure

- `manifest.json` — minimal Chrome MV3 permissions and popup registration
- `hello.html`, `popup.css`, `popup.js` — extension popup
- `content.js` — page-local container-selection controller and isolated UI
- `fixtures/listings.html` — deterministic visual test page

The controller emits a `mute-by-entity:container-selected` event with a small,
non-persistent description of the chosen box. A later milestone can replace
that boundary with inferred entity and rule data without redesigning the UI.
