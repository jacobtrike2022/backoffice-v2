// ============================================================================
// REPORT EXPORT UTILITIES
// ============================================================================

import jsPDF from 'jspdf';
import type { LearnerRecord, FlattenedAssignmentRow, UnitReportRow, ReportType } from '../crud/reports';

// Union type for all exportable data
type ExportData = LearnerRecord[] | FlattenedAssignmentRow[] | UnitReportRow[];

/**
 * Get headers based on report mode
 */
function getHeadersForMode(mode: ReportType): string[] {
  switch (mode) {
    case 'people':
      return [
        'Employee Name',
        'Employee ID',
        'District',
        'Store',
        'Role',
        'Progress',
        'Score',
        'Status',
        'Last Activity',
        'Certification'
      ];
    case 'assignments':
      return [
        'Employee Name',
        'Employee ID',
        'District',
        'Store',
        'Role',
        'Playlist',
        'Album',
        'Track',
        'Progress',
        'Score',
        'Status',
        'Date Assigned',
        'Due Date',
        'Completion Date'
      ];
    case 'units':
      return [
        'Unit Name',
        'District',
        'Employees',
        'Assignments',
        'Avg Progress',
        'Completed',
        'In Progress',
        'Overdue',
        'Not Started',
        'Compliance'
      ];
  }
}

/**
 * Format data rows based on report mode
 */
function formatRowsForMode(data: ExportData, mode: ReportType): string[][] {
  switch (mode) {
    case 'people':
      return (data as LearnerRecord[]).map(record => [
        record.employeeName,
        record.employeeId,
        record.district,
        record.store,
        record.role,
        `${record.progress}%`,
        record.score.toString(),
        record.status,
        record.lastActivity,
        record.certification || ''
      ]);
    case 'assignments':
      return (data as FlattenedAssignmentRow[]).map(row => [
        row.employeeName,
        row.employeeId,
        row.district,
        row.store,
        row.role,
        row.playlist,
        row.album,
        row.track,
        `${row.progress}%`,
        row.score.toString(),
        row.status,
        row.dateAssigned || '',
        row.dueDate || '',
        row.completionDate || ''
      ]);
    case 'units':
      return (data as UnitReportRow[]).map(row => [
        row.unitName,
        row.district,
        row.employeeCount.toString(),
        row.assignmentCount.toString(),
        `${row.avgProgress}%`,
        row.completedCount.toString(),
        row.inProgressCount.toString(),
        row.overdueCount.toString(),
        row.notStartedCount.toString(),
        `${row.compliance}%`
      ]);
  }
}

/**
 * Export data to CSV based on report mode
 */
export function exportToCSV(
  data: ExportData,
  filename: string = 'report',
  mode: ReportType = 'people'
) {
  const headers = getHeadersForMode(mode);
  const rows = formatRowsForMode(data, mode);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

/**
 * Export data to Excel (Tab-separated with BOM for Excel compatibility)
 */
export function exportToExcel(
  data: ExportData,
  filename: string = 'report',
  mode: ReportType = 'people'
) {
  const headers = getHeadersForMode(mode);
  const rows = formatRowsForMode(data, mode);

  // Add BOM for Excel to recognize UTF-8
  const BOM = '\uFEFF';
  const tsvContent = BOM + [
    headers.join('\t'),
    ...rows.map(row => row.map(cell => String(cell).replace(/\t/g, ' ')).join('\t'))
  ].join('\n');

  downloadFile(tsvContent, `${filename}.xls`, 'application/vnd.ms-excel');
}

/**
 * Export data to PDF based on report mode
 */
export function exportToPDF(
  data: ExportData,
  filename: string = 'report',
  mode: ReportType = 'people'
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');

  // Title based on mode
  const titles: Record<ReportType, string> = {
    people: 'Learner Report',
    assignments: 'Assignment Report',
    units: 'Unit Report'
  };

  doc.setFontSize(18);
  doc.text(titles[mode], 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  doc.text(`Total Records: ${data.length}`, 14, 27);

  // Get headers and column widths based on mode
  const { headers, colWidths } = getPDFConfig(mode);
  let y = 35;

  // Header row
  doc.setFillColor(59, 130, 246);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  let x = 14;
  headers.forEach((header, i) => {
    doc.rect(x, y, colWidths[i], 7, 'F');
    doc.text(header, x + 2, y + 5);
    x += colWidths[i];
  });

  // Data rows
  doc.setTextColor(0, 0, 0);
  y += 7;

  const pageHeight = 190; // Max y position before new page
  const pdfRows = getPDFRows(data, mode);

  pdfRows.forEach((rowData, index) => {
    if (y > pageHeight) {
      doc.addPage();
      y = 20;

      // Re-draw headers on new page
      doc.setFillColor(59, 130, 246);
      doc.setTextColor(255, 255, 255);
      x = 14;
      headers.forEach((header, i) => {
        doc.rect(x, y, colWidths[i], 7, 'F');
        doc.text(header, x + 2, y + 5);
        x += colWidths[i];
      });
      doc.setTextColor(0, 0, 0);
      y += 7;
    }

    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(14, y, colWidths.reduce((a, b) => a + b, 0), 7, 'F');
    }

    x = 14;
    rowData.forEach((cell, i) => {
      doc.text(cell, x + 2, y + 5);
      x += colWidths[i];
    });
    y += 7;
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Get PDF configuration (headers and column widths) based on mode
 */
function getPDFConfig(mode: ReportType): { headers: string[]; colWidths: number[] } {
  switch (mode) {
    case 'people':
      return {
        headers: ['Employee', 'Store', 'Role', 'Progress', 'Score', 'Status'],
        colWidths: [50, 35, 40, 25, 20, 30]
      };
    case 'assignments':
      return {
        headers: ['Employee', 'Playlist', 'Location', 'Due', 'Progress', 'Status'],
        colWidths: [45, 55, 35, 25, 22, 25]
      };
    case 'units':
      return {
        headers: ['Unit', 'District', 'Employees', 'Assignments', 'Progress', 'Overdue'],
        colWidths: [50, 40, 30, 35, 25, 25]
      };
  }
}

/**
 * Get PDF rows based on mode (with truncated text for PDF cells)
 */
function getPDFRows(data: ExportData, mode: ReportType): string[][] {
  switch (mode) {
    case 'people':
      return (data as LearnerRecord[]).map(record => [
        truncateText(record.employeeName, 25),
        truncateText(record.store, 18),
        truncateText(record.role, 20),
        `${record.progress}%`,
        record.score.toString(),
        record.status
      ]);
    case 'assignments':
      return (data as FlattenedAssignmentRow[]).map(row => [
        truncateText(row.employeeName, 22),
        truncateText(row.playlist, 28),
        truncateText(row.store, 18),
        row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—',
        `${row.progress}%`,
        row.status
      ]);
    case 'units':
      return (data as UnitReportRow[]).map(row => [
        truncateText(row.unitName, 25),
        truncateText(row.district, 20),
        row.employeeCount.toString(),
        row.assignmentCount.toString(),
        `${row.avgProgress}%`,
        row.overdueCount.toString()
      ]);
  }
}

/**
 * Helper function to truncate text for PDF cells
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 2) + '..';
}

/**
 * Helper function to trigger file download
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
