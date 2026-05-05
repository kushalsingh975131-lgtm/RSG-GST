import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Printer, Share2, Trash2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase, formatPid, parsePidNumber } from '@/lib/supabase';
import BillTable, { type BillItem } from '@/components/BillTable';
import NumericKeypad from '@/components/NumericKeypad';
import { generateBillPDF } from '@/lib/pdfGenerator';

interface Bill {
  id: string;
  customer_name: string;
  bill_date: string;
  show_shop_name: boolean;
  packing_charge: number | null;
  old_balance: number | null;
  adv_pay: number | null;
  total: number;
  created_at: string;
}

const ViewBillsTab = () => {
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [customerName, setCustomerName] = useState('');
  const [showShopName, setShowShopName] = useState(true);
  const [packingCharge, setPackingCharge] = useState('');
  const [oldbalance, setoldbalance] = useState('');
  const [advPay, setAdvPay] = useState('');
  const [activeField, setActiveField] = useState<{ row: number; field: 'rate' | 'qty' | 'pid' } | null>(null);
  // keypad toggle and mobile/orientation helpers
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
    let currentValue = field === 'pid' ? item.pid : field === 'rate' ? item.rate : item.qty;

    // For PID, work with raw number
    if (field === 'pid') {
      const rawNumber = parsePidNumber(currentValue);
      currentValue = rawNumber === '0' ? '' : rawNumber;
    }

    const newValue = currentValue + key;

    setItems(prev => {
      const updated = [...prev];
      const upItem = { ...updated[activeField.row] };
      if (field === 'pid') {
        // Format the PID
        upItem.pid = /^\d+$/.test(newValue) ? formatPid(newValue) : newValue;
      } else if (field === 'rate') {
        upItem.rate = newValue;
      } else {
        upItem.qty = newValue;
      }
      upItem.amount = (parseFloat(upItem.rate) || 0) * (parseFloat(upItem.qty) || 0);
      updated[activeField.row] = upItem;
      return updated;
    });
  };

  const handleKeypadDelete = () => {
    if (!activeField) return;
    const item = items[activeField.row];
    if (!item) return;
    const field = activeField.field;
    let currentValue = field === 'pid' ? item.pid : field === 'rate' ? item.rate : item.qty;

    // For PID, work with raw number
    if (field === 'pid') {
      const rawNumber = parsePidNumber(currentValue);
      currentValue = rawNumber === '0' ? '' : rawNumber;
    }

    const newValue = currentValue.slice(0, -1);

    setItems(prev => {
      const updated = [...prev];
      const upItem = { ...updated[activeField.row] };
      if (field === 'pid') {
        // Format the PID
        upItem.pid = /^\d+$/.test(newValue) ? formatPid(newValue) : newValue;
      } else if (field === 'rate') {
        upItem.rate = newValue;
      } else {
        upItem.qty = newValue;
      }
      upItem.amount = (parseFloat(upItem.rate) || 0) * (parseFloat(upItem.qty) || 0);
      updated[activeField.row] = upItem;
      return updated;
    });
  };

 const handleKeypadEnter = () => {
  if (!activeField) return;

  const { row, field } = activeField;

  if (field === "pid") {
    setActiveField({ row, field: "rate" });
  }
  else if (field === "rate") {
    setActiveField({ row, field: "qty" });
  } 
  else if (field === "qty") {

    if (row === items.length - 1) {

      const newItem: BillItem = {
        id: crypto.randomUUID(),
        pid: "0",
        particulars: "GIFT ARTICLES",
        rate: "",
        qty: "",
        amount: 0,
      };

      setItems(prev => [...prev, newItem]);

      setTimeout(() => {
        setActiveField({ row: row + 1, field: "rate" });
      }, 50);

    } else {
      setActiveField({ row: row + 1, field: "rate" });
    }
  }
};
  const packing = parseFloat(packingCharge) || 0;
  const old = parseFloat(oldbalance) || 0;
  const advPayValue = parseFloat(advPay) || 0;
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const total = subtotal + packing + old - advPayValue;
  const fetchBills = async () => {
    const { data, error } = await supabase.from('bills').select('*').order('created_at', { ascending: false });
    if (error) toast({ title: 'Error', variant: 'destructive' });
    else setBills(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBills(); }, []);

  const openBill = async (bill: Bill) => {
    setSelectedBill(bill);
    setCustomerName(bill.customer_name);
    setShowShopName(bill.show_shop_name);
    setPackingCharge(bill.packing_charge ? String(bill.packing_charge) : '');
    setoldbalance(bill.old_balance ? String(bill.old_balance) : '');
    setAdvPay(bill.adv_pay ? String(bill.adv_pay) : '');

    const { data } = await supabase.from('bill_items').select('*').eq('bill_id', bill.id);
    if (data) {
      setItems(data.map(d => ({
        id: d.id,
        pid: d.pid,
        particulars: d.particulars,
        rate: String(d.rate),
        qty: String(d.qty),
        amount: d.amount,
      })));
      const checks: Record<string, boolean> = {};
      data.forEach(d => { checks[d.id] = d.checked; });
      setCheckedItems(checks);
      // do not auto-focus when opening for edit
    }
  };

  const saveBillUpdate = async () => {
    if (!selectedBill) return;
    const packing = parseFloat(packingCharge) || 0;
    const old = parseFloat(oldbalance) || 0;
    const advPayValue = parseFloat(advPay) || 0;
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const total = subtotal + packing + old - advPayValue;

    await supabase.from('bills').update({
      customer_name: customerName,
      show_shop_name: showShopName,
      packing_charge: packing > 0 ? packing : null,
      old_balance: old > 0 ? old : null,
      adv_pay: advPayValue > 0 ? advPayValue : null,
      total,
    }).eq('id', selectedBill.id);

    // Delete old items and re-insert
    await supabase.from('bill_items').delete().eq('bill_id', selectedBill.id);
    const newItems = items.filter(i => i.amount > 0).map(i => ({
      bill_id: selectedBill.id,
      id: i.id,
      pid: i.pid,
      particulars: i.particulars,
      rate: parseFloat(i.rate) || 0,
      qty: parseFloat(i.qty) || 0,
      amount: i.amount,
      checked: checkedItems[i.id] || false,
    }));
    await supabase.from('bill_items').insert(newItems);

    toast({ title: 'Bill updated ✨' });
    fetchBills();
  };

  const deleteBill = async (id: string) => {
    await supabase.from('bills').delete().eq('id', id);
    toast({ title: 'Bill deleted' });
    setSelectedBill(null);
    fetchBills();
  };

  const handlePrint = () => {
    if (!selectedBill) return;
    const packing = parseFloat(packingCharge) || 0;
    const old = parseFloat(oldbalance) || 0;
    const advPayValue = parseFloat(advPay) || 0;
    const total = items.reduce((s, i) => s + i.amount, 0) + packing + old - advPayValue;
    const doc = generateBillPDF({
      customerName, billDate: selectedBill.bill_date, showShopName,
      packingCharge: packing > 0 ? packing : null,
      oldbalance: old > 0 ? old : null,
      advPay: advPayValue > 0 ? advPayValue : null,
      items: items.filter(i => i.amount > 0), total,
    });
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleShare = async () => {
    if (!selectedBill) return;
    const packing = parseFloat(packingCharge) || 0;
    const old = parseFloat(oldbalance) || 0;
    const advPayValue = parseFloat(advPay) || 0;
    const total = items.reduce((s, i) => s + i.amount, 0) + packing + old - advPayValue;
    const doc = generateBillPDF({
      customerName, billDate: selectedBill.bill_date, showShopName,
      packingCharge: packing > 0 ? packing : null,
      oldbalance: old > 0 ? old : null,
      advPay: advPayValue > 0 ? advPayValue : null,
      items: items.filter(i => i.amount > 0), total,
    });
    const blob = doc.output('blob');

    if (navigator.share) {
      try {
        const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
        const cleanName = customerName.replace(/\s+/g, "_");
        const file = new File([blob], `RSG GST_${cleanName}_${today}.pdf`, { type: 'application/pdf' });
        await navigator.share({ files: [file] });
      } catch {
        // fallback
        doc.save(`bill_${Date.now()}.pdf`);
      }
    } else {
      doc.save(`bill_${Date.now()}.pdf`);
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">RSG GST...</div>;

  if (selectedBill) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pb-10 overflow-y-auto">
        <button onClick={() => setSelectedBill(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back to Bills
        </button>

        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-4">
            <Switch checked={keypadEnabled} onCheckedChange={setKeypadEnabled} />
            <Label className="text-sm">Custom keypad</Label>
          </div>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Customer</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showShopName} onCheckedChange={setShowShopName} />
              <Label className="text-xs">Shop Name</Label>
            </div>
            <div className="w-24">
              <Label className="text-xs text-muted-foreground">Packing ₹</Label>
              <Input value={packingCharge} onChange={e => setPackingCharge(e.target.value)} inputMode="numeric" className="mt-1" />
            </div>
            <div className="w-24">
              <Label className="text-xs text-muted-foreground">Old Balance ₹</Label>
              <Input value={oldbalance} onChange={e => setoldbalance(e.target.value)} inputMode="numeric" className="mt-1" />
            </div>
            <div className="w-24">
              <Label className="text-xs text-muted-foreground">Advance ₹</Label>
              <Input value={advPay} onChange={e => setAdvPay(e.target.value)} inputMode="numeric" className="mt-1" />
            </div>
          </div>
        </div>

        <div className="glass-card p-3 pb-60">
          <BillTable
            items={items} setItems={setItems}
            activeField={activeField} setActiveField={setActiveField}
            showChecklist checkedItems={checkedItems}
            onCheckToggle={id => setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }))}
            keypadEnabled={keypadEnabled}
          />
          <div className="flex justify-end mt-3 font-semibold">
             Total: ₹{total.toLocaleString("en-IN")}
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
      <h2 className="font-serif text-lg font-bold">Bills</h2>
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
                    <p className="text-xs text-muted-foreground">{new Date(bill.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <span className="font-serif font-bold text-primary">₹{bill.total}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewBillsTab;
