import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Printer, Share2, ShoppingBag, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import BillTable, { type BillItem } from '@/components/BillTable';
import NumericKeypad from '@/components/NumericKeypad';
import { supabase, formatPid, parsePidNumber } from '@/lib/supabase';
import { generateBillPDF } from '@/lib/pdfGenerator';
import { useAuth } from '@/hooks/useAuth';

const createEmptyItem = (): BillItem => ({
  id: crypto.randomUUID(),
  pid: '0',
  particulars: 'GIFT ARTICLES',
  rate: '',
  qty: '',
  amount: 0,
});

const Index = () => {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<BillItem[]>([createEmptyItem()]);
  const [customerName, setCustomerName] = useState('');
  const [showShopName, setShowShopName] = useState(false);
  const [packingEnabled, setPackingEnabled] = useState(false);
  const [packingCharge, setPackingCharge] = useState('');
  const [oldEnabled, setoldEnabled] = useState(false);
  const [oldbalance, setoldbalance] = useState('');
  const [advPayEnabled, setAdvPayEnabled] = useState(false);
  const [advPay, setAdvPay] = useState('');
  const [activeField, setActiveField] = useState<{ row: number; field: 'rate' | 'qty' | 'pid' } | null>({ row: 0, field: 'rate' });
  const [saving, setSaving] = useState(false);
  const [keypadEnabled, setKeypadEnabled] = useState(true);
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

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const packing = packingEnabled ? (parseFloat(packingCharge) || 0) : 0;
  const old = oldEnabled ? (parseFloat(oldbalance) || 0) : 0;
  const advPayValue = advPayEnabled ? (parseFloat(advPay) || 0) : 0;
  const total = subtotal + packing + old - advPayValue;
  const billDate = new Date().toISOString().split("T")[0];
  const displayDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`;
};

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
    if (activeField.field === 'pid') {
      setActiveField({ row: activeField.row, field: 'rate' });
    } else if (activeField.field === 'rate') {
      setActiveField({ row: activeField.row, field: 'qty' });
    } else if (activeField.field === 'qty') {
      if (activeField.row === items.length - 1) {
        const newItem = createEmptyItem();
        setItems(prev => [...prev, newItem]);
        setTimeout(() => setActiveField({ row: items.length, field: 'rate' }), 50);
      } else {
        setActiveField({ row: activeField.row + 1, field: 'rate' });
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
      const { data: bill, error: billErr } = await supabase
        .from('bills')
        .insert({
          customer_name: customerName,
          bill_date: new Date().toISOString().split('T')[0],
          show_shop_name: showShopName,
          packing_charge: packing > 0 ? packing : null,
          old_balance: old > 0 ? old : null,
          adv_pay: advPayValue > 0 ? advPayValue : null,
          total,
        })
        .select()
        .single();

      if (billErr) throw billErr;

      const billItems = items.filter(i => i.amount > 0).map(i => ({
        bill_id: bill.id,
        pid: /^\d+$/.test(i.pid) ? formatPid(i.pid) : i.pid,
        particulars: i.particulars,
        rate: parseFloat(i.rate) || 0,
        qty: parseFloat(i.qty) || 0,
        amount: i.amount,
      }));

      const { error: itemsErr } = await supabase.from('bill_items').insert(billItems);
      if (itemsErr) throw itemsErr;

      // Reduce inventory for non-zero PIDs
      for (const item of billItems) {
        if (item.pid !== '0' && item.pid !== 'RSG0') {
          await supabase.rpc('reduce_inventory', { p_pid: item.pid, p_qty: item.qty });
        }
      }

      toast({ title: 'Bill saved successfully! ✨' });
      setItems([createEmptyItem()]);
      setCustomerName('');
      setPackingCharge('');
      setoldbalance('');
      setAdvPay('');
      setActiveField({ row: 0, field: 'rate' });
    } catch (err: any) {
      toast({ title: 'Error saving bill', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const doc = generateBillPDF({
      customerName, billDate, showShopName,
      packingCharge: packing > 0 ? packing : null,
      oldbalance: old > 0 ? old : null,
      advPay: advPayValue > 0 ? advPayValue : null,
      items: items.filter(i => i.amount > 0), total,
    });
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleShare = async () => {
    const doc = generateBillPDF({
      customerName, billDate, showShopName,
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
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch id="shopName" checked={showShopName} onCheckedChange={setShowShopName} />
              <Label htmlFor="shopName" className="text-sm">Shop Name</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={keypadEnabled} onCheckedChange={setKeypadEnabled} />
              <Label className="text-sm">keypad</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="packing" checked={packingEnabled} onCheckedChange={setPackingEnabled} />
              <Label htmlFor="packing" className="text-sm">Packing Charges</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="oldBalance" checked={oldEnabled} onCheckedChange={setoldEnabled} />
              <Label htmlFor="oldBalance" className="text-sm">Old Balance</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="advPay" checked={advPayEnabled} onCheckedChange={setAdvPayEnabled} />
              <Label htmlFor="advPay" className="text-sm">Advance</Label>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Customer Name</Label>
              <Input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Party name"
                className="mt-1 bg-background/50"
              />
            </div>
            {packingEnabled && (
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Packing ₹</Label>
                <Input
                  value={packingCharge}
                  onChange={e => setPackingCharge(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="mt-1 bg-background/50"
                />
              </div>
            )}
            {oldEnabled && (
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Old Balance ₹</Label>
                <Input
                  value={oldbalance}
                  onChange={e => setoldbalance(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="mt-1 bg-background/50"
                />
              </div>
            )}
            {advPayEnabled && (
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Advance ₹</Label>
                <Input
                  value={advPay}
                  onChange={e => setAdvPay(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="mt-1 bg-background/50"
                />
              </div>
            )}
            <div className="w-28">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <div className="mt-1 py-2 px-3 text-sm bg-muted/50 rounded-md">{displayDate(billDate)}</div>
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
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-medium">₹{subtotal.toFixed(0)}</span>
          </div>
          {packing > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-muted-foreground">Packing</span>
              <span className="font-medium">₹{packing.toFixed(0)}</span>
            </div>
          )} 
          {old > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-muted-foreground">Old Balance</span>
              <span className="font-medium">₹{old.toFixed(0)}</span>
            </div>  
          )}
          {advPayValue > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-muted-foreground">Advance</span>
              <span className="font-medium">- ₹{advPayValue.toFixed(0)}</span>
            </div>  
          )}
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-primary/20">
            <span className="font-serif text-lg font-bold">Grand Total</span>
            <span className="font-serif text-xl font-bold gold-text">₹{total.toFixed(0)}</span>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={saveBill}
            disabled={saving}
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl gold-gradient text-primary-foreground font-semibold text-sm shadow-lg disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Bill'}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handlePrint}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm"
          >
            <Printer size={16} /> Print
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleShare}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm"
          >
            <Share2 size={16} /> Share
          </motion.button>
        </div>

        {/* Mobile Keypad */}
        {keypadEnabled && isMobile && !isLandscape && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 glass-card border-t border-border/60 pb-safe z-40"
          >
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
//hey//
