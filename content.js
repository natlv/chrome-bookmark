(() => {
  if (globalThis.__muteByEntitySelectorInstalled) return
  globalThis.__muteByEntitySelectorInstalled = true

  const UI_TAG = 'mute-by-entity-selector-ui'
  const HIDDEN_ATTRIBUTE = 'data-mute-by-entity-hidden'
  const HIDDEN_STYLE_ID = 'mute-by-entity-hidden-style'
  const ENABLED_STORAGE_KEY = 'muteByEntityEnabled'
  const MUTED_STORAGE_PREFIX = 'muteByEntityMuted:'
  const SITE_FILTERS_STORAGE_KEY = 'siteFilters'
  const MIN_WIDTH = 150
  const MIN_HEIGHT = 64
  const MAX_ANCESTORS = 18
  const MIN_IDENTITY_SCORE = 7
  const MAX_IDENTITY_SCOPE_GROWTH = 8
  const MAX_FILTER_LAYOUT_ANCESTORS = 4
  const LINKEDIN_POST_UNIT_SELECTOR =
    '[class*="feed-shared-update" i], [data-urn^="urn:li:activity:"]'
  const LINKEDIN_COMMENT_UNIT_SELECTOR =
    '[class*="comments-comment-item" i], [class*="comments-reply-item" i]'
  const LINKEDIN_CONTENT_UNIT_SELECTOR =
    `${LINKEDIN_COMMENT_UNIT_SELECTOR}, ${LINKEDIN_POST_UNIT_SELECTOR}`
  const LINKEDIN_CURRENT_COMMENT_SELECTOR = '[componentkey^="replaceableComment_"]'
  const LINKEDIN_CURRENT_POST_SELECTOR = '[role="listitem"]'
  const LINKEDIN_CURRENT_FEED_SELECTOR = '[data-testid="mainFeed"]'
  const LINKEDIN_TEXT_CONTENT_SELECTOR = '[data-testid="expandable-text-box"]'
  const LINKEDIN_POST_OWNER_WORDS = /update-components-actor|feed-shared-actor/i
  const LINKEDIN_COMMENT_OWNER_WORDS = /comments-post-meta|comment-actor/i
  const YOUTUBE_VIDEO_UNIT_SELECTOR = [
    'ytd-video-renderer',
    'ytd-rich-item-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-reel-item-renderer',
    'yt-lockup-view-model',
  ].join(',')
  const ETSY_LISTING_UNIT_SELECTOR =
    '[data-shop-id], [data-listing-id], [class*="etsy-listing-card" i], [class*="v2-listing-card" i]'
  const CAROUSELL_LISTING_TEST_ID = /^listing-card-\d+$/
  const SEMANTIC_SELECTOR = [
    'article',
    '[role="article"]',
    '[role="listitem"]',
    'li',
    'tr',
    '[data-card]',
    '[data-listing-id]',
    '[data-testid*="card" i]',
    '[data-testid*="listing" i]',
    '[class~="card"]',
    '[class*="-card" i]',
    '[class*="card-" i]',
    '[class*="listing" i]',
    '[class*="product" i]',
    '[class*="result" i]',
    '[class*="tile" i]',
    '[class*="post" i]',
    'ytd-video-renderer',
    'ytd-rich-item-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-reel-item-renderer',
    'yt-lockup-view-model',
    '#movie_player',
    'ytd-player',
    'ytd-comment-thread-renderer',
    'ytd-comment-view-model',
  ].join(',')
  const CONTENT_UNIT_SELECTOR = [
    'article',
    '[role="article"]',
    '[role="listitem"]',
    'li',
    'tr',
    '[data-card]',
    '[data-listing-id]',
    '[data-testid*="card" i]',
    '[data-testid*="listing" i]',
    '[class~="card"]',
    '[class*="-card" i]',
    '[class*="result-row" i]',
    '[class*="listing-item" i]',
    '[class*="feed-shared-update" i]',
    '[class*="comments-comment-item" i]',
    'ytd-video-renderer',
    'ytd-rich-item-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-reel-item-renderer',
    'yt-lockup-view-model',
    '#movie_player',
    'ytd-player',
    'ytd-comment-thread-renderer',
    'ytd-comment-view-model',
  ].join(',')
  const IDENTITY_WORDS =
    /actor|author|attribution|byline|seller|vendor|merchant|shop|store|user|username|profile|creator|channel|poster|commenter|comment-author|member|owner|publisher|metadata/i
  const PRIMARY_IDENTITY_WORDS =
    /update-components-actor|feed-shared-actor|comments-post-meta|comment-actor|video-owner|channel-name|channel-info|content-metadata/i
  const SECONDARY_ATTRIBUTION_WORDS =
    /update-components-header|social-activity|social-proof|relevance-context|feed-shared-header/i
  const NON_IDENTITY_WORDS =
    /product|listing-title|post-title|article-title|comment-link|category|topic|tag|search|share|reply|like|login|sign-?up/i

  function getSiteKey(href = location.href) {
    try {
      return new URL(href).hostname.replace(/^www\./i, '').toLowerCase()
    } catch {
      return location.hostname.replace(/^www\./i, '').toLowerCase()
    }
  }

  function getMutedStorageKey(siteKey) {
    return `${MUTED_STORAGE_PREFIX}${siteKey}`
  }

  function normalizeBlockedKeywords(keywords) {
    if (!Array.isArray(keywords)) return []
    return [...new Set(
      keywords
        .map((keyword) => String(keyword || '').trim().toLowerCase())
        .filter(Boolean)
    )]
  }

  function getBlockedKeywords(siteFilters, siteKey) {
    return normalizeBlockedKeywords(siteFilters?.[siteKey]?.blockedKeywords)
  }

  class ExtensionStateStore {
    constructor() {
      this.fixtureState = {}
    }

    async get(keys) {
      if (globalThis.chrome?.storage?.local) {
        return chrome.storage.local.get(keys)
      }

      if (globalThis.chrome?.runtime?.id) {
        throw new Error('Extension storage is unavailable')
      }

      const result = {}
      for (const key of keys) {
        if (Object.hasOwn(this.fixtureState, key)) result[key] = this.fixtureState[key]
      }
      return result
    }

    async set(values) {
      if (globalThis.chrome?.storage?.local) {
        await chrome.storage.local.set(values)
        return
      }

      if (globalThis.chrome?.runtime?.id) {
        throw new Error('Extension storage is unavailable')
      }

      Object.assign(this.fixtureState, values)
    }

    onChanged(listener) {
      if (!globalThis.chrome?.storage?.onChanged) return
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') listener(changes)
      })
    }
  }

  class ContainerSelector {
    constructor() {
      this.active = false
      this.locked = false
      this.candidates = []
      this.candidateIndex = -1
      this.target = null
      this.frameRequest = 0
      this.pendingPoint = null
      this.identityResult = null
      this.identityRetryTimer = 0
      this.hoveredElement = null

      this.onPointerMove = this.onPointerMove.bind(this)
      this.onClick = this.onClick.bind(this)
      this.onKeyDown = this.onKeyDown.bind(this)
      this.onViewportChange = this.onViewportChange.bind(this)
    }

    start() {
      if (this.active) {
        this.locked = false
        this.hideConfirmation()
        return
      }

      this.active = true
      this.locked = false
      this.mount()
      document.addEventListener('pointermove', this.onPointerMove, true)
      document.addEventListener('click', this.onClick, true)
      document.addEventListener('keydown', this.onKeyDown, true)
      window.addEventListener('scroll', this.onViewportChange, true)
      window.addEventListener('resize', this.onViewportChange, true)
      this.helpElement.classList.add('is-visible')
    }

    stop(message = '') {
      if (!this.active) return

      this.active = false
      this.locked = false
      this.target = null
      this.identityResult = null
      this.hoveredElement = null
      this.candidates = []
      this.candidateIndex = -1
      document.removeEventListener('pointermove', this.onPointerMove, true)
      document.removeEventListener('click', this.onClick, true)
      document.removeEventListener('keydown', this.onKeyDown, true)
      window.removeEventListener('scroll', this.onViewportChange, true)
      window.removeEventListener('resize', this.onViewportChange, true)
      cancelAnimationFrame(this.frameRequest)
      clearTimeout(this.identityRetryTimer)

      if (message) {
        this.showToast(message)
        setTimeout(() => this.unmount(), 1200)
      } else {
        this.unmount()
      }
    }

    mount() {
      this.host = document.getElementById(UI_TAG)
      if (this.host) this.host.remove()

      this.host = document.createElement('div')
      this.host.id = UI_TAG
      this.host.setAttribute('data-mute-by-entity-ui', '')
      this.shadow = this.host.attachShadow({ mode: 'open' })
      this.shadow.innerHTML = `
        <style>${this.styles()}</style>
        <div class="selection-box" aria-hidden="true">
          <i class="corner top-left"></i><i class="corner top-right"></i>
          <i class="corner bottom-left"></i><i class="corner bottom-right"></i>
          <div class="box-label"></div>
        </div>
        <div class="help selector-type" role="status">
          <span>Press</span>
          <kbd>Esc</kbd>
          <span>or the Exit button to stop scanning</span>
        </div>
        <aside class="identity-panel selector-type selector-panel" aria-live="polite">
          <div class="identity-header">
            <span>Linked identity</span>
            <button class="exit-button" type="button" aria-label="Exit selection mode">Exit</button>
          </div>
          <div class="identity-state" data-status="waiting">
            <span class="identity-icon" aria-hidden="true">?</span>
            <div>
              <strong class="identity-title">Move over a content box</strong>
              <small class="identity-detail">We’ll look for a linked seller or author.</small>
              <small class="identity-target-row" hidden>
                <span class="identity-target-label">Identity target</span>
                <a class="identity-target-value" target="_blank" rel="noopener noreferrer"></a>
              </small>
            </div>
          </div>
        </aside>
        <section class="confirmation selector-type selector-panel" role="dialog" aria-label="Confirm muted profile">
          <p class="confirmation-kicker">Profile detected</p>
          <h2>Mute this profile?</h2>
          <p class="confirmation-copy">Matching content from this profile will be hidden on this site.</p>
          <div class="confirmation-actions">
            <button class="secondary" type="button">Keep looking</button>
            <button class="primary" type="button">Mute profile</button>
          </div>
        </section>
        <div class="toast selector-type" role="status" aria-live="polite"></div>
      `
      document.documentElement.append(this.host)

      this.boxElement = this.shadow.querySelector('.selection-box')
      this.labelElement = this.shadow.querySelector('.box-label')
      this.helpElement = this.shadow.querySelector('.help')
      this.confirmationElement = this.shadow.querySelector('.confirmation')
      this.toastElement = this.shadow.querySelector('.toast')
      this.identityStateElement = this.shadow.querySelector('.identity-state')
      this.identityTitleElement = this.shadow.querySelector('.identity-title')
      this.identityDetailElement = this.shadow.querySelector('.identity-detail')
      this.identityTargetRowElement = this.shadow.querySelector('.identity-target-row')
      this.identityTargetLabelElement = this.shadow.querySelector('.identity-target-label')
      this.identityTargetValueElement = this.shadow.querySelector('.identity-target-value')

      this.shadow.querySelector('.exit-button').addEventListener('click', () => {
        this.stop()
      })

      this.shadow.querySelector('.secondary').addEventListener('click', () => {
        this.locked = false
        this.hideConfirmation()
      })
      this.shadow.querySelector('.primary').addEventListener('click', async (event) => {
        if (this.identityResult?.status !== 'found') return

        const button = event.currentTarget
        button.disabled = true
        const { container: _container, ...identity } = this.identityResult
        const selected = { ...this.describeTarget(this.target), identity }

        try {
          const { added } = await mutingEngine.addIdentity(identity)
          globalThis.dispatchEvent(
            new CustomEvent('mute-by-entity:profile-muted', { detail: selected })
          )
          this.stop(added ? `${identity.label} muted on this site` : `${identity.label} is already muted`)
        } catch (error) {
          button.disabled = false
          const message = error instanceof Error ? error.message : String(error)
          this.showToast(
            message.includes('storage is unavailable')
              ? 'Reload the extension, refresh this tab, then try again'
              : 'Could not save this muted profile'
          )
        }
      })
    }

    unmount() {
      this.host?.remove()
      this.host = null
      this.shadow = null
    }

    styles() {
      return `
        :host {
          all: initial;
          --selector-font: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          --selector-text-xs: 10px;
          --selector-text-sm: 11px;
          --selector-text-md: 12px;
          --selector-text-lg: 13px;
          --selector-panel-border: 1px solid rgb(255 255 255 / 70%);
          --selector-panel-background: rgb(255 253 248 / 96%);
          --selector-panel-shadow: 0 14px 42px rgb(25 37 42 / 22%);
        }
        *, *::before, *::after { box-sizing: border-box; }
        .selector-type {
          font-family: var(--selector-font);
          font-size: var(--selector-text-md);
          font-style: normal;
          line-height: 1.35;
          text-size-adjust: 100%;
          -webkit-text-size-adjust: 100%;
        }
        .selector-panel {
          border: var(--selector-panel-border);
          color: #1e292e;
          background: var(--selector-panel-background);
          box-shadow: var(--selector-panel-shadow);
        }
        button, kbd { font-family: inherit; }
        .selection-box {
          position: fixed; z-index: 2147483645; display: none; pointer-events: none;
          border: 2px solid #f06a4b; border-radius: 10px;
          background: rgb(240 106 75 / 7%);
          box-shadow: 0 0 0 3px rgb(255 255 255 / 82%), 0 10px 38px rgb(31 43 49 / 18%);
          transition: top 75ms ease, left 75ms ease, width 75ms ease, height 75ms ease;
        }
        .selection-box.is-visible { display: block; }
        .corner { position: absolute; width: 12px; height: 12px; border-color: #f06a4b; }
        .top-left { top: -5px; left: -5px; border-top: 4px solid; border-left: 4px solid; border-radius: 5px 0 0; }
        .top-right { top: -5px; right: -5px; border-top: 4px solid; border-right: 4px solid; border-radius: 0 5px 0 0; }
        .bottom-left { bottom: -5px; left: -5px; border-bottom: 4px solid; border-left: 4px solid; border-radius: 0 0 0 5px; }
        .bottom-right { right: -5px; bottom: -5px; border-right: 4px solid; border-bottom: 4px solid; border-radius: 0 0 5px; }
        .box-label {
          position: absolute; left: -2px; bottom: calc(100% + 8px); max-width: 320px;
          overflow: hidden; padding: 6px 9px; border-radius: 8px; color: #fffdf8;
          text-overflow: ellipsis; white-space: nowrap; background: #202c32;
          box-shadow: 0 5px 18px rgb(32 44 50 / 24%);
          font-family: var(--selector-font); font-size: var(--selector-text-sm); font-weight: 700; line-height: 1.2;
          letter-spacing: .01em;
        }
        .help {
          position: fixed; z-index: 2147483647; top: 16px; left: 50%;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: min(460px, calc(100vw - 32px)); min-width: 0;
          padding: 11px 18px; border: 1px solid rgb(255 255 255 / 65%); border-radius: 999px;
          opacity: 0; color: #edf1ef; background: rgb(32 44 50 / 96%);
          box-shadow: 0 14px 38px rgb(20 31 36 / 28%); pointer-events: none;
          transform: translate(-50%, -12px); transition: opacity 160ms ease, transform 160ms ease;
          line-height: 1.3;
          backdrop-filter: blur(12px);
        }
        .help.is-visible { opacity: 1; transform: translate(-50%, 0); }
        .help > span { min-width: 0; color: #d7dddb; overflow-wrap: anywhere; }
        kbd { min-width: 21px; padding: 2px 5px; border: 1px solid #667176; border-bottom-width: 2px; border-radius: 5px; color: #f8faf7; text-align: center; font-size: var(--selector-text-xs); font-weight: 700; line-height: 1.2; background: #35434a; }
        .identity-panel {
          position: fixed; z-index: 2147483647; top: 68px; right: 16px; width: min(310px, calc(100vw - 32px));
          overflow: hidden; border-radius: 15px; pointer-events: auto;
          backdrop-filter: blur(14px);
        }
        .identity-header {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 9px 10px 8px 13px; border-bottom: 1px solid #e9e3d9;
          color: #7a8384; font-size: var(--selector-text-xs); font-weight: 750; line-height: 1.2; letter-spacing: .09em; text-transform: uppercase;
        }
        .exit-button {
          padding: 6px 9px; border: 1px solid #d9d3c8; border-radius: 8px; color: #445054;
          background: #fffdf9; cursor: pointer; font-size: var(--selector-text-xs); font-weight: 750; line-height: 1; letter-spacing: 0; text-transform: none;
        }
        .exit-button:hover { color: #a4412d; border-color: #e2ad9f; background: #fff8f4; }
        .identity-state { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 10px; padding: 12px 13px 13px; }
        .identity-state > div { min-width: 0; }
        .identity-icon {
          display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px;
          color: #667174; background: #ece9e2; font-size: 14px; font-weight: 800; line-height: 1;
        }
        .identity-state strong, .identity-state small { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .identity-state strong { color: #273238; font-size: var(--selector-text-lg); font-weight: 750; line-height: 1.35; }
        .identity-state small { margin-top: 2px; color: #727c7e; font-size: var(--selector-text-sm); line-height: 1.35; }
        .identity-state .identity-target-row {
          margin-top: 7px; padding-top: 6px; border-top: 1px solid #e9e3d9;
          overflow: visible; text-overflow: clip; white-space: normal;
        }
        .identity-target-label {
          display: block; margin-bottom: 2px; color: #7a8384;
          font-size: var(--selector-text-xs); font-weight: 750; line-height: 1.25;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .identity-target-value {
          display: block; min-width: 0; max-width: 100%; color: #364448;
          overflow-wrap: anywhere; white-space: normal; word-break: break-word;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: var(--selector-text-xs); font-weight: 600; line-height: 1.4;
          text-decoration: none;
        }
        .identity-target-value.is-link {
          color: #176143; text-decoration: underline;
          text-decoration-color: rgb(23 97 67 / 35%); text-underline-offset: 2px;
        }
        .identity-target-value.is-link:hover { color: #0d4d33; text-decoration-color: currentColor; }
        .identity-target-row[hidden] { display: none; }
        .identity-state[data-status="found"] .identity-icon { color: #176143; background: #dcefe5; }
        .identity-state[data-status="ambiguous"] .identity-icon { color: #a84c34; background: #f8e5de; }
        .identity-state[data-status="ambiguous"] strong {
          display: -webkit-box; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
        }
        .identity-state[data-status="none"] .identity-icon { color: #687275; background: #e9e8e3; }
        .confirmation {
          position: fixed; z-index: 2147483647; display: none; width: min(330px, calc(100vw - 28px));
          padding: 17px; border-color: #ded9cf; border-radius: 16px; pointer-events: auto;
        }
        .confirmation.is-visible { display: block; animation: arrive 150ms ease-out; }
        @keyframes arrive { from { opacity: 0; transform: translateY(5px) scale(.985); } }
        .confirmation-kicker { margin: 0 0 4px; color: #c65338; font-size: var(--selector-text-xs); font-weight: 750; line-height: 1.2; letter-spacing: .1em; text-transform: uppercase; }
        .confirmation h2 { margin: 0; overflow-wrap: anywhere; color: #1e292e; font-size: 18px; font-weight: 750; line-height: 1.25; letter-spacing: -.02em; }
        .confirmation-copy { margin: 7px 0 15px; overflow-wrap: anywhere; color: #647073; font-size: var(--selector-text-md); line-height: 1.5; }
        .confirmation-actions { display: flex; justify-content: flex-end; gap: 8px; }
        button { padding: 8px 11px; border-radius: 9px; cursor: pointer; font-size: var(--selector-text-sm); font-weight: 700; line-height: 1; }
        button:focus-visible { outline: 3px solid rgb(240 106 75 / 25%); outline-offset: 2px; }
        button.secondary { border: 1px solid #d8d3ca; color: #596467; background: #fffdf9; }
        button.primary { border: 1px solid #202c32; color: #fffdf9; background: #202c32; }
        button:disabled { opacity: .5; cursor: not-allowed; }
        button:hover { filter: brightness(.97); }
        .toast {
          position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; display: none;
          padding: 11px 15px; border-radius: 12px; color: #f7fff9; background: #287456;
          box-shadow: 0 13px 35px rgb(23 78 57 / 24%); transform: translateX(-50%);
          max-width: calc(100vw - 32px); overflow-wrap: anywhere; font-weight: 700; line-height: 1.3;
        }
        .toast.is-visible { display: block; animation: toast-in 170ms ease-out; }
        @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px); } }
        @media (max-width: 680px) {
          .help { top: 10px; width: calc(100vw - 20px); padding-inline: 14px; }
          .identity-panel { top: 62px; right: 10px; width: min(290px, calc(100vw - 20px)); }
        }
      `
    }

    onPointerMove(event) {
      if (!this.active || this.locked || this.eventTouchesUi(event)) return
      this.pendingPoint = { x: event.clientX, y: event.clientY }
      if (this.frameRequest) return

      this.frameRequest = requestAnimationFrame(() => {
        this.frameRequest = 0
        const point = this.pendingPoint
        const rawTarget = document.elementFromPoint(point.x, point.y)
        if (!(rawTarget instanceof Element) || this.host?.contains(rawTarget)) return
        this.hoveredElement = rawTarget

        const result = this.findCandidates(rawTarget)
        this.candidates = result.candidates
        this.candidateIndex = result.bestIndex
        this.setTarget(this.candidates[this.candidateIndex] || null)
      })
    }

    onClick(event) {
      if (!this.active || this.eventTouchesUi(event)) return
      event.preventDefault()
      event.stopImmediatePropagation()

      if (!this.target || this.locked) return
      this.locked = true
      this.showConfirmation()
    }

    onKeyDown(event) {
      if (!this.active || this.eventTouchesUi(event)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (this.locked) {
          this.locked = false
          this.hideConfirmation()
        } else {
          this.stop()
        }
        return
      }
    }

    onViewportChange() {
      if (this.target) this.positionBox(this.target)
    }

    eventTouchesUi(event) {
      return event.composedPath().includes(this.host)
    }

    findCandidates(rawTarget) {
      const candidates = []
      let current = rawTarget
      let depth = 0

      if (current.matches('a,button,input,select,textarea,svg,path,img,span')) {
        current = current.parentElement
      }

      while (current && current !== document.body && current !== document.documentElement && depth < MAX_ANCESTORS) {
        if (this.isViable(current)) candidates.push(current)
        current = current.parentElement
        depth += 1
      }

      if (candidates.length === 0 && rawTarget.parentElement) {
        candidates.push(rawTarget.parentElement)
      }

      let bestIndex = 0
      let bestScore = -Infinity
      candidates.forEach((candidate, index) => {
        const score = this.scoreCandidate(candidate, index)
        if (score > bestScore) {
          bestScore = score
          bestIndex = index
        }
      })

      return { candidates, bestIndex }
    }

    isViable(element) {
      if (!(element instanceof HTMLElement)) return false
      if (element.matches('html,body,main,nav,header,footer,aside,form,dialog')) return false

      const rect = element.getBoundingClientRect()
      if (rect.width < MIN_WIDTH || rect.height < MIN_HEIGHT) return false
      if (rect.width > window.innerWidth * 0.98 && rect.height > window.innerHeight * 0.72) return false
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return false

      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false

      const meaningfulContent = (element.innerText || '').trim().length >= 12
      return meaningfulContent || Boolean(element.querySelector('img,a,h1,h2,h3,h4'))
    }

    scoreCandidate(element, depthIndex) {
      const rect = element.getBoundingClientRect()
      const viewportArea = window.innerWidth * window.innerHeight
      const areaRatio = (rect.width * rect.height) / Math.max(viewportArea, 1)
      let score = Math.max(0, 4 - depthIndex * 0.22)

      if (element.matches(SEMANTIC_SELECTOR)) score += 8
      if (element.matches(YOUTUBE_VIDEO_UNIT_SELECTOR)) score += 6
      if (element.matches('article,[role="article"],[role="listitem"]')) score += 4
      if (element.matches('[class*="comments-comment-item" i], ytd-comment-thread-renderer, ytd-comment-view-model')) score += 6
      if (element.matches('li,tr')) score += 2
      if (this.hasRepeatedSiblings(element)) score += 7
      if (element.querySelector('h1,h2,h3,h4,[role="heading"]')) score += 1.5
      if (element.querySelector('a[href]')) score += 1
      if (element.querySelector('img,video,picture')) score += 1
      if (areaRatio > 0.6) score -= 12
      else if (areaRatio > 0.35) score -= 5
      if (rect.height < 90) score -= 1

      return score
    }

    hasRepeatedSiblings(element) {
      const parent = element.parentElement
      if (!parent || parent.children.length < 2) return false

      const signature = this.elementSignature(element)
      const rect = element.getBoundingClientRect()
      let similar = 0

      for (const sibling of parent.children) {
        if (!(sibling instanceof HTMLElement)) continue
        if (this.elementSignature(sibling) !== signature) continue
        const siblingRect = sibling.getBoundingClientRect()
        const widthRatio = siblingRect.width / Math.max(rect.width, 1)
        const heightRatio = siblingRect.height / Math.max(rect.height, 1)
        if (widthRatio > 0.55 && widthRatio < 1.8 && heightRatio > 0.45 && heightRatio < 2.2) {
          similar += 1
        }
      }

      return similar >= 2
    }

    elementSignature(element) {
      const classes = [...element.classList]
        .filter((name) => name.length < 48 && !/^(active|hover|selected|focus)/i.test(name))
        .sort()
        .slice(0, 4)
        .join('.')
      return `${element.tagName}:${element.getAttribute('role') || ''}:${classes}`
    }

    setTarget(target) {
      clearTimeout(this.identityRetryTimer)
      if (!target) {
        this.target = null
        this.identityResult = null
        this.boxElement.classList.remove('is-visible')
        return
      }

      const result = this.findIdentity(target)
      this.identityResult = result
      this.renderIdentity(result)

      // Container selection and identity resolution are related signals, not a
      // single gate. Keep a viable content box selectable when identity lookup
      // is uncertain; only expand to a resolved surrounding/page box when one
      // was confidently found.
      this.target = result.status === 'found' && result.container ? result.container : target
      this.positionBox(this.target)
      const description = this.describeTarget(this.target)
      this.labelElement.textContent = `${description.label} · ${description.width}×${description.height}`
      this.boxElement.classList.add('is-visible')

      if (result.status === 'none' && this.isYouTubePage()) {
        this.scheduleIdentityRetry(this.target)
      }
    }

    scheduleIdentityRetry(target) {
      this.identityRetryTimer = setTimeout(() => {
        if (!this.active || this.locked || this.target !== target || !target.isConnected) return

        const result = this.findIdentity(target)
        this.identityResult = result
        this.renderIdentity(result)
        if (result.status === 'found' && result.container) {
          this.target = result.container
          this.positionBox(this.target)
          const description = this.describeTarget(this.target)
          this.labelElement.textContent = `${description.label} · ${description.width}×${description.height}`
        }
      }, 350)
    }

    findIdentity(target) {
      if (!target) return { status: 'none', reason: 'No content box selected' }

      const siteResult = this.findSiteIdentity(target)
      if (siteResult) return siteResult

      const directResult = this.findIdentityInContainer(target)
      if (directResult.status !== 'none') {
        return { ...directResult, scope: 'current', container: target }
      }

      const baseRect = target.getBoundingClientRect()
      const baseArea = Math.max(baseRect.width * baseRect.height, 1)
      let inspected = 0

      for (let index = this.candidateIndex + 1; index < this.candidates.length; index += 1) {
        const surrounding = this.candidates[index]
        const rect = surrounding.getBoundingClientRect()
        const area = rect.width * rect.height
        const areaGrowth = area / baseArea
        const viewportRatio = area / Math.max(window.innerWidth * window.innerHeight, 1)

        if (areaGrowth > MAX_IDENTITY_SCOPE_GROWTH || viewportRatio > 0.68) break
        inspected += 1
        if (inspected > 3) break

        const result = this.findIdentityInContainer(surrounding)
        if (result.status !== 'none') {
          return { ...result, scope: 'surrounding', container: surrounding }
        }
      }

      return { status: 'none', reason: 'No linked seller, author, or commenter found', scope: 'current' }
    }

    findIdentityInContainer(container, acceptsAnchor = null) {
      const anchors = []
      if (container.matches?.('a[href]')) anchors.push(container)
      anchors.push(...container.querySelectorAll('a[href]'))

      const grouped = new Map()
      for (const anchor of anchors.slice(0, 80)) {
        if (acceptsAnchor && !acceptsAnchor(anchor)) continue
        const candidate = this.buildIdentityCandidate(anchor, container)
        if (!candidate || candidate.score < MIN_IDENTITY_SCORE) continue
        const existing = grouped.get(candidate.key)
        if (!existing || candidate.score > existing.score) grouped.set(candidate.key, candidate)
      }

      const candidates = [...grouped.values()].sort((a, b) => b.score - a.score)
      if (candidates.length === 0) return { status: 'none' }

      const top = candidates[0]
      const runnerUp = candidates[1]
      if (runnerUp && top.score - runnerUp.score < 3) {
        return {
          status: 'ambiguous',
          reason: 'Multiple possible people are linked in this box',
          count: candidates.length,
          candidates: candidates.slice(0, 3).map(({ label, type, href, score }) => ({ label, type, href, score })),
        }
      }

      return {
        status: 'found',
        key: top.key,
        label: top.label,
        type: top.type,
        href: top.href,
        score: top.score,
      }
    }

    findSiteIdentity(target) {
      const route = this.getIdentityRoute(location.href)
      const linkedInUnit =
        this.findLinkedInContentUnit(this.hoveredElement) || this.findLinkedInContentUnit(target)
      if (linkedInUnit) return this.findLinkedInUnitIdentity(linkedInUnit)

      const carousellUnit =
        this.findCarousellListingUnit(this.hoveredElement) ||
        this.findCarousellListingUnit(target)
      if (
        carousellUnit &&
        (this.isCarousellPage() || this.hasCarousellSellerLink(carousellUnit))
      ) {
        const sellerResult = this.findIdentityInContainer(
          carousellUnit,
          (anchor) => this.getIdentityRoute(anchor.href)?.site === 'carousell'
        )
        if (sellerResult.status !== 'none') {
          return {
            ...sellerResult,
            scope: 'carousell-listing',
            container: this.findFilterTarget(carousellUnit),
          }
        }
      }

      const etsyUnit =
        this.findEtsyListingUnit(this.hoveredElement) || this.findEtsyListingUnit(target)
      if (
        etsyUnit &&
        (this.isEtsyPage() || etsyUnit.matches('[class*="etsy-listing-card" i], [class*="v2-listing-card" i]'))
      ) {
        const shopIdResult = this.findEtsyShopId(etsyUnit)
        if (shopIdResult.status === 'found') {
          return {
            ...shopIdResult,
            scope: 'etsy-shop-id',
            container: this.findFilterTarget(etsyUnit),
          }
        }

        const linkedResult = this.findIdentityInContainer(etsyUnit)
        if (linkedResult.status !== 'none') {
          return {
            ...linkedResult,
            scope: 'current',
            container: this.findFilterTarget(etsyUnit),
          }
        }
      }

      const isYouTube = this.isYouTubePage()

      if (isYouTube) {
        const videoUnit =
          this.findYouTubeVideoUnit(this.hoveredElement) || this.findYouTubeVideoUnit(target)
        if (videoUnit) {
          if (route?.site === 'youtube') {
            const pageHeader = document.querySelector(
              'yt-page-header-renderer, ytd-c4-tabbed-header-renderer, #page-header'
            )
            if (pageHeader) {
              const pageIdentity = this.buildPageHeaderIdentity(pageHeader, route)
              if (pageIdentity) {
                return { ...pageIdentity, scope: 'page-context', container: videoUnit }
              }
            }
          }

          const result = this.findIdentityInContainer(videoUnit)
          if (result.status !== 'none') {
            return { ...result, scope: 'video-unit', container: videoUnit }
          }
        }

        const channelHeader = target.closest(
          'yt-page-header-renderer, ytd-c4-tabbed-header-renderer, #page-header'
        )
        if (channelHeader && route?.site === 'youtube') {
          return this.buildPageHeaderIdentity(channelHeader, route)
        }

        if (location.pathname === '/watch') {
          const player = target.closest('#movie_player, ytd-player, #player')
          if (player) {
            const owner = document.querySelector(
              'ytd-watch-metadata ytd-video-owner-renderer, #owner ytd-video-owner-renderer'
            )
            if (owner) {
              const result = this.findIdentityInContainer(owner)
              if (result.status === 'found') {
                return { ...result, scope: 'page-context', container: player }
              }
            }
          }
        }
      }

      if (route?.site === 'linkedin') {
        const profileHeader = target.closest(
          'main [data-view-name*="profile" i], main .pv-top-card, main .org-top-card, main > section'
        )
        if (profileHeader?.querySelector('h1,[role="heading"]')) {
          return this.buildPageHeaderIdentity(profileHeader, route)
        }
      }

      return null
    }

    findIdentityForMuteUnit(unit) {
      if (!(unit instanceof Element)) return { status: 'none' }

      const previousHoveredElement = this.hoveredElement
      this.hoveredElement = null
      try {
        const siteResult = this.findSiteIdentity(unit)
        if (siteResult) return siteResult
      } finally {
        this.hoveredElement = previousHoveredElement
      }

      const result = this.findIdentityInContainer(unit)
      return result.status === 'none'
        ? result
        : { ...result, scope: 'current', container: unit }
    }

    findLinkedInContentUnit(target) {
      if (!(target instanceof Element)) return null

      const legacyUnit = target.closest(LINKEDIN_CONTENT_UNIT_SELECTOR)
      if (legacyUnit) return legacyUnit

      const commentUnit = this.findCurrentLinkedInCommentUnit(target)
      if (commentUnit) return commentUnit

      const postUnit = target.closest(LINKEDIN_CURRENT_POST_SELECTOR)
      if (postUnit?.closest(LINKEDIN_CURRENT_FEED_SELECTOR)) return postUnit
      return null
    }

    findCurrentLinkedInCommentUnit(target) {
      const closest = target.closest?.(LINKEDIN_CURRENT_COMMENT_SELECTOR)
      if (!closest) return null

      const key = closest.getAttribute('componentkey')
      let unit = closest
      let current = closest.parentElement
      while (current && !current.matches(LINKEDIN_CURRENT_POST_SELECTOR)) {
        if (current.getAttribute('componentkey') === key) unit = current
        current = current.parentElement
      }
      return unit
    }

    findLinkedInUnitIdentity(unit) {
      const isComment =
        unit.matches(LINKEDIN_COMMENT_UNIT_SELECTOR) ||
        unit.matches(LINKEDIN_CURRENT_COMMENT_SELECTOR)
      const type = isComment ? 'commenter' : 'author'
      const ownerAnchors = this.findLinkedInOwnerAnchors(unit, isComment)
      const result = this.findIdentityInContainer(
        unit,
        (anchor) => ownerAnchors.has(anchor)
      )
      const scope = isComment ? 'linkedin-comment' : 'linkedin-post'

      if (result.status === 'none') {
        return {
          ...result,
          reason: `No linked ${type} found in this ${isComment ? 'comment' : 'post'}`,
          scope,
        }
      }

      const entityType = result.status === 'found' ? result.type : null
      const candidates = result.candidates?.map((candidate) => ({
        ...candidate,
        entityType: candidate.type,
        type,
      }))
      return {
        ...result,
        type,
        entityType,
        relationship: isComment ? 'comment-author' : 'post-author',
        defaultMuteScopes: entityType ? this.getLinkedInDefaultMuteScopes(entityType) : [],
        candidates,
        scope,
        container: unit,
      }
    }

    findLinkedInOwnerAnchors(unit, isComment) {
      const anchors = [...unit.querySelectorAll('a[href]')].filter(
        (anchor) => this.getIdentityRoute(anchor.href)?.site === 'linkedin'
      )
      const semanticAnchors = anchors.filter((anchor) =>
        this.isLinkedInOwnerAnchor(anchor, unit, isComment)
      )
      if (semanticAnchors.length) return new Set(semanticAnchors)

      const grouped = new Map()
      for (const anchor of anchors) {
        if (anchor.closest(LINKEDIN_TEXT_CONTENT_SELECTOR)) continue

        const commentUnit = this.findCurrentLinkedInCommentUnit(anchor)
        if ((isComment && commentUnit !== unit) || (!isComment && commentUnit)) continue

        const route = this.getIdentityRoute(anchor.href)
        const group = grouped.get(route.href) || { anchors: [], hasAvatar: false }
        group.anchors.push(anchor)
        group.hasAvatar ||= Boolean(anchor.querySelector('img,[role="img"]'))
        grouped.set(route.href, group)
      }

      const groups = [...grouped.values()]
      const minimumLinks = isComment ? 2 : 3
      const strongGroups = groups.filter(
        (group) => group.hasAvatar && group.anchors.length >= minimumLinks
      )
      if (strongGroups.length) {
        return new Set(strongGroups.flatMap((group) => group.anchors))
      }

      const avatarGroups = groups
        .filter((group) => group.hasAvatar)
        .sort((a, b) => b.anchors.length - a.anchors.length)
      if (
        avatarGroups.length === 1 ||
        (avatarGroups[0] && avatarGroups[0].anchors.length > avatarGroups[1]?.anchors.length)
      ) {
        return new Set(avatarGroups[0].anchors)
      }

      return new Set()
    }

    getLinkedInDefaultMuteScopes(entityType) {
      const scopes = ['authored-posts', 'authored-comments']
      if (entityType === 'organization') scopes.splice(1, 0, 'jobs')
      return scopes
    }

    isLinkedInOwnerAnchor(anchor, unit, isComment) {
      const route = this.getIdentityRoute(anchor.href)
      if (route?.site !== 'linkedin') return false
      if (anchor.closest(LINKEDIN_CONTENT_UNIT_SELECTOR) !== unit) return false

      const context = this.getIdentityContext(anchor, unit)
      if (SECONDARY_ATTRIBUTION_WORDS.test(context)) return false

      const ownerWords = isComment
        ? LINKEDIN_COMMENT_OWNER_WORDS
        : LINKEDIN_POST_OWNER_WORDS
      return ownerWords.test(context)
    }

    isEtsyPage() {
      const host = location.hostname.replace(/^www\./i, '').toLowerCase()
      return host === 'etsy.com' || host.endsWith('.etsy.com')
    }

    isCarousellPage() {
      const host = location.hostname.replace(/^www\./i, '').toLowerCase()
      return /^(?:[a-z0-9-]+\.)*carousell\.[a-z]{2,3}(?:\.[a-z]{2})?$/i.test(host)
    }

    findCarousellListingUnit(target) {
      if (!(target instanceof Element)) return null

      let current = target
      for (let depth = 0; current && depth <= MAX_FILTER_LAYOUT_ANCESTORS; depth += 1) {
        if (CAROUSELL_LISTING_TEST_ID.test(current.getAttribute('data-testid') || '')) {
          return current
        }
        current = current.parentElement
      }

      const nestedUnits = [...target.querySelectorAll('[data-testid^="listing-card-"]')]
        .filter((element) =>
          CAROUSELL_LISTING_TEST_ID.test(element.getAttribute('data-testid') || '')
        )
      return nestedUnits.length === 1 ? nestedUnits[0] : null
    }

    hasCarousellSellerLink(container) {
      return [...container.querySelectorAll('a[href]')].some(
        (anchor) => this.getIdentityRoute(anchor.href)?.site === 'carousell'
      )
    }

    findEtsyListingUnit(target) {
      if (!(target instanceof Element)) return null
      const closestUnit =
        target.closest('[data-shop-id]') ||
        target.closest('[data-listing-id], [class*="etsy-listing-card" i], [class*="v2-listing-card" i]')
      if (closestUnit) return closestUnit

      const nestedUnits = [...target.querySelectorAll('[data-shop-id]')]
      return nestedUnits.length === 1 ? nestedUnits[0] : null
    }

    findFilterTarget(contentUnit) {
      let current = contentUnit

      for (let depth = 0; depth < MAX_FILTER_LAYOUT_ANCESTORS; depth += 1) {
        const parent = current.parentElement
        if (!parent) break

        const parentDisplay = getComputedStyle(parent).display
        const isLayout = ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(parentDisplay)
        const isRepeatedLayout = isLayout && parent.children.length > 1
        const isListItem = current.matches('li') && parent.matches('ul,ol')
        if (isRepeatedLayout || isListItem) return current

        current = parent
      }

      return contentUnit
    }

    findEtsyShopId(container) {
      const node = container.closest('[data-shop-id]') || container.querySelector('[data-shop-id]')
      const shopId = (node?.getAttribute('data-shop-id') || '').trim()
      if (!/^\d+$/.test(shopId)) return { status: 'none' }

      return {
        status: 'found',
        key: `etsy:shop:${shopId}`,
        label: shopId,
        type: 'seller',
        href: null,
        entityId: shopId,
        entityIdLabel: 'Shop ID',
        shopId,
        score: 30,
      }
    }

    isYouTubePage() {
      const host = location.hostname.replace(/^www\./i, '').toLowerCase()
      return host === 'youtube.com' || host.endsWith('.youtube.com')
    }

    findYouTubeVideoUnit(target) {
      if (!(target instanceof Element)) return null

      const fullUnit = target.closest(
        'ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer'
      )
      return fullUnit || target.closest('yt-lockup-view-model')
    }

    buildPageHeaderIdentity(container, route) {
      const heading = container.querySelector('h1,[role="heading"][aria-level="1"]')
      const label = (heading?.innerText || '').replace(/\s+/g, ' ').trim()
      if (!label || label.length > 90) return null

      return {
        status: 'found',
        key: this.normalizeIdentityKey(route.href, label),
        label,
        type: route.type,
        href: route.href,
        score: 20,
        scope: 'page-header',
        container,
      }
    }

    buildIdentityCandidate(anchor, container) {
      if (!(anchor instanceof HTMLAnchorElement)) return null
      if (anchor.closest('nav,header,footer,[role="navigation"]')) return null

      const rawHref = anchor.getAttribute('href') || ''
      if (!rawHref || /^(javascript:|mailto:|tel:)/i.test(rawHref)) return null

      const href = anchor.href || rawHref
      const context = this.getIdentityContext(anchor, container)
      const identityRoute = this.getIdentityRoute(href)
      const label = this.getIdentityLabel(anchor, identityRoute)
      if (!label || label.length > 90) return null

      let hrefText = href
      try {
        hrefText = decodeURIComponent(href)
      } catch {
        // Keep the browser-normalized URL when a page contains malformed escapes.
      }
      hrefText = hrefText.replace(/[?#].*$/, '')
      const nearbyText = (anchor.parentElement?.innerText || '').trim().slice(0, 180)
      let score = 0

      if (anchor.matches('[rel~="author"], [itemprop="author"]')) score += 12
      if (IDENTITY_WORDS.test(context)) score += 8
      if (PRIMARY_IDENTITY_WORDS.test(context)) score += 10
      if (identityRoute) score += 14
      if (IDENTITY_WORDS.test(hrefText)) score += 6
      if (/\/(?:u|users?|profiles?|members?|authors?|sellers?|shops?|stores?|channels?)\//i.test(hrefText)) score += 5
      if (/(?:^|\/)@[\w.-]+\/?$/i.test(hrefText) || label.startsWith('@')) score += 10
      if (/\b(?:by|from|posted by|sold by|seller|author)\b/i.test(nearbyText)) score += 4
      if (anchor.querySelector('img,[role="img"]') || anchor.previousElementSibling?.matches?.('img,[role="img"]')) score += 2
      if (
        identityRoute?.site === 'linkedin' &&
        (SECONDARY_ATTRIBUTION_WORDS.test(context) ||
          /\b(?:liked|likes|recommended|celebrated|supports) this\b/i.test(nearbyText))
      ) {
        score -= 20
      }
      const nearestUnit = anchor.closest(CONTENT_UNIT_SELECTOR)
      if (nearestUnit && nearestUnit !== container && container.contains(nearestUnit)) score -= 10
      if (NON_IDENTITY_WORDS.test(context) && !IDENTITY_WORDS.test(context)) score -= 8
      if (anchor.querySelector('h1,h2,h3,h4') || anchor.closest('[class*="title" i]')) score -= 7
      if (rawHref.startsWith('#') && !IDENTITY_WORDS.test(context)) score -= 5
      if (/^(more|details?|read more|view|open|share|reply|comments?|save)$/i.test(label)) score -= 10

      const type = identityRoute?.type || this.inferIdentityType(`${context} ${hrefText} ${nearbyText}`)
      const canonicalHref = identityRoute?.href || href
      const key = this.normalizeIdentityKey(canonicalHref, label)
      return { key, label, type, href: canonicalHref, score }
    }

    getIdentityLabel(anchor, identityRoute) {
      const siteLabel = this.getCarousellIdentityLabel(anchor, identityRoute)
      const imageAlt = anchor.querySelector('img[alt]')?.getAttribute('alt') || ''
      const label =
        siteLabel ||
        anchor.getAttribute('aria-label') ||
        anchor.getAttribute('title') ||
        anchor.innerText ||
        imageAlt
      return label
        .replace(/\s+/g, ' ')
        .replace(/^(?:view|visit|open|go to)\s+(?:the\s+)?(?:profile|store|shop|channel)\s+(?:of|for)?\s*/i, '')
        .trim()
    }

    getCarousellIdentityLabel(anchor, identityRoute) {
      if (identityRoute?.site !== 'carousell') return ''

      const sellerName =
        anchor.querySelector('[data-testid="listing-card-text-seller-name"]')?.innerText || ''
      if (sellerName.trim()) return sellerName

      try {
        const segments = new URL(identityRoute.href).pathname.split('/').filter(Boolean)
        return decodeURIComponent(segments[1] || '')
      } catch {
        return ''
      }
    }

    getIdentityContext(anchor, container) {
      const parts = []
      let current = anchor
      let depth = 0
      while (current && current !== container.parentElement && depth < 3) {
        parts.push(
          current.tagName,
          current.id,
          current.className,
          current.getAttribute?.('data-testid'),
          current.getAttribute?.('aria-label'),
          current.getAttribute?.('rel'),
          current.getAttribute?.('itemprop')
        )
        current = current.parentElement
        depth += 1
      }
      return parts.filter((value) => typeof value === 'string').join(' ')
    }

    inferIdentityType(text) {
      if (/seller|vendor|merchant|shop|store/i.test(text)) return 'seller'
      if (/commenter|comment-author|comment author/i.test(text)) return 'commenter'
      if (/channel/i.test(text)) return 'channel'
      if (/author|byline|creator|poster|posted by/i.test(text)) return 'author'
      return 'person'
    }

    getIdentityRoute(href) {
      let url
      try {
        url = new URL(href, location.href)
      } catch {
        return null
      }

      const host = url.hostname.replace(/^www\./i, '').toLowerCase()
      const segments = url.pathname.split('/').filter(Boolean)

      if (
        /^(?:[a-z0-9-]+\.)*carousell\.[a-z]{2,3}(?:\.[a-z]{2})?$/i.test(host) &&
        segments[0] === 'u' &&
        segments[1]
      ) {
        url.pathname = `/u/${segments[1]}`
        url.search = ''
        url.hash = ''
        return { site: 'carousell', type: 'seller', href: url.href }
      }

      if ((host === 'linkedin.com' || host.endsWith('.linkedin.com')) && ['in', 'company', 'school', 'showcase'].includes(segments[0])) {
        if (!segments[1]) return null
        url.pathname = `/${segments[0]}/${segments[1]}`
        url.search = ''
        url.hash = ''
        return {
          site: 'linkedin',
          type: segments[0] === 'in' ? 'person' : 'organization',
          href: url.href,
        }
      }

      if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        const first = segments[0] || ''
        const isChannelRoute =
          first.startsWith('@') ||
          (['channel', 'c', 'user'].includes(first) && Boolean(segments[1]))
        if (!isChannelRoute) return null
        url.pathname = first.startsWith('@') ? `/${first}` : `/${first}/${segments[1]}`
        url.search = ''
        url.hash = ''
        return { site: 'youtube', type: 'channel', href: url.href }
      }

      return null
    }

    normalizeIdentityKey(href, label) {
      try {
        const url = new URL(href, location.href)
        if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, '')
        return url.href
      } catch {
        return `${href}|${label.toLowerCase()}`
      }
    }

    countNestedContentUnits(container) {
      const matches = [...container.querySelectorAll(CONTENT_UNIT_SELECTOR)].filter(
        (element) => element !== container && this.isViable(element)
      )
      const topLevel = matches.filter(
        (element) => !matches.some((other) => other !== element && other.contains(element))
      )
      return topLevel.length
    }

    renderIdentity(result) {
      const state = result?.status || 'none'
      this.identityStateElement.dataset.status = state
      this.renderIdentityTarget(state === 'found' ? result : null)

      if (state === 'found') {
        const typeLabel = result.type[0].toUpperCase() + result.type.slice(1)
        const sources = {
          surrounding: 'found in surrounding box',
          'etsy-shop-id': 'shop ID on this listing',
          'video-unit': 'linked in this video box',
          'page-context': 'linked beside this content',
          'page-header': 'identified from this profile page',
          'linkedin-post': 'posted this LinkedIn post',
          'linkedin-comment': 'wrote this LinkedIn comment',
        }
        const source = sources[result.scope] || 'linked in this box'
        this.identityStateElement.querySelector('.identity-icon').textContent = '✓'
        this.identityTitleElement.textContent = `${typeLabel} · ${result.label}`
        this.identityDetailElement.textContent = source
        return
      }

      if (state === 'ambiguous') {
        const labels = (result.candidates || [])
          .map((candidate) => candidate.label)
          .filter(Boolean)
        this.identityStateElement.querySelector('.identity-icon').textContent = '!'
        this.identityTitleElement.textContent = labels.length
          ? labels.join(' · ')
          : 'Multiple possible people'
        this.identityDetailElement.textContent = result.count
          ? `${result.count} detected in this box`
          : result.reason
        return
      }

      this.identityStateElement.querySelector('.identity-icon').textContent = '—'
      this.identityTitleElement.textContent = 'No linked person found'
      this.identityDetailElement.textContent = result.reason || 'Try a nearby or larger content box'
    }

    renderIdentityTarget(result) {
      const target = this.getIdentityTarget(result)
      this.identityTargetRowElement.hidden = !target
      this.identityTargetLabelElement.textContent = target?.label || ''
      this.identityTargetValueElement.textContent = target?.value || ''
      this.identityTargetValueElement.title = target?.value || ''
      this.identityTargetValueElement.classList.toggle('is-link', Boolean(target?.href))

      if (target?.href) {
        this.identityTargetValueElement.href = target.href
      } else {
        this.identityTargetValueElement.removeAttribute('href')
      }
    }

    getIdentityTarget(result) {
      if (!result) return null

      try {
        const url = new URL(result.href)
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return { label: 'Profile link', value: url.href, href: url.href }
        }
      } catch {
        // Fall through to a stable identifier when this identity has no URL.
      }

      const entityId = String(result.entityId ?? '').trim()
      if (!entityId) return null
      return {
        label: result.entityIdLabel || 'Identity ID',
        value: entityId,
      }
    }

    positionBox(target) {
      const rect = target.getBoundingClientRect()
      Object.assign(this.boxElement.style, {
        top: `${Math.max(0, rect.top)}px`,
        left: `${Math.max(0, rect.left)}px`,
        width: `${Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(0, rect.left))}px`,
        height: `${Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(0, rect.top))}px`,
      })
      this.labelElement.style.bottom = rect.top < 42 ? 'auto' : 'calc(100% + 8px)'
      this.labelElement.style.top = rect.top < 42 ? 'calc(100% + 8px)' : 'auto'
    }

    describeTarget(target) {
      if (!target) return { label: 'Unknown box', width: 0, height: 0 }
      const rect = target.getBoundingClientRect()
      const semanticLabel =
        target.getAttribute('aria-label') ||
        target.getAttribute('role') ||
        target.tagName.toLowerCase()
      const classHint = [...target.classList].find((name) => /card|listing|product|result|tile|post/i.test(name))
      return {
        label: classHint ? `${semanticLabel}.${classHint}` : semanticLabel,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        tagName: target.tagName.toLowerCase(),
        role: target.getAttribute('role'),
        classHint: classHint || null,
        origin: location.origin,
      }
    }

    showConfirmation() {
      const result = this.identityResult
      const kicker = this.confirmationElement.querySelector('.confirmation-kicker')
      const heading = this.confirmationElement.querySelector('h2')
      const copy = this.confirmationElement.querySelector('.confirmation-copy')
      const primary = this.confirmationElement.querySelector('.primary')

      primary.disabled = result?.status !== 'found'
      if (result?.status === 'found') {
        kicker.textContent = 'Profile detected'
        heading.textContent = `Mute ${result.label}?`
        copy.textContent = 'Matching content from this profile will be hidden on this site.'
        primary.textContent = 'Mute profile'
      } else {
        kicker.textContent = 'Identity needed'
        heading.textContent = result?.status === 'ambiguous' ? 'Choose a clearer box' : 'No profile detected'
        copy.textContent = result?.status === 'ambiguous'
          ? 'This box contains multiple possible profiles, so it cannot be muted safely.'
          : 'Try a nearby box that contains a linked seller, author, creator, or commenter.'
        primary.textContent = 'Mute profile'
      }

      const rect = this.target.getBoundingClientRect()
      const panelWidth = 330
      const panelHeight = 174
      let left = Math.min(rect.right + 12, window.innerWidth - panelWidth - 14)
      if (left < 14 || left < rect.left) left = Math.max(14, rect.left)
      let top = rect.top
      if (top + panelHeight > window.innerHeight - 14) top = window.innerHeight - panelHeight - 14
      top = Math.max(14, top)

      Object.assign(this.confirmationElement.style, { left: `${left}px`, top: `${top}px` })
      this.confirmationElement.classList.add('is-visible')
      const focusTarget = primary.disabled
        ? this.confirmationElement.querySelector('.secondary')
        : primary
      focusTarget.focus()
    }

    hideConfirmation() {
      this.confirmationElement?.classList.remove('is-visible')
      this.helpElement?.classList.add('is-visible')
    }

    showToast(message) {
      this.boxElement?.classList.remove('is-visible')
      this.confirmationElement?.classList.remove('is-visible')
      this.helpElement?.classList.remove('is-visible')
      this.toastElement.textContent = message
      this.toastElement.classList.add('is-visible')
    }
  }

  class MutingEngine {
    constructor(controller, store) {
      this.controller = controller
      this.store = store
      this.siteKey = getSiteKey()
      this.mutedStorageKey = getMutedStorageKey(this.siteKey)
      this.enabled = true
      this.profiles = []
      this.blockedKeywords = []
      this.scanTimer = 0
      this.observer = null
      this.ready = Promise.resolve()
    }

    async init() {
      let state = {}
      try {
        state = await this.store.get([
          ENABLED_STORAGE_KEY,
          this.mutedStorageKey,
          SITE_FILTERS_STORAGE_KEY,
        ])
      } catch {
        // Default to enabled with an empty site set if extension storage is unavailable.
      }
      this.enabled = state[ENABLED_STORAGE_KEY] !== false
      this.profiles = Array.isArray(state[this.mutedStorageKey])
        ? state[this.mutedStorageKey]
        : []
      this.blockedKeywords = getBlockedKeywords(state[SITE_FILTERS_STORAGE_KEY], this.siteKey)

      this.ensureHiddenStyle()
      this.store.onChanged((changes) => this.handleStorageChange(changes))
      this.observer = new MutationObserver((mutations) => {
        if (!this.enabled || (!this.profiles.length && !this.blockedKeywords.length)) return
        if (mutations.some((mutation) => mutation.addedNodes.length)) this.scheduleScan()
      })
      this.observer.observe(document.documentElement, { childList: true, subtree: true })
      this.applyState()
    }

    ensureHiddenStyle() {
      if (document.getElementById(HIDDEN_STYLE_ID)) return
      const style = document.createElement('style')
      style.id = HIDDEN_STYLE_ID
      style.textContent = `[${HIDDEN_ATTRIBUTE}] { display: none !important; }`
      const styleParent = document.head || document.documentElement
      styleParent.append(style)
    }

    async addIdentity(identity) {
      await this.ready
      const key = this.getIdentityKey(identity)
      if (!key) throw new Error('Identity has no stable key')

      const existing = this.profiles.some((profile) => profile.key === key)
      if (existing) {
        this.applyState()
        return { added: false }
      }

      const profile = {
        key,
        label: String(identity.label || 'Unknown profile').slice(0, 90),
        type: String(identity.entityType || identity.type || 'person').slice(0, 32),
        href: identity.href || null,
        entityId: identity.entityId || null,
        mutedAt: new Date().toISOString(),
      }
      this.profiles = [...this.profiles, profile]
      await this.store.set({ [this.mutedStorageKey]: this.profiles })
      this.applyState()
      return { added: true, profile }
    }

    async setEnabled(enabled) {
      await this.ready
      this.enabled = Boolean(enabled)
      await this.store.set({ [ENABLED_STORAGE_KEY]: this.enabled })
      this.applyState()
    }

    async setBlockedKeywords(keywords) {
      await this.ready
      const blockedKeywords = normalizeBlockedKeywords(keywords)
      const state = await this.store.get([SITE_FILTERS_STORAGE_KEY])
      const siteFilters = { ...(state[SITE_FILTERS_STORAGE_KEY] || {}) }

      if (blockedKeywords.length) {
        siteFilters[this.siteKey] = {
          ...(siteFilters[this.siteKey] || {}),
          blockedKeywords,
        }
      } else {
        delete siteFilters[this.siteKey]
      }

      this.blockedKeywords = blockedKeywords
      await this.store.set({ [SITE_FILTERS_STORAGE_KEY]: siteFilters })
      this.applyState()
    }

    getIdentityKey(identity) {
      if (identity?.key) return identity.key
      if (identity?.href) {
        return this.controller.normalizeIdentityKey(identity.href, identity.label || '')
      }
      const entityId = String(identity?.entityId ?? '').trim()
      return entityId ? `${this.siteKey}:${identity.type || 'entity'}:${entityId}` : ''
    }

    handleStorageChange(changes) {
      let changed = false
      if (changes[ENABLED_STORAGE_KEY]) {
        this.enabled = changes[ENABLED_STORAGE_KEY].newValue !== false
        changed = true
      }
      if (changes[this.mutedStorageKey]) {
        const nextProfiles = changes[this.mutedStorageKey].newValue
        this.profiles = Array.isArray(nextProfiles) ? nextProfiles : []
        changed = true
      }
      if (changes[SITE_FILTERS_STORAGE_KEY]) {
        this.blockedKeywords = getBlockedKeywords(
          changes[SITE_FILTERS_STORAGE_KEY].newValue,
          this.siteKey
        )
        changed = true
      }
      if (changed) this.applyState()
    }

    applyState() {
      clearTimeout(this.scanTimer)
      this.scanTimer = 0
      if (!this.enabled || (!this.profiles.length && !this.blockedKeywords.length)) {
        this.revealAll()
        return
      }
      this.scan()
    }

    scheduleScan() {
      if (this.scanTimer) return
      this.scanTimer = setTimeout(() => {
        this.scanTimer = 0
        this.scan()
      }, 120)
    }

    scan() {
      if (!this.enabled || (!this.profiles.length && !this.blockedKeywords.length)) return

      const mutedKeys = new Set(this.profiles.map((profile) => profile.key))
      const units = [...document.querySelectorAll(CONTENT_UNIT_SELECTOR)]
      const hiddenTargets = new Set()
      const checkedTargets = new Set(document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`))
      for (const unit of units) {
        if (!(unit instanceof HTMLElement) || unit.closest(`#${UI_TAG}`)) continue
        checkedTargets.add(unit)
        const filterTarget = this.controller.findFilterTarget(unit)
        checkedTargets.add(filterTarget)

        if (this.blockedKeywords.length) {
          const visibleText = (unit.innerText || '').toLowerCase()
          if (this.blockedKeywords.some((keyword) => visibleText.includes(keyword))) {
            hiddenTargets.add(filterTarget)
          }
        }

        if (mutedKeys.size) {
          const result = this.controller.findIdentityForMuteUnit(unit)
          const key = result.status === 'found' ? this.getIdentityKey(result) : ''
          const contentTarget = result.container instanceof HTMLElement ? result.container : unit
          const target = this.controller.findFilterTarget(contentTarget)
          checkedTargets.add(target)
          if (key && mutedKeys.has(key)) hiddenTargets.add(target)
        }
      }

      for (const target of checkedTargets) {
        target.toggleAttribute(HIDDEN_ATTRIBUTE, hiddenTargets.has(target))
      }
    }

    revealAll() {
      for (const unit of document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`)) {
        unit.removeAttribute(HIDDEN_ATTRIBUTE)
      }
    }
  }

  const stateStore = new ExtensionStateStore()
  const controller = new ContainerSelector()
  const mutingEngine = new MutingEngine(controller, stateStore)
  globalThis.__muteByEntitySelector = controller
  globalThis.__muteByEntityMuting = mutingEngine
  mutingEngine.ready = mutingEngine.init()

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'mute-by-entity:start-selection') {
        controller.start()
        sendResponse({ ok: true })
      }
    })
  }
})()
