import { componentFor, resolveKey } from './registry.js'

/**
 * Renders one document through one template.
 *
 * Every surface - the create/edit live preview, the print view, and the sheet
 * that Print / Save as PDF clones - mounts this with the same `data` and
 * `theme`. That is what makes "Default (Company Standard) looks identical
 * everywhere" true by construction rather than by coincidence.
 */
export default function DocTemplate({ docType, data, theme, fallbackTheme }) {
  const key = resolveKey(docType, theme, fallbackTheme)
  // ARCHETYPES holds module-level functions, so the reference is stable for a
  // given key and React does not remount the sheet when `theme` re-resolves.
  const Component = componentFor(docType, key)
  if (!Component) return null
  return <Component d={data} />
}
