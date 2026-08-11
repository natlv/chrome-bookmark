const startButton = document.querySelector('#start-selection')
const statusElement = document.querySelector('#status')
const enabledButton = document.querySelector('#extension-enabled')
const filteringLabel = enabledButton.querySelector('.filtering-label')
const mutedList = document.querySelector('#muted-list')
const mutedSummary = document.querySelector('#muted-summary')
const mutedEmpty = document.querySelector('#muted-empty')
const openSettingsButton = document.querySelector('#open-settings')
const keywordForm = document.querySelector('#keyword-form')
const keywordInput = document.querySelector('#keyword-input')
const keywordList = document.querySelector('#keyword-list')
const keywordEmpty = document.querySelector('#keyword-empty')

const ENABLED_STORAGE_KEY = 'muteByEntityEnabled'
const MUTED_STORAGE_PREFIX = 'muteByEntityMuted:'
const SITE_FILTERS_STORAGE_KEY = 'siteFilters'
const storageArea = globalThis.chrome?.storage?.local
const storageEvents = globalThis.chrome?.storage?.onChanged

let currentSiteKey = ''
let mutedStorageKey = ''
let profiles = []
let blockedKeywords = []

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
  enabledButton.dataset.enabled = String(enabled)
  filteringLabel.textContent = enabled ? 'Pause on this site' : 'Unpause Mute Anyone'
}

function renderStorageUnavailable() {
  renderEnabled(false)
  enabledButton.disabled = true
  startButton.disabled = true
  keywordInput.disabled = true
  keywordForm.querySelector('button').disabled = true
  setStatus('Reload Mute Anyone on chrome://extensions, then refresh this website tab.')
}

function renderProfiles() {
  mutedList.replaceChildren()
  const profileLabel = profiles.length === 1 ? 'profile' : 'profiles'
  mutedSummary.textContent = `${profiles.length} ${profileLabel} muted on ${currentSiteKey || 'this site'}`
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

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function getBlockedKeywords(siteFilters) {
  const keywords = siteFilters?.[currentSiteKey]?.blockedKeywords
  if (!Array.isArray(keywords)) return []
  return [...new Set(keywords.map(normalizeKeyword).filter(Boolean))]
}

function renderKeywords() {
  keywordList.replaceChildren()
  keywordEmpty.hidden = blockedKeywords.length > 0
  keywordInput.disabled = !currentSiteKey
  keywordForm.querySelector('button').disabled = !currentSiteKey

  for (const keyword of blockedKeywords) {
    const item = document.createElement('li')
    item.className = 'keyword-item'

    const label = document.createElement('span')
    label.textContent = keyword
    label.title = keyword

    const removeButton = document.createElement('button')
    removeButton.type = 'button'
    removeButton.textContent = 'Remove'
    removeButton.setAttribute('aria-label', `Remove blocked keyword ${keyword}`)
    removeButton.addEventListener('click', () => removeKeyword(keyword, removeButton))

    item.append(label, removeButton)
    keywordList.append(item)
  }
}

async function saveBlockedKeywords(nextKeywords) {
  if (!storageArea) throw new Error('Extension storage is unavailable')
  const state = await storageArea.get([SITE_FILTERS_STORAGE_KEY])
  const siteFilters = { ...(state[SITE_FILTERS_STORAGE_KEY] || {}) }

  if (nextKeywords.length) {
    siteFilters[currentSiteKey] = {
      ...(siteFilters[currentSiteKey] || {}),
      blockedKeywords: nextKeywords,
    }
  } else {
    delete siteFilters[currentSiteKey]
  }

  await storageArea.set({ [SITE_FILTERS_STORAGE_KEY]: siteFilters })
}

async function removeKeyword(keyword, button) {
  button.disabled = true
  const nextKeywords = blockedKeywords.filter((entry) => entry !== keyword)
  try {
    await saveBlockedKeywords(nextKeywords)
    blockedKeywords = nextKeywords
    renderKeywords()
  } catch {
    setStatus('Could not update blocked keywords.')
    button.disabled = false
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
  renderProfiles()

  if (!storageArea) {
    renderStorageUnavailable()
    return
  }

  const keys = currentSiteKey
    ? [ENABLED_STORAGE_KEY, mutedStorageKey, SITE_FILTERS_STORAGE_KEY]
    : [ENABLED_STORAGE_KEY]
  const state = await storageArea.get(keys)
  renderEnabled(state[ENABLED_STORAGE_KEY] !== false)
  profiles = Array.isArray(state[mutedStorageKey]) ? state[mutedStorageKey] : []
  blockedKeywords = getBlockedKeywords(state[SITE_FILTERS_STORAGE_KEY])
  renderProfiles()
  renderKeywords()
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
openSettingsButton.addEventListener('click', async () => {
  try {
    await chrome.runtime.openOptionsPage()
    window.close()
  } catch {
    setStatus('Could not open settings.')
  }
})
enabledButton.addEventListener('click', async () => {
  const enabled = enabledButton.dataset.enabled !== 'true'
  enabledButton.disabled = true
  try {
    if (!storageArea) throw new Error('Extension storage is unavailable')
    await storageArea.set({ [ENABLED_STORAGE_KEY]: enabled })
    renderEnabled(enabled)
  } catch {
    renderEnabled(!enabled)
    setStatus('Could not update automatic muting.')
  } finally {
    enabledButton.disabled = false
  }
})
keywordForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const keyword = normalizeKeyword(keywordInput.value)
  if (!keyword || !currentSiteKey) return

  if (blockedKeywords.includes(keyword)) {
    setStatus(`“${keyword}” is already blocked on this site.`)
    return
  }

  const nextKeywords = [...blockedKeywords, keyword]
  keywordInput.disabled = true
  keywordForm.querySelector('button').disabled = true
  setStatus('')
  try {
    await saveBlockedKeywords(nextKeywords)
    blockedKeywords = nextKeywords
    keywordInput.value = ''
    renderKeywords()
  } catch {
    setStatus('Could not save the blocked keyword.')
  } finally {
    keywordInput.disabled = !currentSiteKey
    keywordForm.querySelector('button').disabled = !currentSiteKey
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
    if (changes[SITE_FILTERS_STORAGE_KEY]) {
      blockedKeywords = getBlockedKeywords(changes[SITE_FILTERS_STORAGE_KEY].newValue)
      renderKeywords()
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
