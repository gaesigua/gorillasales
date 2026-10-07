'use client';

import React, { useState, useMemo } from 'react';
import { formatRWF } from '@/lib/format';
import { ORDER_STATUS_LABELS, type VisitLog } from '@/lib/types';

interface WeeklyReportExportProps {
  visits: VisitLog[];
  today: string;
  onClose: () => void;
}

type ExportFormat = 'pdf' | 'excel' | 'word';

// Monday–Sunday week containing `today` (YYYY-MM-DD), shifted by `offset` weeks. Works on
// UTC-midnight dates so it matches the calendar-date strings of visit logs.
function getWeekRange(today: string, offset: number = 0): { start: Date; end: Date; startStr: string; endStr: string; label: string } {
  const now = new Date(`${today}T00:00:00Z`);
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return {
    start: monday,
    end: sunday,
    startStr: monday.toISOString().slice(0, 10),
    endStr: sunday.toISOString().slice(0, 10),
    label: `${fmt(monday)} – ${fmt(sunday)}`,
  };
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const WEEK_OPTIONS = [
  { offset: 0, label: 'This week' },
  { offset: -1, label: 'Last week' },
  { offset: -2, label: '2 weeks ago' },
  { offset: -3, label: '3 weeks ago' },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ReactNode; ext: string }[] = [
  { value: 'pdf', label: 'PDF', icon: null, ext: '.pdf' },
  { value: 'excel', label: 'Excel', icon: null, ext: '.xlsx' },
  { value: 'word', label: 'Word', icon: null, ext: '.docx' },
];

export default function WeeklyReportExport({ visits, today, onClose }: WeeklyReportExportProps) {
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [exporting, setExporting] = useState(false);

  const salespeople = useMemo(() => {
    const names = Array.from(new Set(visits.map((v) => v.salesperson))).sort();
    return names;
  }, [visits]);

  const weekRange = useMemo(() => getWeekRange(today, weekOffset), [today, weekOffset]);

  const filteredLogs = useMemo(() => {
    return visits.filter((v) => {
      const matchSp = !selectedSalesperson || v.salesperson === selectedSalesperson;
      const matchWeek = v.dateOfVisit >= weekRange.startStr && v.dateOfVisit <= weekRange.endStr;
      return matchSp && matchWeek;
    });
  }, [visits, selectedSalesperson, weekRange]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const map: Record<string, VisitLog[]> = {};
    filteredLogs.forEach((v) => {
      if (!map[v.dateOfVisit]) map[v.dateOfVisit] = [];
      map[v.dateOfVisit].push(v);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredLogs]);

  const totalSales = filteredLogs.reduce((s, v) => s + v.salesValue, 0);
  const totalOrders = filteredLogs.filter((v) => v.salesValue > 0).length;

  const TABLE_HEADERS = [
    'Salesperson', 'Customer', 'Area', 'Category', 'Outcome',
    'Order', 'Products', 'Order Value (RWF)', 'Order Status', 'Remarks',
  ];

  function getRowData(v: VisitLog): string[] {
    return [
      v.salesperson,
      v.customerName,
      v.area,
      v.customerCategory,
      v.visitOutcome,
      v.orderNumber || '—',
      v.productSummary || '—',
      v.salesValue > 0 ? formatRWF(v.salesValue) : '—',
      v.orderStatus ? ORDER_STATUS_LABELS[v.orderStatus] : '—',
      v.remarks || '—',
    ];
  }

  async function handleExport() {
    setExporting(true);
    const spLabel = selectedSalesperson || 'All Salespeople';
    const fileName = `Weekly_Report_${spLabel.replace(/\s+/g, '_')}_${weekRange.start.toISOString().slice(0, 10)}`;

    try {
      if (format === 'pdf') {
        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Rwanda Farmers Coffee Company — Weekly Sales Report', 14, 14);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Salesperson: ${spLabel}`, 14, 22);
        doc.text(`Week: ${weekRange.label}`, 14, 28);
        doc.text(`Total Sales: ${formatRWF(totalSales)}   Orders: ${totalOrders}   Visits: ${filteredLogs.length}`, 14, 34);

        let yPos = 40;

        if (groupedByDate.length === 0) {
          doc.text('No records found for this period.', 14, yPos);
        } else {
          for (const [date, rows] of groupedByDate) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`Date: ${formatDate(date)}`, 14, yPos);
            yPos += 4;

            autoTable(doc, {
              startY: yPos,
              head: [TABLE_HEADERS],
              body: rows.map(getRowData),
              styles: { fontSize: 7, cellPadding: 2 },
              headStyles: { fillColor: [61, 46, 0], textColor: 255, fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [254, 252, 232] },
              margin: { left: 14, right: 14 },
              didDrawPage: (data: { cursor?: { y: number } | null }) => {
                if (data.cursor) yPos = data.cursor.y + 6;
              },
            });

            const dayTotal = rows.reduce((s, v) => s + v.salesValue, 0);
            yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.text(`Day Total: ${formatRWF(dayTotal)}  |  Visits: ${rows.length}  |  Orders: ${rows.filter(v => v.salesValue > 0).length}`, 14, yPos);
            yPos += 8;

            if (yPos > 180) {
              doc.addPage();
              yPos = 14;
            }
          }
        }

        doc.save(`${fileName}.pdf`);
      } else if (format === 'excel') {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        // Summary sheet
        const summaryData = [
          ['Rwanda Farmers Coffee Company — Weekly Sales Report'],
          [`Salesperson: ${spLabel}`],
          [`Week: ${weekRange.label}`],
          [],
          ['Total Sales (RWF)', formatRWF(totalSales)],
          ['Total Visits', filteredLogs.length],
          ['Total Orders', totalOrders],
        ];
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

        // One sheet per date
        for (const [date, rows] of groupedByDate) {
          const sheetData = [
            [`Date: ${formatDate(date)}`],
            TABLE_HEADERS,
            ...rows.map(getRowData),
            [],
            ['Day Total', '', '', '', '', '', '', '', formatRWF(rows.reduce((s, v) => s + v.salesValue, 0))],
          ];
          const ws = XLSX.utils.aoa_to_sheet(sheetData);
          const safeDate = date.replace(/-/g, '');
          XLSX.utils.book_append_sheet(wb, ws, safeDate.slice(4));
        }

        // All data sheet
        const allData = [
          TABLE_HEADERS,
          ...filteredLogs.map(getRowData),
        ];
        const allWs = XLSX.utils.aoa_to_sheet(allData);
        XLSX.utils.book_append_sheet(wb, allWs, 'All Data');

        XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else if (format === 'word') {
        const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType, BorderStyle } = await import('docx');
        const { saveAs } = await import('file-saver');

        const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
          new Paragraph({
            text: 'Rwanda Farmers Coffee Company — Weekly Sales Report',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({ text: `Salesperson: ${spLabel}` }),
          new Paragraph({ text: `Week: ${weekRange.label}` }),
          new Paragraph({ text: `Total Sales: ${formatRWF(totalSales)}   |   Visits: ${filteredLogs.length}   |   Orders: ${totalOrders}` }),
          new Paragraph({ text: '' }),
        ];

        if (groupedByDate.length === 0) {
          children.push(new Paragraph({ text: 'No records found for this period.' }));
        } else {
          for (const [date, rows] of groupedByDate) {
            children.push(
              new Paragraph({
                text: `Date: ${formatDate(date)}`,
                heading: HeadingLevel.HEADING_2,
              })
            );

            const headerRow = new TableRow({
              children: TABLE_HEADERS.map(
                (h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
                    shading: { fill: '3d2e00' },
                    width: { size: Math.floor(9000 / TABLE_HEADERS.length), type: WidthType.DXA },
                  })
              ),
            });

            const dataRows = rows.map(
              (v) =>
                new TableRow({
                  children: getRowData(v).map(
                    (cell) =>
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: cell, size: 16 })] })],
                        width: { size: Math.floor(9000 / TABLE_HEADERS.length), type: WidthType.DXA },
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1 },
                          bottom: { style: BorderStyle.SINGLE, size: 1 },
                          left: { style: BorderStyle.SINGLE, size: 1 },
                          right: { style: BorderStyle.SINGLE, size: 1 },
                        },
                      })
                  ),
                })
            );

            const table = new Table({
              rows: [headerRow, ...dataRows],
              width: { size: 100, type: WidthType.PERCENTAGE },
            });

            children.push(table);

            const dayTotal = rows.reduce((s, v) => s + v.salesValue, 0);
            children.push(
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Day Total: ${formatRWF(dayTotal)}  |  Visits: ${rows.length}  |  Orders: ${rows.filter(v => v.salesValue > 0).length}`,
                    italics: true,
                    size: 18,
                  }),
                ],
              }),
              new Paragraph({ text: '' })
            );
          }
        }

        const doc = new Document({
          sections: [{ children }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileName}.docx`);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Export Weekly Report</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Download sales data as a formatted table</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Salesperson selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Salesperson</label>
            <select
              value={selectedSalesperson}
              onChange={(e) => setSelectedSalesperson(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Salespeople</option>
              {salespeople.map((sp) => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          </div>

          {/* Week selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Week</label>
            <div className="grid grid-cols-2 gap-2">
              {WEEK_OPTIONS.map((w) => {
                const range = getWeekRange(today, w.offset);
                return (
                  <button
                    key={w.offset}
                    onClick={() => setWeekOffset(w.offset)}
                    className={`text-left px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      weekOffset === w.offset
                        ? 'border-primary bg-primary/10 text-primary font-medium' :'border-border bg-input text-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">{w.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{range.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Export Format</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    format === f.value
                      ? 'border-primary bg-primary/10 text-primary' :'border-border bg-input text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {f.icon}
                  <span>{f.label}</span>
                  <span className="text-[10px] opacity-60">{f.ext}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview summary */}
          <div className="bg-muted/50 border border-border rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Report Preview</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{filteredLogs.length}</p>
                <p className="text-[11px] text-muted-foreground">Visits</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{totalOrders}</p>
                <p className="text-[11px] text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{groupedByDate.length}</p>
                <p className="text-[11px] text-muted-foreground">Days</p>
              </div>
            </div>
            <p className="text-center text-sm font-semibold text-foreground mt-2">
              Total: {formatRWF(totalSales)}
            </p>
            {filteredLogs.length === 0 && (
              <p className="text-center text-xs text-muted-foreground mt-1">No records for this period</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
          >
            {exporting ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                
                Export {FORMAT_OPTIONS.find(f => f.value === format)?.label}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
