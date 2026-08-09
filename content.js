(() => {
  if (globalThis.__muteByEntitySelectorInstalled) return
  globalThis.__muteByEntitySelectorInstalled = true

  const UI_TAG = 'mute-by-entity-selector-ui'
  const MIN_WIDTH = 150
  const MIN_HEIGHT = 64
  const MAX_ANCESTORS = 18
  const MIN_IDENTITY_SCORE = 7
  const MAX_IDENTITY_SCOPE_GROWTH = 8
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
          <span class="live-dot"></span>
          <strong>Choose a content box</strong>
          <span>Move over a listing or post</span>
          <span class="keys"><kbd>↑</kbd><kbd>↓</kbd><span class="key-label">adjust</span><kbd>Esc</kbd><span class="key-label">exit</span></span>
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
            </div>
          </div>
        </aside>
        <section class="confirmation selector-type selector-panel" role="dialog" aria-label="Confirm selected content box">
          <p class="confirmation-kicker">Container selected</p>
          <h2>Use this box?</h2>
          <p class="confirmation-copy">This only confirms the UI boundary. Nothing will be muted or saved yet.</p>
          <div class="confirmation-actions">
            <button class="secondary" type="button">Keep looking</button>
            <button class="primary" type="button">Select box</button>
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

      this.shadow.querySelector('.exit-button').addEventListener('click', () => {
        this.stop()
      })

      this.shadow.querySelector('.secondary').addEventListener('click', () => {
        this.locked = false
        this.hideConfirmation()
      })
      this.shadow.querySelector('.primary').addEventListener('click', () => {
        const { container: _container, ...identity } = this.identityResult || {}
        const selected = {
          ...this.describeTarget(this.target),
          identity,
        }
        globalThis.dispatchEvent(
          new CustomEvent('mute-by-entity:container-selected', { detail: selected })
        )
        this.stop('Box selected — ready for the next milestone')
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
          position: fixed; z-index: 2147483647; left: 50%; bottom: 22px;
          display: flex; align-items: center; gap: 9px; max-width: calc(100vw - 32px);
          overflow: hidden;
          padding: 10px 13px; border: 1px solid rgb(255 255 255 / 65%); border-radius: 13px;
          opacity: 0; color: #edf1ef; background: rgb(32 44 50 / 96%);
          box-shadow: 0 14px 38px rgb(20 31 36 / 28%); pointer-events: none;
          transform: translate(-50%, 12px); transition: opacity 160ms ease, transform 160ms ease;
          line-height: 1.3;
          backdrop-filter: blur(12px);
        }
        .help.is-visible { opacity: 1; transform: translate(-50%, 0); }
        .help strong { white-space: nowrap; }
        .help > span:not(.live-dot):not(.keys) { color: #b9c1c0; white-space: nowrap; }
        .live-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: #f06a4b; box-shadow: 0 0 0 4px rgb(240 106 75 / 17%); }
        .keys { display: flex; align-items: center; gap: 4px; margin-left: 4px; color: #b9c1c0; white-space: nowrap; }
        kbd { min-width: 21px; padding: 2px 5px; border: 1px solid #667176; border-bottom-width: 2px; border-radius: 5px; color: #f8faf7; text-align: center; font-size: var(--selector-text-xs); font-weight: 700; line-height: 1.2; background: #35434a; }
        .identity-panel {
          position: fixed; z-index: 2147483647; top: 16px; right: 16px; width: min(310px, calc(100vw - 32px));
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
        .confirmation h2 { margin: 0; color: #1e292e; font-size: 18px; font-weight: 750; line-height: 1.25; letter-spacing: -.02em; }
        .confirmation-copy { margin: 7px 0 15px; overflow-wrap: anywhere; color: #647073; font-size: var(--selector-text-md); line-height: 1.5; }
        .confirmation-actions { display: flex; justify-content: flex-end; gap: 8px; }
        button { padding: 8px 11px; border-radius: 9px; cursor: pointer; font-size: var(--selector-text-sm); font-weight: 700; line-height: 1; }
        button:focus-visible { outline: 3px solid rgb(240 106 75 / 25%); outline-offset: 2px; }
        button.secondary { border: 1px solid #d8d3ca; color: #596467; background: #fffdf9; }
        button.primary { border: 1px solid #202c32; color: #fffdf9; background: #202c32; }
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
          .help > span:not(.live-dot):not(.keys) { display: none; }
          .keys { margin-left: 0; }
          .identity-panel { top: 10px; right: 10px; width: min(290px, calc(100vw - 20px)); }
        }
        @media (max-width: 400px) {
          .key-label { display: none; }
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
      this.helpElement.classList.remove('is-visible')
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

      if (this.locked) return
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

      event.preventDefault()
      event.stopImmediatePropagation()
      const step = event.key === 'ArrowUp' ? 1 : -1
      const nextIndex = Math.max(0, Math.min(this.candidates.length - 1, this.candidateIndex + step))
      if (nextIndex !== this.candidateIndex) {
        this.candidateIndex = nextIndex
        this.setTarget(this.candidates[this.candidateIndex])
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
      const level = this.candidates.length > 1 ? ` · ${this.candidateIndex + 1}/${this.candidates.length}` : ''
      this.labelElement.textContent = `${description.label} · ${description.width}×${description.height}${level}`
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
          const level = this.candidates.length > 1 ? ` · ${this.candidateIndex + 1}/${this.candidates.length}` : ''
          this.labelElement.textContent = `${description.label} · ${description.width}×${description.height}${level}`
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

    findIdentityInContainer(container) {
      const anchors = []
      if (container.matches?.('a[href]')) anchors.push(container)
      anchors.push(...container.querySelectorAll('a[href]'))

      const grouped = new Map()
      for (const anchor of anchors.slice(0, 80)) {
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
        label: top.label,
        type: top.type,
        href: top.href,
        score: top.score,
      }
    }

    findSiteIdentity(target) {
      const route = this.getIdentityRoute(location.href)
      const etsyUnit =
        this.findEtsyListingUnit(this.hoveredElement) || this.findEtsyListingUnit(target)
      if (
        etsyUnit &&
        (this.isEtsyPage() || etsyUnit.matches('[class*="etsy-listing-card" i], [class*="v2-listing-card" i]'))
      ) {
        const shopIdResult = this.findEtsyShopId(etsyUnit)
        if (shopIdResult.status === 'found') {
          return { ...shopIdResult, scope: 'etsy-shop-id', container: etsyUnit }
        }

        const linkedResult = this.findIdentityInContainer(etsyUnit)
        if (linkedResult.status !== 'none') {
          return { ...linkedResult, scope: 'current', container: etsyUnit }
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

    isEtsyPage() {
      const host = location.hostname.replace(/^www\./i, '').toLowerCase()
      return host === 'etsy.com' || host.endsWith('.etsy.com')
    }

    findEtsyListingUnit(target) {
      if (!(target instanceof Element)) return null
      return (
        target.closest('[data-shop-id]') ||
        target.closest('[data-listing-id], [class*="etsy-listing-card" i], [class*="v2-listing-card" i]')
      )
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
        url.hash = ''
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

      if (state === 'found') {
        const typeLabel = result.type[0].toUpperCase() + result.type.slice(1)
        const sources = {
          surrounding: 'found in surrounding box',
          'etsy-shop-id': 'shop ID on this listing',
          'video-unit': 'linked in this video box',
          'page-context': 'linked beside this content',
          'page-header': 'identified from this profile page',
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
      this.confirmationElement.querySelector('.primary').focus()
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

  const controller = new ContainerSelector()
  globalThis.__muteByEntitySelector = controller

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'mute-by-entity:start-selection') {
        controller.start()
        sendResponse({ ok: true })
      }
    })
  }
})()
