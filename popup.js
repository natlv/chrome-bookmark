const startButton = document.querySelector('#start-selection')
const statusElement = document.querySelector('#status')
const enabledInput = document.querySelector('#extension-enabled')
const filteringStatus = document.querySelector('#filtering-status')
const mutedList = document.querySelector('#muted-list')
const mutedCount = document.querySelector('#muted-count')
const mutedEmpty = document.querySelector('#muted-empty')
const siteName = document.querySelector('#site-name')

const ENABLED_STORAGE_KEY = 'muteByEntityEnabled'
const MUTED_STORAGE_PREFIX = 'muteByEntityMuted:'
const storageArea = globalThis.chrome?.storage?.local
const storageEvents = globalThis.chrome?.storage?.onChanged

let currentSiteKey = ''
let mutedStorageKey = ''
let profiles = []

function setStatus(message) {
  statusElement.textContent = message
}

function isSelectablePage(url = '') {
  return /^https?:\/\//.test(url) || /^file:\/\//.test(url)
}

function getSiteKey(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function renderEnabled(enabled) {
  enabledInput.checked = enabled
  filteringStatus.textContent = enabled
    ? 'On · matching content is hidden'
    : 'Off · muted profiles remain saved'
  document.body.classList.toggle('filtering-off', !enabled)
}

function renderStorageUnavailable() {
  enabledInput.checked = false
  enabledInput.disabled = true
  startButton.disabled = true
  filteringStatus.textContent = 'Storage unavailable · reload extension'
  document.body.classList.add('filtering-off')
  setStatus('Reload Mute by Entity on chrome://extensions, then refresh this website tab.')
}

function renderProfiles() {
  mutedList.replaceChildren()
  mutedCount.textContent = String(profiles.length)
  mutedEmpty.hidden = profiles.length > 0

  for (const profile of profiles) {
    const item = document.createElement('li')
    item.className = 'muted-profile'

    const icon = document.createElement('span')
    icon.className = 'profile-icon'
    icon.textContent = (profile.label || '?').trim().charAt(0).toUpperCase() || '?'
    icon.setAttribute('aria-hidden', 'true')

    const copy = document.createElement('div')
    copy.className = 'profile-copy'
    const label = document.createElement('strong')
    label.textContent = profile.label || 'Unknown profile'
    const type = document.createElement('small')
    type.textContent = profile.type || 'profile'
    copy.append(label, type)

    const removeButton = document.createElement('button')
    removeButton.className = 'remove-profile'
    removeButton.type = 'button'
    removeButton.textContent = 'Unmute'
    removeButton.setAttribute('aria-label', `Unmute ${profile.label || 'profile'}`)
    removeButton.addEventListener('click', () => removeProfile(profile.key, removeButton))

    item.append(icon, copy, removeButton)
    mutedList.append(item)
  }
}

async function removeProfile(key, button) {
  button.disabled = true
  const nextProfiles = profiles.filter((profile) => profile.key !== key)
  try {
    if (!storageArea) throw new Error('Extension storage is unavailable')
    await storageArea.set({ [mutedStorageKey]: nextProfiles })
    profiles = nextProfiles
    renderProfiles()
  } catch {
    setStatus('Could not update the muted list.')
    button.disabled = false
  }
}

async function loadState() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  currentSiteKey = getSiteKey(tab?.url)
  mutedStorageKey = `${MUTED_STORAGE_PREFIX}${currentSiteKey}`
  siteName.textContent = currentSiteKey || 'Unavailable on this page'

  if (!storageArea) {
    renderStorageUnavailable()
    return
  }

  const keys = currentSiteKey
    ? [ENABLED_STORAGE_KEY, mutedStorageKey]
    : [ENABLED_STORAGE_KEY]
  const state = await storageArea.get(keys)
  renderEnabled(state[ENABLED_STORAGE_KEY] !== false)
  profiles = Array.isArray(state[mutedStorageKey]) ? state[mutedStorageKey] : []
  renderProfiles()
}

async function startSelection() {
  startButton.disabled = true
  setStatus('')

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })

    if (!tab?.id || !isSelectablePage(tab.url)) {
      throw new Error('Open a normal webpage, then try again.')
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    })

    await chrome.tabs.sendMessage(tab.id, {
      type: 'mute-by-entity:start-selection',
    })

    window.close()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message.includes('Cannot access') ? 'Chrome does not allow extensions on this page.' : message)
    startButton.disabled = false
  }
}

startButton.addEventListener('click', startSelection)
enabledInput.addEventListener('change', async () => {
  const enabled = enabledInput.checked
  enabledInput.disabled = true
  try {
    if (!storageArea) throw new Error('Extension storage is unavailable')
    await storageArea.set({ [ENABLED_STORAGE_KEY]: enabled })
    renderEnabled(enabled)
  } catch {
    renderEnabled(!enabled)
    setStatus('Could not update automatic muting.')
  } finally {
    enabledInput.disabled = false
  }
})

if (storageEvents) {
  storageEvents.addListener((changes, areaName) => {
    if (areaName !== 'local') return
    if (changes[ENABLED_STORAGE_KEY]) {
      renderEnabled(changes[ENABLED_STORAGE_KEY].newValue !== false)
    }
    if (mutedStorageKey && changes[mutedStorageKey]) {
      const nextProfiles = changes[mutedStorageKey].newValue
      profiles = Array.isArray(nextProfiles) ? nextProfiles : []
      renderProfiles()
    }
  })
}

loadState().catch(() => {
  if (!storageArea) {
    renderStorageUnavailable()
    return
  }
  setStatus('Could not load extension settings. Try reloading the extension.')
  renderEnabled(false)
})
