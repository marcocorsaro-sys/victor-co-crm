// Utility per il codice fiscale italiano.
// Il CF codifica data di nascita e sesso: lo sfruttiamo per pre-compilare
// la data di nascita dei contatti che hanno gia firmato modulistica.

const MONTH_CODES = 'ABCDEHLMPRST' // A=gennaio ... T=dicembre

/**
 * Estrae la data di nascita (YYYY-MM-DD) da un codice fiscale italiano.
 * Ritorna null se il CF non e valido o la data non e plausibile.
 */
export function birthDateFromCodiceFiscale(cf: string | null | undefined): string | null {
  if (!cf) return null
  const c = cf.trim().toUpperCase()
  if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(c)) return null

  const yy = parseInt(c.slice(6, 8), 10)
  const monthIdx = MONTH_CODES.indexOf(c[8])
  if (monthIdx === -1) return null

  let day = parseInt(c.slice(9, 11), 10)
  if (day > 40) day -= 40 // le donne hanno il giorno +40
  if (day < 1 || day > 31) return null

  // Pivot sul secolo: anni <= anno corrente (2 cifre) -> 2000+, altrimenti 1900+
  const currentYY = new Date().getFullYear() % 100
  const year = yy <= currentYY ? 2000 + yy : 1900 + yy
  const month = monthIdx + 1

  // Validazione finale (evita giorni inesistenti, es. 31 febbraio)
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null

  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}
