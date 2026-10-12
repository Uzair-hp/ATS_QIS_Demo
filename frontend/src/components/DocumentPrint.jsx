import DocTemplate from '../templates/DocTemplate.jsx'

/**
 * The printable document sheet.
 *
 * Takes the same `data` and `theme` as every other surface. It renders nothing
 * on its own: the registry decides the layout, which is why changing the
 * template now changes what is on screen instead of only rewriting a download
 * URL.
 */
export default function DocumentPrint({ docType, data, theme, fallbackTheme }) {
  if (!data) return null
  return (
    <DocTemplate
      docType={docType}
      data={data}
      theme={theme}
      fallbackTheme={fallbackTheme}
    />
  )
}
