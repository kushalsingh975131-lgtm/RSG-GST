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
  doc.text(data.invoice_no, valueX, y + 6, { align: "right" });
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
    '9%',
    formatINR(item.cgst_amount),
    '9%',
    formatINR(item.sgst_amount),
    formatINR(item.amount),
  ]);

  while (tableRows.length < 8) {
    tableRows.push(['', '', '', '', '', '', '', '', '', '', '']);
  }

  const roundOff = Math.round(data.grand_total) - data.grand_total;

  tableRows.push([
    { content: 'Sub-Total', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: data.items.reduce((s, i) => s + Number(i.qty), 0).toString(), styles: { fontStyle: 'bold', halign: 'center' } },
    { content: '' },
    { content: formatINR(data.taxable_amount), styles: { fontStyle: 'bold', halign: 'right' } },
    { content: '' },
    { content: formatINR(data.cgst), styles: { fontStyle: 'bold', halign: 'right' } },
    { content: '' },
    { content: formatINR(data.sgst), styles: { fontStyle: 'bold', halign: 'right' } },
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
      { content: 'CGST%', styles: { halign: 'center' } },
      { content: 'CGST Amt', styles: { halign: 'center' } },
      { content: 'SGST%', styles: { halign: 'center' } },
      { content: 'SGST Amt', styles: { halign: 'center' } },
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
      1:  { cellWidth: 32 },
      2:  { cellWidth: 10, halign: 'center' },
      3:  { cellWidth: 8,  halign: 'center' },
      4:  { cellWidth: 12, halign: 'right' },
      5:  { cellWidth: 14, halign: 'right' },
      6:  { cellWidth: 8,  halign: 'center' },
      7:  { cellWidth: 12, halign: 'right' },
      8:  { cellWidth: 8,  halign: 'center' },
      9:  { cellWidth: 12, halign: 'right' },
      10: { cellWidth: 17, halign: 'right' },
    },
  });

  let fy = (doc as any).lastAutoTable.finalY;

  // ── FOOTER ──
  // Bank details (left) + Summary (right)
  doc.setLineWidth(0.1);
  doc.rect(leftMargin, fy, availableWidth, 38);
  doc.line(colMid, fy, colMid, fy + 38);

  // Bank details
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("Our Bank Details", leftMargin + 2, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.text("Bank Name  : HDFC", leftMargin + 2, fy + 10);
  doc.text("Branch     : MADURAI MAIN", leftMargin + 2, fy + 15);
  doc.text("Account No : 50200074442432", leftMargin + 2, fy + 20);
  doc.text("IFSC Code  : HDFC0000123", leftMargin + 2, fy + 25);

  // Summary right
  const summaryX = colMid + 2;
  // Summary header
  doc.setFillColor(220, 230, 241);
  doc.rect(colMid, fy, availableWidth / 2, 6, 'F');
  doc.setFont("helvetica", "bold");
  doc.text("SUMMARY", colMid + 20, fy + 4, { align: "center" });
  doc.text("AMOUNT", valueX, fy + 4, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.text("CGST Amt :", summaryX, fy + 11);
  doc.text(formatINR(data.cgst), valueX, fy + 11, { align: "right" });
  doc.text("SGST Amt :", summaryX, fy + 17);
  doc.text(formatINR(data.sgst), valueX, fy + 17, { align: "right" });
  doc.text("IGST Amt :", summaryX, fy + 23);
  doc.text("-", valueX, fy + 23, { align: "right" });
  doc.text("Freight/Packing :", summaryX, fy + 29);
  doc.text("-", valueX, fy + 29, { align: "right" });
  doc.text("Round off :", summaryX, fy + 35);
  doc.text(formatINR(Math.abs(roundOff)), valueX, fy + 35, { align: "right" });

  fy += 38;

  // Total in words + Total amount
  doc.rect(leftMargin, fy, availableWidth, 14);
  doc.line(colMid, fy, colMid, fy + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Invoice Total in Word", leftMargin + 2, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  const wordLines = doc.splitTextToSize(numberToWords(data.grand_total), colMid - leftMargin - 4);
  doc.text(wordLines, leftMargin + 2, fy + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Total Amount :", summaryX, fy + 5);
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