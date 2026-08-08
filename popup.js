const startButton = document.querySelector('#start-selection')
const statusElement = document.querySelector('#status')

function setStatus(message) {
  statusElement.textContent = message
}

function isSelectablePage(url = '') {
  return /^https?:\/\//.test(url) || /^file:\/\//.test(url)
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
