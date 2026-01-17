// ============================================================================
// REPORT EXPORT UTILITIES
// ============================================================================

import jsPDF from 'jspdf';
import type { LearnerRecord } from '../crud/reports';

/**
 * Export learner records to CSV
 */
export function exportToCSV(data: LearnerRecord[], filename: string = 'learner-report') {
  const headers = [
    'Employee Name',
    'Employee ID',
    'District',
    'Store',
    'Role',
    'Album',
    'Playlist',
    'Track',
    'Progress',
    'Score',
    'Status',
    'Completion Date',
    'Last Activity',
    'Certification'
  ];

  const rows = data.map(record => [
    record.employeeName,
    record.employeeId,
    record.district,
    record.store,
    record.role,
    record.album,
    record.playlist,
    record.track,
    `${record.progress}%`,
    record.score.toString(),
    record.status,
    record.completionDate || '',
    record.lastActivity,
    record.certification || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

/**
 * Export learner records to Excel (Tab-separated with BOM for Excel compatibility)
 */
export function exportToExcel(data: LearnerRecord[], filename: string = 'learner-report') {
  const headers = [
    'Employee Name',
    'Employee ID',
    'District',
    'Store',
    'Role',
    'Album',
    'Playlist',
    'Track',
    'Progress',
    'Score',
    'Status',
    'Completion Date',
    'Last Activity',
    'Certification'
  ];

  const rows = data.map(record => [
    record.employeeName,
    record.employeeId,
    record.district,
    record.store,
    record.role,
    record.album,
    record.playlist,
    record.track,
    `${record.progress}%`,
    record.score.toString(),
    record.status,
    record.completionDate || '',
    record.lastActivity,
    record.certification || ''
  ]);

  // Add BOM for Excel to recognize UTF-8
  const BOM = '\uFEFF';
  const tsvContent = BOM + [
    headers.join('\t'),
    ...rows.map(row => row.map(cell => cell.replace(/\t/g, ' ')).join('\t'))
  ].join('\n');

  downloadFile(tsvContent, `${filename}.xls`, 'application/vnd.ms-excel');
}

/**
 * Export learner records to PDF
 */
export function exportToPDF(data: LearnerRecord[], filename: string = 'learner-report') {
  const doc = new jsPDF('landscape', 'mm', 'a4');

  // Title
  doc.setFontSize(18);
  doc.text('Learner Activity Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  doc.text(`Total Records: ${data.length}`, 14, 27);

  // Table headers
  const headers = ['Employee', 'Store', 'Album', 'Progress', 'Score', 'Status'];
  const colWidths = [45, 30, 55, 22, 20, 25];
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

  data.forEach((record, index) => {
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
    const rowData = [
      truncateText(record.employeeName, 22),
      truncateText(record.store, 15),
      truncateText(record.album, 28),
      `${record.progress}%`,
      record.score.toString(),
      record.status
    ];

    rowData.forEach((cell, i) => {
      doc.text(cell, x + 2, y + 5);
      x += colWidths[i];
    });
    y += 7;
  });

  doc.save(`${filename}.pdf`);
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
