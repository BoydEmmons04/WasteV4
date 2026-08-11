import { createRoot } from 'react-dom/client'
import Framework7 from 'framework7/lite-bundle'
import Framework7React from 'framework7-react'
import 'framework7-icons'
import 'framework7/css/bundle'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

Framework7.use(Framework7React)

// Icon fonts only download once something using them is actually painted -
// AdminScreen never renders an Icon, so without this the very first icon
// glyph an admin session ever needs is on MainScreen right after clicking
// "View" into a store, which is the worst possible moment for a first-load
// font flash (chevron_left/info_circle/etc showing as literal text before
// the font swaps the ligature in). Kicking the fetch off at boot instead
// gives it the whole rest of the admin flow (sign in, load account list) to
// finish before any icon is ever needed.
if ('fonts' in document) {
  document.fonts.load('16px "Framework7 Icons"').catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
