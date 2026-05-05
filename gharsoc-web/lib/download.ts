/**
 * Shared download utilities for broker data exports.
 * Uses SheetJS (xlsx) for Excel, native browser APIs for CSV and audio.
 */
import * as XLSX from 'xlsx'

/** Download any data array as a formatted .xlsx file */
export function downloadExcel(data: Record<string, any>[], filename: string, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data)

  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key] ?? '').length), 10),
  }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/** Download any data array as a .csv file */
export function downloadCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = String(row[h] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`)
}

/**
 * Download a remote audio recording as a .wav file.
 * Fetches the URL and saves it with the given filename.
 */
export async function downloadRecording(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    // Preserve original format but default to .mp3 if unknown or forced
    const ext = blob.type.includes('mpeg') || blob.type.includes('mp3') ? 'mp3'
      : blob.type.includes('ogg') ? 'ogg'
      : blob.type.includes('mp4') ? 'mp4'
      : 'mp3' // Changed from wav to mp3 based on user request
    triggerDownload(blob, `${filename}.${ext}`)
  } catch (e) {
    // Fallback: open in new tab if CORS blocks direct fetch
    window.open(url, '_blank')
  }
}

/** Download transcript text as a .txt file */
export async function downloadTranscript(transcript: string, filename: string) {
  if (!transcript) return
  const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' })
  
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${filename}.txt`,
        types: [{
          description: 'Text Files',
          accept: { 'text/plain': ['.txt'] },
        }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Save file picker failed:', err)
      }
      return // Don't fallback if they just cancelled the prompt
    }
  }

  // Fallback for browsers that do not support showSaveFilePicker
  triggerDownload(blob, `${filename}.txt`)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  
  // Wait before revoking the URL to ensure the browser has time to start the download
  setTimeout(() => {
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }, 1000)
}
