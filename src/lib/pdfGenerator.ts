import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface GSTBillItem {
  particulars: string;
  hsn: string;
  qty: number | string;
  rate: number | string;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  amount: number;
}

interface GSTBillData {
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  customer_gstin?: string;
  customer_address?: string;
  customer_state?: string;
  place_of_supply?: string;
  payment_mode: string;
  items: GSTBillItem[];
  taxable_amount: number;
  cgst: number;
  sgst: number;
  grand_total: number;
  is_igst: boolean;        // new
  freight_charge: number;  // new
}

const formatINR = (num: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(num);

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  return 'Rupees ' + convert(Math.round(num)) + ' Only';
};

const generateSingleCopy = (doc: jsPDF, data: GSTBillData, startY: number, copyLabel: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 5;
  const rightMargin = 5;
  const availableWidth = pageWidth - leftMargin - rightMargin;
  const colMid = leftMargin + availableWidth / 2;
  let y = startY;

  // ── TAX INVOICE TITLE ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Tax Invoice", pageWidth / 2, y, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(copyLabel, pageWidth - rightMargin, y, { align: "right" });
  y += 4;

  // ── HEADER BOX ──
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.rect(leftMargin, y, availableWidth, 22);
  // vertical divider after logo box
  doc.setLineWidth(0.1);
  doc.line(leftMargin + 22, y, leftMargin + 22, y + 22);

  // RSG logo box
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 102, 204);
  doc.text("RSG", leftMargin + 11, y + 13, { align: "center" });
  doc.setTextColor(0);

  // Shop details
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("GSTIN: 33AXIPL9661R1ZK", leftMargin + 24, y + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RAJ SHREE GIFTS", leftMargin + 24, y + 12);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("62A/82 West Avani Moola Street, Madurai - 625001", leftMargin + 24, y + 17);
  doc.text("Ph: 77087 74707", leftMargin + 24, y + 21);
  y += 22;

  // ── BILL TO + INVOICE DETAILS HEADER (colored) ──
  doc.setFillColor(220, 230, 241);
  doc.rect(leftMargin, y, availableWidth / 2, 6, 'F');
  doc.rect(colMid, y, availableWidth / 2, 6, 'F');
  doc.setLineWidth(0.1);
  doc.rect(leftMargin, y, availableWidth, 6);
  doc.line(colMid, y, colMid, y + 6);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To", leftMargin + 2, y + 4);
  doc.text("Invoice Details", colMid + 2, y + 4);
  y += 6;

  // ── BILL TO + INVOICE DETAILS CONTENT ──
  doc.setLineWidth(0.1);
  doc.line(colMid, y, colMid, y + 32);
  doc.rect(leftMargin, y, availableWidth, 32);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Name    : ${data.customer_name || '-'}`, leftMargin + 2, y + 6);
  const addressLines = doc.splitTextToSize(
    `Address : ${data.customer_address || '-'}`,
    colMid - leftMargin - 4
  );
  doc.text(addressLines, leftMargin + 2, y + 12);
  doc.text(`State   : ${data.customer_state || '-'}`, leftMargin + 2, y + 22);
  doc.text(`GSTIN   : ${data.customer_gstin || '-'}`, leftMargin + 2, y + 28);

  // Invoice details right side
  const labelX = colMid + 2;
  const valueX = pageWidth - rightMargin - 2;
  doc.setFont("helvetica", "bold");
  doc.text("# Inv. No.     :", labelX, y + 6);
  doc.text("Inv. Date      :", labelX, y + 12);
  doc.text("Payment Mode   :", labelX, y + 18);
  doc.text("Place of Supply:", labelX, y + 24);
  doc.setFont("helvetica", "normal");
  doc.text(data.invoice_no.replace('RSG ', ''), valueX, y + 6, { align: "right" });
  doc.text(formatDate(data.invoice_date), valueX, y + 12, { align: "right" });
  doc.text(data.payment_mode, valueX, y + 18, { align: "right" });
  doc.text(data.place_of_supply || '-', valueX, y + 24, { align: "right" });
  y += 32;

  // ── ITEMS TABLE ──
  const tableRows: any[] = data.items.map((item, i) => [
    i + 1,
    item.particulars,
    item.hsn,
    Number(item.qty),
    formatINR(Number(item.rate)),
    formatINR(item.taxable_value),
    '18%',
    formatINR(item.cgst_amount + item.sgst_amount),
    formatINR(item.amount),
  ]);

  while (tableRows.length < 8) {
    tableRows.push(['', '', '', '', '', '', '', '', '', '', '']);
  }


  tableRows.push([
    { content: 'Sub-Total', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: data.items.reduce((s, i) => s + Number(i.qty), 0).toString(), styles: { fontStyle: 'bold', halign: 'center' } },
    { content: '' },
    { content: formatINR(data.taxable_amount), styles: { fontStyle: 'bold', halign: 'right' } },
    { content: '' },
    { content: formatINR(data.cgst + data.sgst), styles: { fontStyle: 'bold', halign: 'right' } },
    { content: formatINR(data.grand_total), styles: { fontStyle: 'bold', halign: 'right' } },
  ] as any[]);

  autoTable(doc, {
    startY: y,
    margin: { left: leftMargin, right: rightMargin },
    tableWidth: availableWidth,
    theme: 'grid',
    head: [[
      { content: 'Sr', styles: { halign: 'center' } },
      { content: 'Goods & Service Description', styles: { halign: 'center' } },
      { content: 'HSN', styles: { halign: 'center' } },
      { content: 'Qty', styles: { halign: 'center' } },
      { content: 'Rate', styles: { halign: 'center' } },
      { content: 'Taxable', styles: { halign: 'center' } },
      { content: 'GST%', styles: { halign: 'center' } },
      { content: 'GST Amt', styles: { halign: 'center' } },
      { content: 'Total', styles: { halign: 'center' } },
    ]],
    body: tableRows,
    styles: {
      fontSize: 5,
      cellPadding: 0.6,
      lineWidth: 0.1,
      textColor: 0,
      lineColor: 0,
    },
    headStyles: {
      fillColor: [220, 230, 241],
      textColor: 0,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 5,
    },
    columnStyles: {
      0:  { cellWidth: 5,  halign: 'center' },
      1:  { cellWidth: 38 },
      2:  { cellWidth: 14, halign: 'center' },
      3:  { cellWidth: 12,  halign: 'center' },
      4:  { cellWidth: 15, halign: 'right' },
      5:  { cellWidth: 17, halign: 'right' },
      6:  { cellWidth: 9,  halign: 'center' },
      7:  { cellWidth: 16, halign: 'right' },
      8:  { cellWidth: 12,  halign: 'center' },
    },
  });

  let fy = (doc as any).lastAutoTable.finalY;
  const freight = data.freight_charge || 0;
  const roundOff = Math.round(data.grand_total + freight) - (data.grand_total + freight);
  const roundedTotal = Math.round(data.grand_total + freight);

  // ✅ Check space — add empty rows or new page
  const pageHeight = doc.internal.pageSize.getHeight();
  const FOOTER_HEIGHT = 80;
  const remainingSpace = pageHeight - fy;

  if (remainingSpace < FOOTER_HEIGHT) {
  // Fill remaining space on current page
  const rowHeight = 3.7;
  const emptyRowsCurrentPage = (Math.floor(remainingSpace / rowHeight))-5;
  if (emptyRowsCurrentPage > 0) {
      autoTable(doc, {
        startY: fy,
        margin: { left: leftMargin, right: rightMargin },
        tableWidth: availableWidth,
        theme: 'plain', // ✅ no borders at all first
        body: Array(emptyRowsCurrentPage).fill(['', '', '', '', '', '', '', '', '']),
        styles: { fontSize: 5, cellPadding: 0.6, lineWidth: 0, textColor: 0 },
        columnStyles: {
          0: { cellWidth: 5 }, 1: { cellWidth: 38 }, 2: { cellWidth: 14 },
          3: { cellWidth: 12 }, 4: { cellWidth: 15 }, 5: { cellWidth: 17 },
          6: { cellWidth: 9 }, 7: { cellWidth: 16 }, 8: { cellWidth: 12 },
        },
        didDrawCell: (data) => {
          // Draw only left vertical line for each cell
          doc.setLineWidth(0.1);
          doc.setDrawColor(0);
          doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
          // Draw right border only for last column
          if (data.column.index === 8) {
            doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        
          // ✅ closing horizontal line at bottom of current page
        const bottomY = (doc as any).lastAutoTable.finalY + 20;
        doc.setLineWidth(0.1);
        doc.setDrawColor(0);
        doc.line(leftMargin, bottomY, leftMargin + availableWidth, bottomY);    
          }
        },
      });
    }

    // New page — fill with empty rows till footer reaches bottom
    doc.addPage();
    fy = 5;
    // ✅ top horizontal line on new page
    doc.setLineWidth(0.1);
    doc.setDrawColor(0);
    doc.line(leftMargin, fy, leftMargin + availableWidth, fy);
    const newPageHeight = doc.internal.pageSize.getHeight();
    const emptyRowsNewPage = Math.floor((newPageHeight - fy - FOOTER_HEIGHT) / rowHeight);
    if (emptyRowsNewPage > 0) {
      autoTable(doc, {
        startY: fy,
        margin: { left: leftMargin, right: rightMargin },
        tableWidth: availableWidth,
        theme: 'plain', // ✅ no borders at all first
        body: Array(emptyRowsNewPage).fill(['', '', '', '', '', '', '', '', '']),
        styles: { fontSize: 5, cellPadding: 0.6, lineWidth: 0, textColor: 0 },
        columnStyles: {
          0: { cellWidth: 5 }, 1: { cellWidth: 38 }, 2: { cellWidth: 14 },
          3: { cellWidth: 12 }, 4: { cellWidth: 15 }, 5: { cellWidth: 17 },
          6: { cellWidth: 9 }, 7: { cellWidth: 16 }, 8: { cellWidth: 12 },
        },
        didDrawCell: (data) => {
          // Draw only left vertical line for each cell
          doc.setLineWidth(0.1);
          doc.setDrawColor(0);
          doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
          // Draw right border only for last column
          if (data.column.index === 8) {
            doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
          }
        },
      });
      fy = (doc as any).lastAutoTable.finalY;
    }
} else {
    const rowHeight = 3.7;
    const emptyRowsNeeded = Math.floor((remainingSpace - FOOTER_HEIGHT) / rowHeight);
    if (emptyRowsNeeded > 0) {
      autoTable(doc, {
        startY: fy,
        margin: { left: leftMargin, right: rightMargin },
        tableWidth: availableWidth,
        theme: 'plain', // ✅ no borders at all first
        body: Array(emptyRowsNeeded).fill(['', '', '', '', '', '', '', '', '']),
        styles: { fontSize: 5, cellPadding: 0.6, lineWidth: 0, textColor: 0 },
        columnStyles: {
          0: { cellWidth: 5 }, 1: { cellWidth: 38 }, 2: { cellWidth: 14 },
          3: { cellWidth: 12 }, 4: { cellWidth: 15 }, 5: { cellWidth: 17 },
          6: { cellWidth: 9 }, 7: { cellWidth: 16 }, 8: { cellWidth: 12 },
        },
        didDrawCell: (data) => {
          // Draw only left vertical line for each cell
          doc.setLineWidth(0.1);
          doc.setDrawColor(0);
          doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
          // Draw right border only for last column
          if (data.column.index === 8) {
            doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
          }
        },
      });
      fy = (doc as any).lastAutoTable.finalY;
    }
  }




  // ── FOOTER ──
  // Bank details (left) + Summary (right)
  doc.setLineWidth(0.1);
  doc.rect(leftMargin, fy, availableWidth, 38);
  doc.line(colMid, fy, colMid, fy + 38);

  // Bank details
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("Bank Details", leftMargin + 2, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.text("Bank Name  : HDFC", leftMargin + 2, fy + 8);
  doc.text("Branch         : MADURAI MAIN", leftMargin + 2, fy + 13);
  doc.text("Account No : 50200074442432", leftMargin + 2, fy + 18);
  doc.text("IFSC Code  : HDFC0000123", leftMargin + 2, fy + 23);

 // Summary right - as table
  autoTable(doc, {
    startY: fy,
    margin: { left: colMid, right: rightMargin },
    tableWidth: availableWidth / 2,
    theme: 'grid',
    head: [[
      { content: 'SUMMARY', styles: { halign: 'left' } },
      { content: 'AMOUNT', styles: { halign: 'right' } },
    ]],
  body: [
  [
    { content: `CGST ${data.is_igst ? '-' : '9%'}`, styles: { halign: 'left' } },
    { content: data.is_igst ? '-' : formatINR(data.cgst), styles: { halign: 'right' } }
  ],
  [
    { content: `SGST ${data.is_igst ? '-' : '9%'}`, styles: { halign: 'left' } },
    { content: data.is_igst ? '-' : formatINR(data.sgst), styles: { halign: 'right' } }
  ],
  [
    { content: `IGST ${data.is_igst ? '18%' : '-'}`, styles: { halign: 'left' } },
    { content: data.is_igst ? formatINR(data.cgst + data.sgst) : '-', styles: { halign: 'right' } }
  ],
  [
    { content: 'Freight/Packing', styles: { halign: 'left' } },
    { content: freight > 0 ? formatINR(freight) : '-', styles: { halign: 'right' } }
  ],
  [
    { content: 'Round Off', styles: { halign: 'left' } },
    { content: roundOff !== 0 ? formatINR(Math.abs(roundOff)) : '0.00', styles: { halign: 'right' } }
  ],
],
    styles: {
      fontSize: 6,
      cellPadding: 0.8,
      lineWidth: 0.1,
      textColor: 0,
      lineColor: 0,
    },
    headStyles: {
      fillColor: [220, 230, 241],
      textColor: 0,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 22, halign: 'right' },
    },
  });

  const summaryFinalY = (doc as any).lastAutoTable.finalY;

  // Bank details box to match summary height
  doc.rect(leftMargin, fy, availableWidth / 2, summaryFinalY - fy);

  fy = summaryFinalY;
  // Total in words + Total amount

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Total Amount in Words", leftMargin + 2, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  const wordLines = doc.splitTextToSize(numberToWords(data.grand_total), colMid - leftMargin - 4);
  doc.text(wordLines, leftMargin + 2, fy + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Total Amount :", colMid + 2, fy + 5);
  doc.text(formatINR(Math.round(data.grand_total)), valueX, fy + 5, { align: "right" });
  fy += 14;

  // Declaration + Signature
  doc.rect(leftMargin, fy, availableWidth, 28);
  doc.line(colMid, fy, colMid, fy + 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Declaration", leftMargin + 2, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("1. Sold goods not returnable or exchanged.", leftMargin + 2, fy + 10);
  doc.text("2. Payment of credit bills settled within 10 days, else 24% p.a. interest.", leftMargin + 2, fy + 14);
  doc.text("3. Our responsibility ceases once goods handed over to carriers.", leftMargin + 2, fy + 18);
  doc.text("4. Subject to Madurai Jurisdiction only.", leftMargin + 2, fy + 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("For, RAJ SHREE GIFTS", valueX, fy + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", valueX, fy + 25, { align: "right" });
  fy += 28;

  // Thank you
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Thank You For Business With Us!", pageWidth / 2, fy + 5, { align: "center" });
};

export const generateBillPDF = (data: GSTBillData): jsPDF => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
  });
  generateSingleCopy(doc, data, 5, "Original / Duplicate Bill");

  return doc;
};