const siteList = document.querySelector('#site-list')
const emptyState = document.querySelector('#empty-state')
const keywordSiteList = document.querySelector('#keyword-site-list')
const keywordEmptyState = document.querySelector('#keyword-empty-state')
const siteCount = document.querySelector('#site-count')
const profileCount = document.querySelector('#profile-count')
const keywordCount = document.querySelector('#keyword-count')
const statusElement = document.querySelector('#status')

const MUTED_STORAGE_PREFIX = 'muteByEntityMuted:'
const SITE_FILTERS_STORAGE_KEY = 'siteFilters'
const storageArea = globalThis.chrome?.storage?.local
const storageEvents = globalThis.chrome?.storage?.onChanged

let sites = []
let keywordSites = []

function setStatus(message) {
  statusElement.textContent = message
}

function getInitial(value) {
  return String(value || '?').trim().charAt(0).toUpperCase() || '?'
}

function getProfileLabel(profile) {
  return String(profile?.label || 'Unknown profile')
}

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function getMutedSiteEntries(state) {
  return Object.entries(state)
    .filter(([key, value]) => key.startsWith(MUTED_STORAGE_PREFIX) && Array.isArray(value) && value.length)
    .map(([key, profiles]) => ({
      key,
      hostname: key.slice(MUTED_STORAGE_PREFIX.length),
      profiles: profiles
        .filter((profile) => profile?.key)
        .sort((a, b) =>
          getProfileLabel(a).localeCompare(getProfileLabel(b), undefined, { sensitivity: 'base' })
        ),
    }))
    .filter((site) => site.hostname && site.profiles.length)
    .sort((a, b) => a.hostname.localeCompare(b.hostname))
}

function getKeywordSiteEntries(state) {
  const siteFilters = state[SITE_FILTERS_STORAGE_KEY]
  if (!siteFilters || typeof siteFilters !== 'object') return []

  return Object.entries(siteFilters)
    .map(([hostname, siteFilter]) => ({
      hostname,
      keywords: [...new Set(
        (Array.isArray(siteFilter?.blockedKeywords) ? siteFilter.blockedKeywords : [])
          .map(normalizeKeyword)
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    }))
    .filter((site) => site.hostname && site.keywords.length)
    .sort((a, b) => a.hostname.localeCompare(b.hostname))
}

function createProfileRow(site, profile) {
  const item = document.createElement('li')
  item.className = 'profile-row'

  const icon = document.createElement('span')
  icon.className = 'profile-icon'
  icon.textContent = getInitial(profile.label)
  icon.setAttribute('aria-hidden', 'true')

  const copy = document.createElement('div')
  copy.className = 'profile-copy'
  const label = document.createElement('strong')
  label.textContent = getProfileLabel(profile)
  const type = document.createElement('span')
  type.textContent = String(profile.type || 'profile')
  copy.append(label, type)

  const button = document.createElement('button')
  button.className = 'unmute-button'
  button.type = 'button'
  button.textContent = 'Unmute'
  button.setAttribute('aria-label', `Unmute ${getProfileLabel(profile)} on ${site.hostname}`)
  button.addEventListener('click', () => removeProfile(site.key, profile.key, button))

  item.append(icon, copy, button)
  return item
}

function createSiteHeader(hostname, countLabel) {
  const header = document.createElement('header')
  header.className = 'site-header'
  const icon = document.createElement('span')
  icon.className = 'site-icon'
  icon.textContent = getInitial(hostname)
  icon.setAttribute('aria-hidden', 'true')
  const heading = document.createElement('h3')
  heading.className = 'site-name'
  heading.textContent = hostname
  const count = document.createElement('span')
  count.className = 'site-count'
  count.textContent = countLabel
  header.append(icon, heading, count)
  return header
}

function createSiteCard(site) {
  const card = document.createElement('article')
  card.className = 'site-card'
  const profileLabel = site.profiles.length === 1 ? 'profile' : 'profiles'
  const header = createSiteHeader(site.hostname, `${site.profiles.length} ${profileLabel}`)

  const list = document.createElement('ul')
  list.className = 'profile-list'
  for (const profile of site.profiles) {
    list.append(createProfileRow(site, profile))
  }

  card.append(header, list)
  return card
}

function createKeywordRow(site, keyword) {
  const item = document.createElement('li')
  item.className = 'keyword-row'

  const label = document.createElement('strong')
  label.className = 'keyword-label'
  label.textContent = keyword
  label.title = keyword

  const button = document.createElement('button')
  button.className = 'remove-keyword-button'
  button.type = 'button'
  button.textContent = 'Remove'
  button.setAttribute('aria-label', `Remove blocked keyword ${keyword} on ${site.hostname}`)
  button.addEventListener('click', () => removeKeyword(site.hostname, keyword, button))

  item.append(label, button)
  return item
}

function createKeywordSiteCard(site) {
  const card = document.createElement('article')
  card.className = 'site-card'
  const keywordLabel = site.keywords.length === 1 ? 'keyword' : 'keywords'
  const header = createSiteHeader(site.hostname, `${site.keywords.length} ${keywordLabel}`)

  const list = document.createElement('ul')
  list.className = 'profile-list'
  for (const keyword of site.keywords) {
    list.append(createKeywordRow(site, keyword))
  }

  card.append(header, list)
  return card
}

function renderSettings() {
  siteList.replaceChildren()
  keywordSiteList.replaceChildren()
  const totalProfiles = sites.reduce((total, site) => total + site.profiles.length, 0)
  const totalKeywords = keywordSites.reduce((total, site) => total + site.keywords.length, 0)
  const hostnames = new Set([
    ...sites.map((site) => site.hostname),
    ...keywordSites.map((site) => site.hostname),
  ])
  siteCount.textContent = String(hostnames.size)
  profileCount.textContent = String(totalProfiles)
  keywordCount.textContent = String(totalKeywords)
  emptyState.hidden = sites.length > 0
  keywordEmptyState.hidden = keywordSites.length > 0

  for (const site of sites) {
    siteList.append(createSiteCard(site))
  }

  for (const site of keywordSites) {
    keywordSiteList.append(createKeywordSiteCard(site))
  }
}

async function loadSites() {
  if (!storageArea) {
    setStatus('Extension storage is unavailable. Reload the extension and try again.')
    sites = []
    keywordSites = []
    renderSettings()
    return
  }

  const state = await storageArea.get(null)
  sites = getMutedSiteEntries(state)
  keywordSites = getKeywordSiteEntries(state)
  setStatus('')
  renderSettings()
}

async function removeProfile(storageKey, profileKey, button) {
  button.disabled = true
  setStatus('')

  try {
    const site = sites.find((entry) => entry.key === storageKey)
    if (!site) return
    const nextProfiles = site.profiles.filter((profile) => profile.key !== profileKey)

    if (nextProfiles.length) {
      await storageArea.set({ [storageKey]: nextProfiles })
    } else {
      await storageArea.remove(storageKey)
    }

    sites = sites
      .map((entry) => entry.key === storageKey ? { ...entry, profiles: nextProfiles } : entry)
      .filter((entry) => entry.profiles.length)
    renderSettings()
  } catch {
    setStatus('Could not update the muted list. Try again.')
    button.disabled = false
  }
}

async function removeKeyword(hostname, keyword, button) {
  button.disabled = true
  setStatus('')

  try {
    const state = await storageArea.get([SITE_FILTERS_STORAGE_KEY])
    const siteFilters = { ...(state[SITE_FILTERS_STORAGE_KEY] || {}) }
    const currentSiteFilter = { ...(siteFilters[hostname] || {}) }
    const nextKeywords = (Array.isArray(currentSiteFilter.blockedKeywords)
      ? currentSiteFilter.blockedKeywords
      : [])
      .map(normalizeKeyword)
      .filter((entry) => entry && entry !== keyword)

    if (nextKeywords.length) {
      currentSiteFilter.blockedKeywords = [...new Set(nextKeywords)]
      siteFilters[hostname] = currentSiteFilter
    } else {
      delete currentSiteFilter.blockedKeywords
      if (Object.keys(currentSiteFilter).length) {
        siteFilters[hostname] = currentSiteFilter
      } else {
        delete siteFilters[hostname]
      }
    }

    await storageArea.set({ [SITE_FILTERS_STORAGE_KEY]: siteFilters })
    keywordSites = getKeywordSiteEntries({ [SITE_FILTERS_STORAGE_KEY]: siteFilters })
    renderSettings()
  } catch {
    setStatus('Could not update blocked keywords. Try again.')
    button.disabled = false
  }
}

if (storageEvents) {
  storageEvents.addListener((changes, areaName) => {
    if (areaName !== 'local') return
    if (Object.keys(changes).some((key) =>
      key.startsWith(MUTED_STORAGE_PREFIX) || key === SITE_FILTERS_STORAGE_KEY
    )) {
      loadSites().catch(() => setStatus('Could not refresh content filters.'))
    }
  })
}

loadSites().catch(() => {
  setStatus('Could not load content filters. Try reloading the extension.')
  sites = []
  keywordSites = []
  renderSettings()
})
