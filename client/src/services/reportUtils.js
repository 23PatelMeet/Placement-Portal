import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

// === PDF GENERATION FUNCTIONS ===

export const generateHiringReportPDF = (analyticsData, companyName) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 116, 166);
    doc.text('Analytics Report', margin, 30);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Company: ${companyName}`, margin, 45);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, margin, 55);

    if (analyticsData.dateRange?.startDate || analyticsData.dateRange?.endDate) {
        const dateRange = `Date Range: ${new Date(analyticsData.dateRange.startDate).toLocaleDateString() || 'Beginning'} to ${new Date(analyticsData.dateRange.endDate).toLocaleDateString() || analyticsData.dateRange.endDate || 'Present'}`;
        doc.text(dateRange, margin, 65);
    }

    let yPosition = 80;

    // Summary Statistics
    doc.setFontSize(16);
    doc.setTextColor(40, 116, 166);
    doc.text('Summary Statistics', margin, yPosition);
    yPosition += 15;

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    const summary = analyticsData.summary;
    doc.text(`Total Job Postings: ${summary.totalJobs}`, margin, yPosition);
    doc.text(`Active Jobs: ${analyticsData.activeJobs}`, pageWidth / 2, yPosition);
    yPosition += 10;
    doc.text(`Total Applications: ${summary.totalApplications}`, margin, yPosition);
    doc.text(`Avg Applications/Job: ${summary.averageApplicationsPerJob}`, pageWidth / 2, yPosition);
    yPosition += 20;

    // Save the PDF
    const fileName = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
};

// === EXCEL EXPORT FUNCTIONS ===

export const exportToExcel = async (data, filename, sheetName = 'Data') => {
    try {
        if (!data || data.length === 0) {
            throw new Error('No data to export');
        }

        // Create a new workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        // Get column headers from the first data object
        const headers = Object.keys(data[0]);

        // Add headers
        worksheet.addRow(headers);

        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6F2FF' }
        };

        // Add data rows
        data.forEach(item => {
            const row = headers.map(header => item[header] ?? '');
            worksheet.addRow(row);
        });

        // Make "Resume Link" column clickable hyperlinks (open in browser when clicked)
        const resumeLinkColIndex = headers.findIndex(h => h === 'Resume Link');
        if (resumeLinkColIndex !== -1) {
            data.forEach((item, rowIndex) => {
                const url = item['Resume Link'];
                if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
                    const cell = worksheet.getCell(rowIndex + 2, resumeLinkColIndex + 1);
                    cell.value = {
                        text: url,
                        hyperlink: url,
                    };
                    cell.font = { color: { argb: 'FF0000FF' }, underline: true };
                }
            });
        }

        // Auto-size columns
        worksheet.columns.forEach((column, index) => {
            let maxLength = headers[index].length;
            column.eachCell({ includeEmpty: false }, (cell) => {
                const cellLength = cell.value ? cell.value.toString().length : 0;
                if (cellLength > maxLength) {
                    maxLength = cellLength;
                }
            });
            column.width = Math.min(maxLength + 2, 50);
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        saveAs(blob, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (error) {
        console.error('Excel export error:', error);
        throw new Error('Failed to export to Excel: ' + error.message);
    }
};


