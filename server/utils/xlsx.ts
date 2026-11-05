import ExcelJS from 'exceljs'

/** Shared Excel styling: title rows with company and period, bold header, money format, borders. */
export function newWorkbook() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tourflow'
  wb.created = new Date()
  return wb
}

export const MONEY = '#,##0" ₸";[Red]-#,##0" ₸"'

export function sheetWithTitle(wb: ExcelJS.Workbook, name: string, title: string, subtitle: string, columns: { header: string, key: string, width: number, money?: boolean }[]) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }] })
  ws.columns = columns.map(c => ({ key: c.key, width: c.width, style: c.money ? { numFmt: MONEY } : {} }))
  ws.mergeCells(1, 1, 1, columns.length)
  ws.getCell(1, 1).value = title
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  ws.mergeCells(2, 1, 2, columns.length)
  ws.getCell(2, 1).value = subtitle
  ws.getCell(2, 1).font = { color: { argb: 'FF5A606B' } }
  const header = ws.getRow(4)
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    cell.alignment = { vertical: 'middle' }
  })
  header.height = 20
  return ws
}

export function addRows(ws: ExcelJS.Worksheet, rows: Record<string, unknown>[], opts: { totalRow?: Record<string, unknown> } = {}) {
  for (const r of rows) {
    const row = ws.addRow(r)
    row.eachCell(c => (c.border = { bottom: { style: 'hair', color: { argb: 'FFE6E7EA' } } }))
  }
  if (opts.totalRow) {
    const row = ws.addRow(opts.totalRow)
    row.font = { bold: true }
    row.eachCell(c => (c.border = { top: { style: 'thin' } }))
  }
}

export async function sendWorkbook(event: Parameters<typeof setResponseHeader>[0], wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer()
  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  return Buffer.from(buf)
}
