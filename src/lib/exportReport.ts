import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SummaryExportRow {
  name: string;
  count: number;
  value: number;
}

interface SummaryExportDayRow {
  date: string;
  count: number;
  value: number;
}

export interface SummaryExportData {
  storeCode?: string | null;
  start: string;
  end: string;
  grandCount: number;
  grandValue: number;
  byItem: SummaryExportRow[];
  byDay: SummaryExportDayRow[];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function csvRow(values: (string | number)[]): string {
  return values.map(csvCell).join(',');
}

export function exportSummaryCsv(data: SummaryExportData) {
  const lines: string[] = [
    csvRow(['Waste Summary Report']),
    csvRow([`${data.start} to ${data.end}`]),
    ...(data.storeCode ? [csvRow([`Store ${data.storeCode}`])] : []),
    '',
    csvRow(['Items Wasted', data.grandCount]),
    csvRow(['Total Value', `$${data.grandValue.toFixed(2)}`]),
    '',
    csvRow(['By Item']),
    csvRow(['Item', 'Count', 'Value']),
    ...data.byItem.map((r) => csvRow([r.name, r.count, `$${r.value.toFixed(2)}`])),
    '',
    csvRow(['By Day']),
    csvRow(['Date', 'Count', 'Value']),
    ...data.byDay.map((r) => csvRow([r.date, r.count, `$${r.value.toFixed(2)}`])),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `waste-summary_${data.start}_to_${data.end}.csv`);
}

export function exportSummaryPdf(data: SummaryExportData) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Waste Summary Report', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${data.start} to ${data.end}${data.storeCode ? `  ·  Store ${data.storeCode}` : ''}`, 14, 25);
  doc.setTextColor(0);
  doc.text(`Items Wasted: ${data.grandCount}      Total Value: $${data.grandValue.toFixed(2)}`, 14, 33);

  autoTable(doc, {
    startY: 39,
    head: [['Item', 'Count', 'Value']],
    body: data.byItem.map((r) => [r.name, String(r.count), `$${r.value.toFixed(2)}`]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [0, 122, 255] },
  });

  const afterItemsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  autoTable(doc, {
    startY: afterItemsY,
    head: [['Date', 'Count', 'Value']],
    body: data.byDay.map((r) => [r.date, String(r.count), `$${r.value.toFixed(2)}`]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [0, 122, 255] },
  });

  doc.save(`waste-summary_${data.start}_to_${data.end}.pdf`);
}
