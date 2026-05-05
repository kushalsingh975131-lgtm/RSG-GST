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

  const rounded = Math.round(num);
  return 'Rupees ' + convert(rounded) + ' Only';
};

const generateSingleCopy = (doc: jsPDF, data: GSTBillData, startY: number, copyLabel: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 5;
  const rightMargin = 5;
  const availableWidth = pageWidth - leftMargin - rightMargin;
  let y = startY;

  // Tax Invoice title + copy label
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Tax Invoice", pageWidth / 2, y, { align: "center" });
  doc.text(copyLabel, pageWidth - rightMargin, y, { align: "right" });
  y += 4;

  // Outer border for this copy
  const copyHeight = 135;
  doc.setLineWidth(0.3);
  doc.rect(leftMargin, y, availableWidth, copyHeight);

  // ── HEADER ──
  doc.setLineWidth(0.1);
  // RSG box (logo area)
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 102, 204); 
  doc.text("RSG", leftMargin + 10, y + 8, { align: "center" });
  doc.setTextColor(0);
  doc.rect(leftMargin, y, 20, 18);

  // Shop details
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("GSTIN: 33AXIPL9661R1ZK", leftMargin + 27, y + 4);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RAJ SHREE GIFTS", leftMargin + 27, y + 9);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("62A/82 West Avani Moola Street, Madurai - 625001", leftMargin + 27, y + 14);
  doc.text("Ph: 77087 74707", leftMargin + 27, y + 18);

  // Header bottom border
  y += 20;
  doc.line(leftMargin, y, leftMargin + availableWidth, y);

  // ── BILL TO + INVOICE DETAILS ──
  const colMid = leftMargin + availableWidth / 2;
  doc.line(colMid, y, colMid, y + 30); // vertical divider

  // Bill To (left)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To", leftMargin + 2, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(`Name   : ${data.customer_name || '-'}`, leftMargin + 2, y + 10);
  const addressLines = doc.splitTextToSize(`Address: ${data.customer_address || '-'}`, colMid - leftMargin - 4);
  doc.text(addressLines, leftMargin + 2, y + 15);
  doc.text(`State  : ${data.customer_state || '-'}`, leftMargin + 2, y + 20);
  doc.text(`GSTIN  : ${data.customer_gstin || '-'}`, leftMargin + 2, y + 25);

  // Invoice details (right)
  doc.setFont("helvetica", "bold");
  doc.text(`# Inv. No.  :`, colMid + 2, y + 5);
  doc.text(`Inv. Date   :`, colMid + 2, y + 10);
  doc.text(`Payment Mode:`, colMid + 2, y + 15);
  doc.text(`Place of Supply:`, colMid + 2, y + 20);
  doc.setFont("helvetica", "normal");
  doc.text(data.invoice_no, colMid + 35, y + 5);
  doc.text(formatDate(data.invoice_date), colMid + 35, y + 10);
  doc.text(data.payment_mode, colMid + 35, y + 15);
  doc.text(data.place_of_supply || '-', colMid + 35, y + 20);

  y += 30;
  doc.line(leftMargin, y, leftMargin + availableWidth, y);

  // ── ITEMS TABLE ──
const tableRows = data.items.map((item, i) => [
  i + 1,
  item.particulars,
  item.hsn,
  Number(item.qty),
  formatINR(Number(item.rate)),
  formatINR(item.taxable_value),
  '18%',
  formatINR(item.cgst_amount),
  formatINR(item.amount),
]);

  // Pad to minimum 8 rows
  while (tableRows.length < 8) {
    tableRows.push(['', '', '', '', '', '', '', '', '']);
  }

  // Subtotal row
  tableRows.push([
    { content: 'Sub-Total', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: data.items.reduce((s, i) => s + Number(i.qty), 0).toString(), styles: { fontStyle: 'bold' } },
    { content: '', },
    { content: formatINR(data.taxable_amount), styles: { fontStyle: 'bold' } },
    { content: '', },
    { content: formatINR(data.cgst), styles: { fontStyle: 'bold' } },
    { content: formatINR(data.grand_total), styles: { fontStyle: 'bold' } },
  ]as any[]);

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
      fontSize: 5.5,
      cellPadding: 0.6,
      lineWidth: 0.1,
      textColor: 0,
      lineColor: 0,
    },
    headStyles: {
      fontSize: 5.5,
      fillColor: [220, 230, 241],
      textColor: 0,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 14, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 8, halign: 'center' },
      7: { cellWidth: 14, halign: 'right' },
      8: { cellWidth: 16, halign: 'right' },
    },
  });

  const afterTable = (doc as any).lastAutoTable.finalY;
  let fy = afterTable;

  // ── FOOTER ──
  doc.line(leftMargin, fy, leftMargin + availableWidth, fy);

  // Bank details (left) + Summary (right)
  const summaryX = colMid + 2;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Our Bank Details", leftMargin + 2, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.text("Bank Name  : HDFC", leftMargin + 2, fy + 10);
  doc.text("Branch     : MADURAI MAIN", leftMargin + 2, fy + 15);
  doc.text("Account No : 50200074442432", leftMargin + 2, fy + 20);
  doc.text("IFSC Code  : HDFC0000123", leftMargin + 2, fy + 25);

  // Summary (right)
  doc.setFont("helvetica", "bold");
  doc.text("SUMMARY", summaryX + 20, fy + 5, { align: "center" });
  doc.text("AMOUNT", pageWidth - rightMargin - 2, fy + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("CGST Amt :", summaryX, fy + 10);
  doc.text(formatINR(data.cgst), pageWidth - rightMargin - 2, fy + 10, { align: "right" });
  doc.text("SGST Amt :", summaryX, fy + 15);
  doc.text(formatINR(data.sgst), pageWidth - rightMargin - 2, fy + 15, { align: "right" });

  doc.line(colMid, fy, colMid, fy + 30);
  doc.line(leftMargin, fy + 30, leftMargin + availableWidth, fy + 30);

  fy += 30;

  // Total in words + Total amount
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Total in Word", leftMargin + 2, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(numberToWords(data.grand_total), leftMargin + 2, fy + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Total Amount :", summaryX, fy + 5);
  doc.text(formatINR(data.grand_total), pageWidth - rightMargin - 2, fy + 5, { align: "right" });
  doc.line(colMid, fy, colMid, fy + 15);
  doc.line(leftMargin, fy + 15, leftMargin + availableWidth, fy + 15);

  fy += 15;

  // Declaration + Signature
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Declaration", leftMargin + 2, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("1. Sold goods not returnable or exchanged.", leftMargin + 2, fy + 10);
  doc.text("2. Payment of credit bills must be settled within 10 days, else 24% p.a. interest charged.", leftMargin + 2, fy + 14);
  doc.text("3. Our responsibility ceases once goods are handed over to carriers.", leftMargin + 2, fy + 18);
  doc.text("4. Subject to Madurai Jurisdiction only.", leftMargin + 2, fy + 22);

  doc.line(colMid, fy, colMid, fy + 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("For, RAJ SHREE GIFTS", pageWidth - rightMargin - 2, fy + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", pageWidth - rightMargin - 2, fy + 25, { align: "right" });

  doc.line(leftMargin, fy + 28, leftMargin + availableWidth, fy + 28);

  // Thank you
  doc.setFontSize(7);
  doc.text("Thank You For Business With Us!", pageWidth / 2, fy + 33, { align: "center" });
};

export const generateBillPDF = (data: GSTBillData): jsPDF => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
  });

  // Original copy (top half)
  generateSingleCopy(doc, data, 5, "Original /DuplicateBill");

  return doc;
  //dupli
};