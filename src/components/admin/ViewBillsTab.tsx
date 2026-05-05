import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Printer, Share2, Trash2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import BillTable, { type GSTBillItem } from '@/components/BillTable';
import NumericKeypad from '@/components/NumericKeypad';
import { generateBillPDF } from '@/lib/pdfGenerator';

interface GSTBill {
  id: string;
  invoice_no: string;
  customer_name: string;
  customer_gstin: string;
  customer_address: string;
  customer_state: string;
  place_of_supply: string;
  payment_mode: string;
  invoice_date: string;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  grand_total: number;
  created_at: string;
}

const ViewBillsTab = () => {
  const { toast } = useToast();
  const [bills, setBills] = useState<GSTBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<GSTBill | null>(null);
  const [items, setItems] = useState<GSTBillItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [activeField, setActiveField] = useState<{ row: number; field: 'rate' | 'qty' | 'particulars' | 'hsn' } | null>(null);
  const [keypadEnabled, setKeypadEnabled] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      setIsMobile(window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (items.length > 0 && !activeField) {
      setActiveField({ row: 0, field: 'rate' });
    }
  }, [items]);

  const handleKeypadKey = (key: string) => {
    if (!activeField) return;
    const item = items[activeField.row];
    if (!item) return;
    const field = activeField.field;
    if (field === 'particulars' || field === 'hsn') return;
    const currentValue = field === 'rate' ? item.rate : item.qty;
    const newValue = currentValue + key;
    setItems(prev => {
      const updated = [...prev];
      const upItem = { ...updated[activeField.row] };
      if (field === 'rate') upItem.rate = newValue;
      else upItem.qty = newValue;
      const taxable_value = (parseFloat(upItem.rate) || 0) * (parseFloat(upItem.qty) || 0);
      upItem.taxable_value = taxable_value;
      upItem.cgst_amount = taxable_value * 0.09;
      upItem.sgst_amount = taxable_value * 0.09;
      upItem.amount = taxable_value * 1.18;
      updated[activeField.row] = upItem;
      return updated;
    });
  };

  const handleKeypadDelete = () => {
    if (!activeField) return;
    const item = items[activeField.row];
    if (!item) return;
    const field = activeField.field;
    if (field === 'particulars' || field === 'hsn') return;
    const currentValue = field === 'rate' ? item.rate : item.qty;
    const newValue = currentValue.slice(0, -1);
    setItems(prev => {
      const updated = [...prev];
      const upItem = { ...updated[activeField.row] };
      if (field === 'rate') upItem.rate = newValue;
      else upItem.qty = newValue;
      const taxable_value = (parseFloat(upItem.rate) || 0) * (parseFloat(upItem.qty) || 0);
      upItem.taxable_value = taxable_value;
      upItem.cgst_amount = taxable_value * 0.09;
      upItem.sgst_amount = taxable_value * 0.09;
      upItem.amount = taxable_value * 1.18;
      updated[activeField.row] = upItem;
      return updated;
    });
  };

  const handleKeypadEnter = () => {
    if (!activeField) return;
    const { row, field } = activeField;
    if (field === 'particulars') setActiveField({ row, field: 'rate' });
    else if (field === 'rate') setActiveField({ row, field: 'qty' });
    else if (field === 'qty') {
      if (row === items.length - 1) {
        const newItem: GSTBillItem = {
          id: crypto.randomUUID(),
          particulars: '',
          hsn: '',
          rate: '',
          qty: '',
          taxable_value: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          amount: 0,
        };
        setItems(prev => [...prev, newItem]);
        setTimeout(() => setActiveField({ row: row + 1, field: 'particulars' }), 50);
      } else {
        setActiveField({ row: row + 1, field: 'particulars' });
      }
    }
  };

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from('gst_bills')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Error', variant: 'destructive' });
    else setBills(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBills(); }, []);

  const openBill = async (bill: GSTBill) => {
    setSelectedBill(bill);
    setCustomerName(bill.customer_name);
    setCustomerGstin(bill.customer_gstin || '');
    setCustomerAddress(bill.customer_address || '');
    setCustomerState(bill.customer_state || '');
    setPlaceOfSupply(bill.place_of_supply || '');
    setPaymentMode(bill.payment_mode || 'CASH');

    const { data } = await supabase
      .from('gst_bill_items')
      .select('*')
      .eq('bill_id', bill.id);

    if (data) {
      setItems(data.map(d => ({
        id: d.id,
        particulars: d.particulars,
        hsn: d.hsn,
        rate: String(d.rate),
        qty: String(d.qty),
        taxable_value: d.taxable_value,
        cgst_amount: d.cgst_amount,
        sgst_amount: d.sgst_amount,
        amount: d.amount,
      })));
    }
  };

  const saveBillUpdate = async () => {
    if (!selectedBill) return;
    const taxable_amount = items.reduce((s, i) => s + i.taxable_value, 0);
    const cgst = items.reduce((s, i) => s + i.cgst_amount, 0);
    const sgst = items.reduce((s, i) => s + i.sgst_amount, 0);
    const grand_total = items.reduce((s, i) => s + i.amount, 0);

    await (supabase as any).from('gst_bills').update({
      customer_name: customerName,
      customer_gstin: customerGstin,
      customer_address: customerAddress,
      customer_state: customerState,
      place_of_supply: placeOfSupply,
      payment_mode: paymentMode,
      taxable_amount,
      cgst,
      sgst,
      grand_total,
    }).eq('id', selectedBill.id);

    await (supabase as any).from('gst_bill_items').delete().eq('bill_id', selectedBill.id);
    await (supabase as any).from('gst_bill_items').insert(
      items.filter(i => i.amount > 0).map(i => ({
        bill_id: selectedBill.id,
        particulars: i.particulars,
        hsn: i.hsn,
        rate: parseFloat(i.rate) || 0,
        qty: parseFloat(i.qty) || 0,
        taxable_value: i.taxable_value,
        cgst_amount: i.cgst_amount,
        sgst_amount: i.sgst_amount,
        amount: i.amount,
      }))
    );

    toast({ title: 'Bill updated ✨' });
    fetchBills();
  };

  const deleteBill = async (id: string) => {
    await (supabase as any).from('gst_bills').delete().eq('id', id);
    toast({ title: 'Bill deleted' });
    setSelectedBill(null);
    fetchBills();
  };

  const handlePrint = () => {
    if (!selectedBill) return;
    const taxable_amount = items.reduce((s, i) => s + i.taxable_value, 0);
    const cgst = items.reduce((s, i) => s + i.cgst_amount, 0);
    const sgst = items.reduce((s, i) => s + i.sgst_amount, 0);
    const grand_total = items.reduce((s, i) => s + i.amount, 0);
    const doc = generateBillPDF({
      invoice_no: selectedBill.invoice_no,
      invoice_date: selectedBill.invoice_date,
      customer_name: customerName,
      customer_gstin: customerGstin,
      customer_address: customerAddress,
      customer_state: customerState,
      place_of_supply: placeOfSupply,
      payment_mode: paymentMode,
      items: items.filter(i => i.amount > 0),
      taxable_amount,
      cgst,
      sgst,
      grand_total,
    });
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleShare = async () => {
    if (!selectedBill) return;
    const taxable_amount = items.reduce((s, i) => s + i.taxable_value, 0);
    const cgst = items.reduce((s, i) => s + i.cgst_amount, 0);
    const sgst = items.reduce((s, i) => s + i.sgst_amount, 0);
    const grand_total = items.reduce((s, i) => s + i.amount, 0);
    const doc = generateBillPDF({
      invoice_no: selectedBill.invoice_no,
      invoice_date: selectedBill.invoice_date,
      customer_name: customerName,
      customer_gstin: customerGstin,
      customer_address: customerAddress,
      customer_state: customerState,
      place_of_supply: placeOfSupply,
      payment_mode: paymentMode,
      items: items.filter(i => i.amount > 0),
      taxable_amount,
      cgst,
      sgst,
      grand_total,
    });
    const blob = doc.output('blob');
    if (navigator.share) {
      try {
        const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
        const cleanName = customerName.replace(/\s+/g, "_");
        const file = new File([blob], `RSG_GST_${cleanName}_${today}.pdf`, { type: 'application/pdf' });
        await navigator.share({ files: [file] });
      } catch {
        doc.save(`gst_bill_${Date.now()}.pdf`);
      }
    } else {
      doc.save(`gst_bill_${Date.now()}.pdf`);
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  if (selectedBill) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pb-10 overflow-y-auto">
        <button onClick={() => setSelectedBill(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back to Bills
        </button>

        <div className="glass-card p-4 space-y-3">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Customer Name</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">GSTIN</Label>
              <Input value={customerGstin} onChange={e => setCustomerGstin(e.target.value)} className="mt-1" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="mt-1" />
            </div>
            <div className="w-28">
              <Label className="text-xs text-muted-foreground">State</Label>
              <Input value={customerState} onChange={e => setCustomerState(e.target.value)} className="mt-1" />
            </div>
            <div className="w-28">
              <Label className="text-xs text-muted-foreground">Place of Supply</Label>
              <Input value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} className="mt-1" />
            </div>
            <div className="w-28">
              <Label className="text-xs text-muted-foreground">Payment Mode</Label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card p-3 pb-60">
          <BillTable
            items={items}
            setItems={setItems}
            activeField={activeField}
            setActiveField={setActiveField}
            keypadEnabled={keypadEnabled}
          />
          <div className="flex justify-end mt-3 space-y-1 text-right">
            <div>
              <p className="text-sm text-muted-foreground">Taxable: ₹{items.reduce((s, i) => s + i.taxable_value, 0).toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">CGST: ₹{items.reduce((s, i) => s + i.cgst_amount, 0).toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">SGST: ₹{items.reduce((s, i) => s + i.sgst_amount, 0).toFixed(2)}</p>
              <p className="font-bold text-lg">Total: ₹{items.reduce((s, i) => s + i.amount, 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {keypadEnabled && isMobile && !isLandscape && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-background border-t border-border pb-safe z-40"
          >
            <NumericKeypad
              onKey={handleKeypadKey}
              onDelete={handleKeypadDelete}
              onEnter={handleKeypadEnter}
            />
          </motion.div>
        )}

        <div className="flex gap-2 flex-wrap">
          <motion.button whileTap={{ scale: 0.96 }} onClick={saveBillUpdate} className="flex-1 py-3 rounded-xl gold-gradient text-primary-foreground font-semibold text-sm">Save Changes</motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handlePrint} className="py-3 px-4 rounded-xl bg-secondary text-secondary-foreground text-sm"><Printer size={16} /></motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleShare} className="py-3 px-4 rounded-xl bg-secondary text-secondary-foreground text-sm"><Share2 size={16} /></motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => deleteBill(selectedBill.id)} className="py-3 px-4 rounded-xl bg-destructive text-destructive-foreground text-sm"><Trash2 size={16} /></motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-lg font-bold">GST Bills</h2>
      {bills.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No bills yet</div>
      ) : (
        <div className="space-y-2">
          {bills.map((bill, i) => (
            <motion.button
              key={bill.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => openBill(bill)}
              className="w-full glass-card p-4 text-left hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-primary" />
                  <div>
                    <p className="font-medium text-sm">{bill.customer_name || 'No name'}</p>
                    <p className="text-xs text-muted-foreground">{bill.invoice_no} • {new Date(bill.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <span className="font-serif font-bold text-primary">₹{bill.grand_total}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewBillsTab;