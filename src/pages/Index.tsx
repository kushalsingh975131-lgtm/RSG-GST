import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Printer, Share2, ShoppingBag, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import BillTable, { type GSTBillItem } from '@/components/BillTable';
import NumericKeypad from '@/components/NumericKeypad';
import { supabase } from '@/lib/supabase';
import { generateBillPDF } from '@/lib/pdfGenerator';
import { useAuth } from '@/hooks/useAuth';


const createEmptyItem = (): GSTBillItem => ({
  id: crypto.randomUUID(),
  particulars: '',
  hsn: '',
  rate: '',
  qty: '',
  taxable_value: 0,
  cgst_amount: 0,
  sgst_amount: 0,
  amount: 0,
});

const Index = () => {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<GSTBillItem[]>([createEmptyItem()]);
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [activeField, setActiveField] = useState<{ row: number; field: 'rate' | 'qty' | 'particulars' | 'hsn' } | null>({ row: 0, field: 'particulars' });
  const [saving, setSaving] = useState(false);
  const [keypadEnabled, setKeypadEnabled] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIGST, setIsIGST] = useState(false);
  const [freightCharge, setFreightCharge] = useState('');

  const fetchGSTINDetails = async (gstin: string) => {
  if (gstin.length !== 15) return;
  try {
    const res = await fetch(`https://api.gstincheck.co.in/check/${import.meta.env.VITE_GSTIN_API_KEY}/${gstin}`);
    const data = await res.json();
    if (data.flag) {
      setCustomerName(data.data.tradeNam || data.data.lgnm || '');
      setCustomerAddress(data.data.pradr?.adr || '');
      setCustomerState(data.data.pradr?.addr?.stcd || '');
      setPlaceOfSupply(data.data.pradr?.addr?.stcd || '');
    }
  } catch (e) {
    console.log('GSTIN fetch failed', e);
    // silently fail
  }
};

  useEffect(() => {
    const check = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      setIsMobile(window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const taxable_amount = items.reduce((s, i) => s + i.taxable_value, 0);
  const cgst = items.reduce((s, i) => s + i.cgst_amount, 0);
  const sgst = items.reduce((s, i) => s + i.sgst_amount, 0);
  const grand_total = items.reduce((s, i) => s + i.amount, 0);
  const invoiceDate = new Date().toISOString().split("T")[0];

  const displayDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

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
        const newItem = createEmptyItem();
        setItems(prev => [...prev, newItem]);
        setTimeout(() => setActiveField({ row: items.length, field: 'particulars' }), 50);
      } else {
        setActiveField({ row: row + 1, field: 'particulars' });
      }
    }
  };

  const saveBill = async () => {
    if (items.every(i => i.amount === 0)) {
      toast({ title: 'Add items to save', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Get next invoice number
      const { data: invoiceNo, error: invoiceErr } = await (supabase as any).rpc('get_next_invoice_no');
    if (invoiceErr) throw invoiceErr;

      const { data: bill, error: billErr } = await supabase
        .from('gst_bills')
        .insert({
          invoice_no: invoiceNo,
          customer_name: customerName,
          customer_gstin: customerGstin,
          customer_address: customerAddress,
          customer_state: customerState,
          place_of_supply: placeOfSupply,
          payment_mode: paymentMode,
          invoice_date: invoiceDate,
          taxable_amount,
          cgst,
          sgst,
          grand_total,
        })
        .select()
        .single();

      if (billErr) throw billErr;

      const billItems = items.filter(i => i.amount > 0).map(i => ({
        bill_id: bill.id,
        particulars: i.particulars,
        hsn: i.hsn,
        rate: parseFloat(i.rate) || 0,
        qty: parseFloat(i.qty) || 0,
        taxable_value: i.taxable_value,
        cgst_amount: i.cgst_amount,
        sgst_amount: i.sgst_amount,
        amount: i.amount,
      }));

      const { error: itemsErr } = await (supabase as any).from('gst_bill_items').insert(billItems);
      if (itemsErr) throw itemsErr;

      toast({ title: `Bill ${invoiceNo} saved! ✨` });
      setItems([createEmptyItem()]);
      setCustomerName('');
      setCustomerGstin('');
      setCustomerAddress('');
      setCustomerState('');
      setPlaceOfSupply('');
      setPaymentMode('CASH');
      setActiveField({ row: 0, field: 'particulars' });
      setFreightCharge('');
      setIsIGST(false);
    } catch (err: any) {
      toast({ title: 'Error saving bill', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getBillData = () => ({
    invoice_no: 'DRAFT',
    invoice_date: invoiceDate,
    customer_name: customerName,
    customer_gstin: customerGstin,
    customer_address: customerAddress,
    customer_state: customerState,
    place_of_supply: placeOfSupply,
    payment_mode: paymentMode,
    is_igst: isIGST,
    freight_charge: parseFloat(freightCharge) || 0,
    items: items.filter(i => i.amount > 0),
    taxable_amount,
    cgst,
    sgst,
    grand_total,

  });

  const handlePrint = () => {
    const doc = generateBillPDF(getBillData());
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleShare = async () => {
    const doc = generateBillPDF(getBillData());
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 glass-card-gold border-b border-primary/20 px-4 py-3"
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-primary" size={22} />
            <h1 className="text-lg font-serif font-bold gold-text">RSG GST</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1">
                Admin
              </Link>
            )}
            <Link to="/login">
              <motion.button whileTap={{ scale: 0.95 }} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg border border-border/60">
                <LogIn size={14} />
                {user ? 'Account' : 'Admin Login'}
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.header>

      <main className="max-w-4xl mx-auto px-3 py-4 pb-32 md:pb-8">
        {/* Bill Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 mb-4 space-y-3"
        >
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={keypadEnabled} onCheckedChange={setKeypadEnabled} />
              <Label className="text-sm">Keypad</Label>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Customer Name</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="Party name" className="mt-1 bg-background/50" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Customer GSTIN</Label>
               <Input
                        value={customerGstin}
                        onChange={e => {
                        const val = e.target.value.toUpperCase();
                        setCustomerGstin(val);
                        fetchGSTINDetails(val);
                       }}
                        placeholder="GSTIN"
                        className="mt-1 bg-background/50"
                        maxLength={15}
                 />
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                placeholder="Address" className="mt-1 bg-background/50" />
            </div>
            <div className="w-32">
              <Label className="text-xs text-muted-foreground">State</Label>
              <Input value={customerState} onChange={e => setCustomerState(e.target.value)}
                placeholder="State" className="mt-1 bg-background/50" />
            </div>
            <div className="w-32">
              <Label className="text-xs text-muted-foreground">Place of Supply</Label>
              <Input value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)}
                placeholder="Place" className="mt-1 bg-background/50" />
            </div>
            <div className="w-32">
              <Label className="text-xs text-muted-foreground">Payment Mode</Label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
            <Switch checked={isIGST} onCheckedChange={setIsIGST} />
              <Label className="text-sm">IGST</Label>
            </div>

            <div className="w-28">
              <Label className="text-xs text-muted-foreground">Freight/Packing ₹</Label>
                  <Input
                    value={freightCharge}
                    onChange={e => setFreightCharge(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                    className="mt-1 bg-background/50"
                  />
            </div>
            <div className="w-28">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <div className="mt-1 py-2 px-3 text-sm bg-muted/50 rounded-md">{displayDate(invoiceDate)}</div>
            </div>
          </div>
        </motion.div>

        {/* Bill Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-3 mb-4"
        >
          <BillTable
            items={items}
            setItems={setItems}
            activeField={activeField}
            setActiveField={setActiveField}
            keypadEnabled={keypadEnabled}
          />
        </motion.div>

        {/* Totals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-card-gold p-4 mb-4"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Taxable Amount</span>
            <span className="font-medium">₹{taxable_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-muted-foreground">CGST (9%)</span>
            <span className="font-medium">₹{cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-muted-foreground">SGST (9%)</span>
            <span className="font-medium">₹{sgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-primary/20">
            <span className="font-serif text-lg font-bold">Grand Total</span>
            <span className="font-serif text-xl font-bold gold-text">₹{grand_total.toFixed(2)}</span>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <motion.button whileTap={{ scale: 0.96 }} onClick={saveBill} disabled={saving}
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl gold-gradient text-primary-foreground font-semibold text-sm shadow-lg disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Bill'}
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handlePrint}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm">
            <Printer size={16} /> Print
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleShare}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm">
            <Share2 size={16} /> Share
          </motion.button>
        </div>

        {/* Mobile Keypad */}
        {keypadEnabled && isMobile && !isLandscape && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 glass-card border-t border-border/60 pb-safe z-40">
            <NumericKeypad
              onKey={handleKeypadKey}
              onDelete={handleKeypadDelete}
              onEnter={handleKeypadEnter}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Index;