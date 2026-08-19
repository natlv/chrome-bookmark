# Feed Cleanser (previously Mute Anyone)

A privacy-limited Chrome extension that mutes profiles per site and hides
content they create. This repository intentionally does not use UTags code or
dependencies.

## Current milestone

The extension currently provides:

- A Manifest V3 extension using `activeTab`, `scripting`, and local extension storage
- Automatic page-local filtering on normal HTTP(S) pages, with no network calls
- A global on/off switch that is independent from profile detection
- Per-hostname muted profile sets stored only on the current device
- Per-hostname blocked keywords matched case-insensitively against card text
- Shared filter-target boundaries so profile and keyword matches collapse their grid or list cells
- A popup that starts profile detection on demand and lists profiles muted for the current site
- One-click unmuting from the popup
- A responsive settings page that lists muted profiles and blocked keywords across every site
- Isolated hover and confirmation UI rendered in a Shadow DOM
- Semantic and repeated-sibling container scoring
- Identity-seeded discovery for repeated cards that have no semantic card or listing marker
- Read-only seller/author/commenter detection while hovering
- Bounded fallback to a surrounding box when the inner box has no identity
- Container selection remains available when identity detection is uncertain or unavailable
- LinkedIn actor/profile-link and YouTube channel-link recognition
- Carousell `/u/<username>` seller-link recognition
- Etsy listing-card `data-shop-id` extraction, preserving the stable numeric shop ID
- Marketplace listing-cell collapsing for Carousell and Etsy so filtered grids reflow
- YouTube watch-player lookup when the visible owner link sits beside the player
- YouTube video-unit lookup across thumbnail/channel sibling branches, including rich grids
- One bounded retry for YouTube components that hydrate shortly after hover
- Profile, company, and channel headers inferred from matching LinkedIn/YouTube page routes
- LinkedIn posts and comments resolve against their own actor metadata, excluding
  social-context links, inline tagged profiles, and identities from nested comments
- LinkedIn’s semantic-class and current obfuscated-class feed renderers are handled
  separately; the current renderer uses feed/comment boundaries and repeated avatar
  identity clusters rather than unstable generated class names
- Ambiguity detection when a box has competing identities
- An always-visible **Exit** button in addition to Escape
- Escape-to-cancel and an explicit mute confirmation step
- Automatic rescanning as dynamically loaded feed items are added
- Keyword controls in the popup for adding, viewing, and removing the current site's rules
- Exact restoration of hidden content when filtering is switched off or a profile is unmuted

Identity detection remains heuristic. A profile is saved only after the user
selects a content box with one confidently detected identity and confirms the
mute. Ambiguous boxes cannot be muted.

Detection runs through a shared page-local pipeline:

1. Discover a semantic unit, an identity-seeded repeated unit, or a supported site scope.
2. Collect linked identity candidates inside that scope.
3. Classify each candidate's relationship to the content.
4. Canonicalize the winning profile URL or stable entity ID.
5. Resolve ambiguity before allowing a mute.
6. Hide the repeated grid, flex, or list boundary when a saved rule matches.

Supported-site behavior is registered in the ordered `IDENTITY_SCOPE_RULES`
table in `content.js`. LinkedIn retains a focused ownership adapter because its
posts, comments, mentions, and social-context links require different treatment.
Carousell, Etsy, YouTube, and page-header handling use the same pipeline stages
and shared filter-boundary resolver as the generic fallback.

For LinkedIn, detected ownership and future mute matching are deliberately
separate. A person defaults to authored posts and their own comments. An
organization also includes jobs. Mentions, photo tags, social-context activity
(such as likes), and a profile merely commenting on someone else’s post do not
make that surrounding post match the muted entity. A matching comment can be
removed at the comment boundary while leaving the post intact, so following the
post author does not need to be inferred from fragile feed markup.

TLDR current state: the detection works for Linkedin and Carousell and Youtube and Reddit. Etsy listing cards expose a stable numeric `data-shop-id`, which is now captured directly without depending on the displayed shop name. Doesn't work at all yet for Ebay or Pinterest (expected because creator names are not displayed until you click on a specific listing). Instagram is deferred because its native controls cover basic account muting.

## Try it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this directory.
4. Open a normal webpage and press the extension icon.
5. Choose **Find a profile to mute**, point at a content box, and confirm the detected profile.

Use **Automatic muting** in the popup to pause or resume all filtering without
removing saved profiles. The popup list is scoped to the current hostname. Use
**Manage all sites** to open the full settings page, or open the extension's
options from `chrome://extensions`.

Use **Blocked keywords** in the popup to hide detected cards whose visible text
contains a keyword. Keywords are case-insensitive, treat consecutive whitespace
as one space, and apply only to the current hostname.

After updating the unpacked extension, use **Reload** on `chrome://extensions`
and refresh existing website tabs. Chrome does not activate new manifest
permissions, including local storage, until the extension is reloaded.

Press Escape to cancel profile detection.

## Local selection fixture

Serve the repository with any static server and open
`fixtures/listings.html`. For example:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173/fixtures/listings.html` and use the **Start
selector demo** button. The fixture includes semantic `<article>` listings,
plain repeated `<div>` result rows, LinkedIn-shaped legacy and current-renderer
posts with nested comments, inline tagged profiles, and social attribution, plus YouTube-shaped video cards with and
without a detectable channel. It also includes a Carousell username link and a
multi-column YouTube rich-grid structure, an overlapping multi-identity box,
and an Etsy card with separate listing and shop IDs. Use **Block demo keywords**
to hide the existing keyboard plus nested Carousell/Etsy-shaped field-watch
cells, then **Add live ACME listing** to verify that a dynamically inserted
keyword match is hidden. You can also add that listing after muting ACME Audio
to check dynamically inserted profile matches.

The fixture also exposes `__runMuteByEntityFixtureChecks()` and records its
result on the document element through `data-fixture-checks`,
`data-fixture-check-count`, and `data-fixture-check-results`. These deterministic
checks cover generic ownership, ambiguity, supported-site rules, canonical URLs,
stable IDs, unattributed content, repeated-layout filter boundaries, and
end-to-end automatic filtering of Circlly-shaped generic cards.

## Structure

- `manifest.json` — minimal Chrome MV3 permissions and popup registration
- `hello.html`, `popup.css`, `popup.js` — extension popup
- `options.html`, `options.css`, `options.js` — all-sites settings page
- `content.js` — page-local container-selection controller and isolated UI
- `fixtures/listings.html` — deterministic visual test page
- `store-assets/` — source artwork for the Chrome Web Store listing

The controller emits a `mute-by-entity:profile-muted` event after a profile has
been persisted. Muted profile data contains only the detected identity key,
label, type, optional profile link or stable entity ID, and the time it was muted.
