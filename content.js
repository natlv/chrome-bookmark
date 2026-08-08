(() => {
  if (globalThis.__muteByEntitySelectorInstalled) return
  globalThis.__muteByEntitySelectorInstalled = true

  const UI_TAG = 'mute-by-entity-selector-ui'
  const MIN_WIDTH = 150
  const MIN_HEIGHT = 64
  const MAX_ANCESTORS = 12
  const SEMANTIC_SELECTOR = [
    'article',
    '[role="article"]',
    '[role="listitem"]',
    'li',
    'tr',
    '[data-card]',
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
  ].join(',')

  class ContainerSelector {
    constructor() {
      this.active = false
      this.locked = false
      this.candidates = []
      this.candidateIndex = -1
      this.target = null
      this.frameRequest = 0
      this.pendingPoint = null

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
      this.candidates = []
      this.candidateIndex = -1
      document.removeEventListener('pointermove', this.onPointerMove, true)
      document.removeEventListener('click', this.onClick, true)
      document.removeEventListener('keydown', this.onKeyDown, true)
      window.removeEventListener('scroll', this.onViewportChange, true)
      window.removeEventListener('resize', this.onViewportChange, true)
      cancelAnimationFrame(this.frameRequest)

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
        <div class="help" role="status">
          <span class="live-dot"></span>
          <strong>Choose a content box</strong>
          <span>Move over a listing or post</span>
          <span class="keys"><kbd>↑</kbd><kbd>↓</kbd> adjust <kbd>Esc</kbd> cancel</span>
        </div>
        <section class="confirmation" role="dialog" aria-label="Confirm selected content box">
          <p class="confirmation-kicker">Container selected</p>
          <h2>Use this box?</h2>
          <p class="confirmation-copy">This only confirms the UI boundary. Nothing will be muted or saved yet.</p>
          <div class="confirmation-actions">
            <button class="secondary" type="button">Keep looking</button>
            <button class="primary" type="button">Select box</button>
          </div>
        </section>
        <div class="toast" role="status" aria-live="polite"></div>
      `
      document.documentElement.append(this.host)

      this.boxElement = this.shadow.querySelector('.selection-box')
      this.labelElement = this.shadow.querySelector('.box-label')
      this.helpElement = this.shadow.querySelector('.help')
      this.confirmationElement = this.shadow.querySelector('.confirmation')
      this.toastElement = this.shadow.querySelector('.toast')

      this.shadow.querySelector('.secondary').addEventListener('click', () => {
        this.locked = false
        this.hideConfirmation()
      })
      this.shadow.querySelector('.primary').addEventListener('click', () => {
        const selected = this.describeTarget(this.target)
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
        :host { all: initial; }
        * { box-sizing: border-box; }
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
          font: 700 11px/1.2 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: .01em;
        }
        .help, .confirmation, .toast {
          color: #1e292e; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .help {
          position: fixed; z-index: 2147483647; left: 50%; bottom: 22px;
          display: flex; align-items: center; gap: 9px; max-width: calc(100vw - 32px);
          padding: 10px 13px; border: 1px solid rgb(255 255 255 / 65%); border-radius: 13px;
          opacity: 0; color: #edf1ef; background: rgb(32 44 50 / 96%);
          box-shadow: 0 14px 38px rgb(20 31 36 / 28%); pointer-events: none;
          transform: translate(-50%, 12px); transition: opacity 160ms ease, transform 160ms ease;
          font: 12px/1.3 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          backdrop-filter: blur(12px);
        }
        .help.is-visible { opacity: 1; transform: translate(-50%, 0); }
        .help strong { white-space: nowrap; }
        .help > span:not(.live-dot):not(.keys) { color: #b9c1c0; white-space: nowrap; }
        .live-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: #f06a4b; box-shadow: 0 0 0 4px rgb(240 106 75 / 17%); }
        .keys { display: flex; align-items: center; gap: 4px; margin-left: 4px; color: #b9c1c0; white-space: nowrap; }
        kbd { min-width: 21px; padding: 2px 5px; border: 1px solid #667176; border-bottom-width: 2px; border-radius: 5px; color: #f8faf7; text-align: center; font: 700 10px/1.2 inherit; background: #35434a; }
        .confirmation {
          position: fixed; z-index: 2147483647; display: none; width: min(330px, calc(100vw - 28px));
          padding: 17px; border: 1px solid #ded9cf; border-radius: 16px; background: #fffdf8;
          box-shadow: 0 18px 52px rgb(24 33 38 / 26%); pointer-events: auto;
        }
        .confirmation.is-visible { display: block; animation: arrive 150ms ease-out; }
        @keyframes arrive { from { opacity: 0; transform: translateY(5px) scale(.985); } }
        .confirmation-kicker { margin: 0 0 4px; color: #c65338; font: 750 10px/1.2 inherit; letter-spacing: .1em; text-transform: uppercase; }
        .confirmation h2 { margin: 0; color: #1e292e; font: 750 18px/1.25 inherit; letter-spacing: -.02em; }
        .confirmation-copy { margin: 7px 0 15px; color: #647073; font: 12px/1.5 inherit; }
        .confirmation-actions { display: flex; justify-content: flex-end; gap: 8px; }
        button { padding: 8px 11px; border-radius: 9px; cursor: pointer; font: 700 11px/1 inherit; }
        button:focus-visible { outline: 3px solid rgb(240 106 75 / 25%); outline-offset: 2px; }
        button.secondary { border: 1px solid #d8d3ca; color: #596467; background: #fffdf9; }
        button.primary { border: 1px solid #202c32; color: #fffdf9; background: #202c32; }
        button:hover { filter: brightness(.97); }
        .toast {
          position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; display: none;
          padding: 11px 15px; border-radius: 12px; color: #f7fff9; background: #287456;
          box-shadow: 0 13px 35px rgb(23 78 57 / 24%); transform: translateX(-50%);
          font: 700 12px/1.3 inherit;
        }
        .toast.is-visible { display: block; animation: toast-in 170ms ease-out; }
        @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px); } }
        @media (max-width: 680px) {
          .help > span:not(.live-dot):not(.keys) { display: none; }
          .keys { margin-left: 0; }
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
      if (element.matches('article,[role="article"],[role="listitem"]')) score += 4
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
      this.target = target
      if (!target) {
        this.boxElement.classList.remove('is-visible')
        return
      }

      this.positionBox(target)
      const description = this.describeTarget(target)
      const level = this.candidates.length > 1 ? ` · ${this.candidateIndex + 1}/${this.candidates.length}` : ''
      this.labelElement.textContent = `${description.label} · ${description.width}×${description.height}${level}`
      this.boxElement.classList.add('is-visible')
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
