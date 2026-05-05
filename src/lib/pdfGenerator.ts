import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BillItem } from "@/components/BillTable";

interface BillData {
  customerName: string;
  billDate: string;
  showShopName: boolean;
  packingCharge: number | null;
  oldbalance: number | null;
  advPay: number | null;
  items: BillItem[];
  total: number;
}

const formatINR = (num: number) => {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(num);
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const generateBillPDF = (data: BillData): jsPDF => {
  const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: [148, 210],
});

  let y = 8;

 if (data.showShopName) {
  const leftX = 7;   // left margin
  const rightX = 136; // 148mm - 5mm right margin
  const centerX = 74; // center of 148mm page
  y+= 0.5; // small nudge down for better vertical centering within the box

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("GSTIN:33AXIPL9661R1ZK", leftX, y, { align: "left" });
  doc.text("PH:7708774707", rightX, y, { align: "right" });
  y += 2;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RAJ SHREE GIFTS", centerX, y, { align: "center" });
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("62A/82 West Avani Moola Street MADURAI -625001", centerX, y, { align: "center" });
  y += 4;
}

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("ESTIMATE", 74, y, { align: "center" });
  y += 1;

  const itemsForPdf = data.items.map((item, i) => ({
    no: i + 1,
    particulars: item.particulars,
    rate: item.rate,
    qty: item.qty,
    amount: item.amount,
    isSpecial: false,
  }));

  if (data.packingCharge && data.packingCharge > 0) {
    itemsForPdf.push({ no: 0, particulars: 'PACKING CHARGES', rate: '', qty: '', amount: data.packingCharge, isSpecial: true });
  }
  if (data.oldbalance && data.oldbalance > 0) {
    itemsForPdf.push({ no: 0, particulars: 'OLD BALANCE', rate: '', qty: '', amount: data.oldbalance, isSpecial: true });
  }
  if (data.advPay && data.advPay > 0) {
    itemsForPdf.push({ no: 0, particulars: 'ADVANCE PAID', rate: '', qty: '', amount: -data.advPay, isSpecial: true });
  }

  const grandTotal = itemsForPdf.reduce((s, it) => s + (it.amount || 0), 0);

  const ROWS_PER_PAGE = 30;

  // Fixed font and cell sizes — tuned to fit 32 rows (30 items + subtotal + grand total)
  // in 150mm page height with buffer for multi-line particulars
  const fontSize = data.showShopName ? 7 : 7;
  const cellPadding = data.showShopName ? 1 : 1.2;

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 5;
  const rightMargin = 10;
  const renderSafetyGap = 0.5;
  const availableWidth = pageWidth - leftMargin - rightMargin - renderSafetyGap;

  const baseWidths = { 0: 5, 1: 28, 2: 10, 3: 8, 4: 14 };
  const sumBase = Object.values(baseWidths).reduce((s, v) => s + v, 0);
  const scale = availableWidth / sumBase;
  const colWidths = {
    0: Math.max(6, Math.floor(baseWidths[0] * scale)),
    1: Math.max(10, Math.floor(baseWidths[1] * scale)),
    2: Math.max(8, Math.floor(baseWidths[2] * scale)),
    3: Math.max(6, Math.floor(baseWidths[3] * scale)),
    4: Math.max(8, Math.floor(baseWidths[4] * scale)),
  };
  const totalCols = Object.values(colWidths).reduce((s, v) => s + v, 0);
  const roundingGap = Math.round(availableWidth) - totalCols;
  if (roundingGap > 0) colWidths[1] += roundingGap;

  // Paginate — always in chunks of ROWS_PER_PAGE
  const pages: typeof itemsForPdf[] = [];
  for (let i = 0; i < itemsForPdf.length; i += ROWS_PER_PAGE) {
    pages.push(itemsForPdf.slice(i, i + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  pages.forEach((pageItems, pageIndex) => {
    // Always pad to exactly ROWS_PER_PAGE rows
    const padded = [...pageItems];
    while (padded.length < ROWS_PER_PAGE) {
      padded.push({ no: 0, particulars: '', rate: '', qty: '', amount: 0, isSpecial: false });
    }

    const pageSubtotal = pageItems.reduce((s, it) => s + (it.amount || 0), 0);

    const pageBody: any[] = padded.map((it: any) => {
      const noDisplay = it.no === 0 ? '' : it.no;
      const amountDisplay = it.particulars === '' ? '' : (it.amount || 0).toFixed(0);

      if (it.isSpecial) {
        return [
          { content: '', styles: { halign: 'center' } },
          { content: it.particulars, styles: { halign: 'center' } },
          { content: it.rate, styles: { halign: 'center' } },
          { content: it.qty, styles: { halign: 'center' } },
          { content: amountDisplay, styles: { halign: 'center' } },
        ];
      }

      return [noDisplay, it.particulars, it.rate, it.qty, amountDisplay];
    });

    // Subtotal row
    pageBody.push([
      { content: 'SUBTOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatINR(pageSubtotal), styles: { fontStyle: 'bold' } },
    ]);

    // Grand total only on last page
    if (pageIndex === pages.length - 1) {
      pageBody.push([
        { content: 'GRAND TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatINR(grandTotal), styles: { fontStyle: 'bold' } },
      ]);
    } else {
      // Keep consistent 32-row structure on non-last pages too
      pageBody.push([
        { content: '', colSpan: 5, styles: { halign: 'right' } },
      ]);
    }

    if (pageIndex > 0) {
       doc.addPage();
       y = 8;
    }
  const currentFontSize = pageIndex === 0 ? fontSize : (data.showShopName ? 6 : 6);
  const currentCellPadding = pageIndex === 0 ? cellPadding : (data.showShopName ? 1.5: 1.5);

    if (pageIndex === 0 && data.showShopName) {
  // draw a rectangle border around the shop name header
          const boxX = leftMargin;           // left margin
          const boxY = 5;           // top margin
          const boxW = availableWidth+0.5;         // 148mm - 5mm*2 margins
          const boxH = y - 5;       // height based on how much y has moved
          doc.setLineWidth(0.3);
          doc.setDrawColor(0);
          doc.rect(boxX, boxY, boxW, boxH);
}

    autoTable(doc, {
      startY: y,
      margin: { left: leftMargin, right: rightMargin },
      theme: 'grid',
      tableWidth: availableWidth,

      head: [
        [
          { content: `Party : ${data.customerName || '-'}`, colSpan: 3, styles: { halign: 'left' } },
          { content: `Date : ${formatDate(data.billDate)}`, colSpan: 2, styles: { halign: 'right' } },
        ],
        ['No', 'Particulars', 'Rate', 'Qty', 'Amount'],
      ],

      body: pageBody,

      styles: {
        fontSize: currentFontSize,
        cellPadding: currentCellPadding,
        lineWidth: 0.1,
        valign: 'middle',
        textColor: 0,
        lineColor: 0,
        // KEY: this allows multi-line text to wrap within the cell
        // instead of overflowing to next page
        overflow: 'linebreak',
        cellWidth: 'wrap',
      },

      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
        fontStyle: 'bold',
        halign: 'center',
      },

      columnStyles: {
        0: { cellWidth: colWidths[0], halign: 'center' },
        1: { cellWidth: colWidths[1] },
        2: { cellWidth: colWidths[2], halign: 'center' },
        3: { cellWidth: colWidths[3], halign: 'center' },
        4: { cellWidth: colWidths[4], halign: 'center' },
      },

      // Prevent jspdf-autotable from splitting rows across pages
      rowPageBreak: 'avoid',
    });
  });

  return doc;
};