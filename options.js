const siteList = document.querySelector('#site-list')
const emptyState = document.querySelector('#empty-state')
const siteCount = document.querySelector('#site-count')
const profileCount = document.querySelector('#profile-count')
const statusElement = document.querySelector('#status')

const MUTED_STORAGE_PREFIX = 'muteByEntityMuted:'
const storageArea = globalThis.chrome?.storage?.local
const storageEvents = globalThis.chrome?.storage?.onChanged

let sites = []

function setStatus(message) {
  statusElement.textContent = message
}

function getInitial(value) {
  return String(value || '?').trim().charAt(0).toUpperCase() || '?'
}

function getProfileLabel(profile) {
  return String(profile?.label || 'Unknown profile')
}

function getSiteEntries(state) {
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

function createSiteCard(site) {
  const card = document.createElement('article')
  card.className = 'site-card'

  const header = document.createElement('header')
  header.className = 'site-header'
  const icon = document.createElement('span')
  icon.className = 'site-icon'
  icon.textContent = getInitial(site.hostname)
  icon.setAttribute('aria-hidden', 'true')
  const heading = document.createElement('h3')
  heading.className = 'site-name'
  heading.textContent = site.hostname
  const count = document.createElement('span')
  count.className = 'site-count'
  count.textContent = `${site.profiles.length} ${site.profiles.length === 1 ? 'profile' : 'profiles'}`
  header.append(icon, heading, count)

  const list = document.createElement('ul')
  list.className = 'profile-list'
  for (const profile of site.profiles) {
    list.append(createProfileRow(site, profile))
  }

  card.append(header, list)
  return card
}

function renderSites() {
  siteList.replaceChildren()
  const totalProfiles = sites.reduce((total, site) => total + site.profiles.length, 0)
  siteCount.textContent = String(sites.length)
  profileCount.textContent = String(totalProfiles)
  emptyState.hidden = sites.length > 0

  for (const site of sites) {
    siteList.append(createSiteCard(site))
  }
}

async function loadSites() {
  if (!storageArea) {
    setStatus('Extension storage is unavailable. Reload the extension and try again.')
    sites = []
    renderSites()
    return
  }

  const state = await storageArea.get(null)
  sites = getSiteEntries(state)
  setStatus('')
  renderSites()
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
    renderSites()
  } catch {
    setStatus('Could not update the muted list. Try again.')
    button.disabled = false
  }
}

if (storageEvents) {
  storageEvents.addListener((changes, areaName) => {
    if (areaName !== 'local') return
    if (Object.keys(changes).some((key) => key.startsWith(MUTED_STORAGE_PREFIX))) {
      loadSites().catch(() => setStatus('Could not refresh the muted list.'))
    }
  })
}

loadSites().catch(() => {
  setStatus('Could not load muted profiles. Try reloading the extension.')
  sites = []
  renderSites()
})
