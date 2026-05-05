import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface GSTBillItem {
  id: string;
  particulars: string;
  hsn: string;
  rate: string;
  qty: string;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  amount: number;
}

interface HSNCode {
  code: string;
  description: string;
}

interface BillTableProps {
  items: GSTBillItem[];
  setItems: React.Dispatch<React.SetStateAction<GSTBillItem[]>>;
  activeField: { row: number; field: 'rate' | 'qty' | 'particulars' | 'hsn' } | null;
  setActiveField: (f: { row: number; field: 'rate' | 'qty' | 'particulars' | 'hsn' } | null) => void;
  keypadEnabled?: boolean;
}

const GST_RATE = 0.18;
const CGST_RATE = 0.09;
const SGST_RATE = 0.09;

const calculateAmounts = (rate: string, qty: string) => {
  const r = parseFloat(rate) || 0;
  const q = parseFloat(qty) || 0;
  const taxable_value = r * q;
  const cgst_amount = taxable_value * CGST_RATE;
  const sgst_amount = taxable_value * SGST_RATE;
  const amount = taxable_value + cgst_amount + sgst_amount;
  return { taxable_value, cgst_amount, sgst_amount, amount };
};

const BillTable = ({
  items, setItems, activeField, setActiveField, keypadEnabled
}: BillTableProps) => {
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const prevRowRef = useRef<number | null>(null);
  const [hsnCodes, setHsnCodes] = useState<HSNCode[]>([]);
  const [hsnDropdownRow, setHsnDropdownRow] = useState<number | null>(null);

  const isMobileRaw = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
  const mobileWithKeypad = isMobileRaw && keypadEnabled !== false;

  // Fetch HSN codes from Supabase
  useEffect(() => {
    supabase.from('hsn_codes').select('code, description').then(({ data }) => {
      if (data) setHsnCodes(data);
    });
  }, []);

  const setRef = useCallback((key: string) => (el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(key, el);
    else inputRefs.current.delete(key);
  }, []);

  useEffect(() => {
    if (activeField) {
      const key = `${activeField.row}-${activeField.field}`;
      const el = inputRefs.current.get(key);
      if (el) {
        el.focus();
        if (prevRowRef.current !== activeField.row) {
          setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
        }
        prevRowRef.current = activeField.row;
      }
    }
  }, [activeField]);

  const updateItem = (index: number, field: keyof GSTBillItem, value: string) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      const amounts = calculateAmounts(
        field === 'rate' ? value : item.rate,
        field === 'qty' ? value : item.qty
      );
      updated[index] = { ...item, ...amounts };
      return updated;
    });
  };

  const addRow = () => {
    const newItem: GSTBillItem = {
      id: crypto.randomUUID(),
      particulars: '',
      hsn: hsnCodes[0]?.code || '',
      rate: '',
      qty: '',
      taxable_value: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      amount: 0,
    };
    setItems(prev => [...prev, newItem]);
    setTimeout(() => setActiveField({ row: items.length, field: 'particulars' }), 50);
  };

  const deleteRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, field: 'rate' | 'qty' | 'particulars' | 'hsn') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'particulars') setActiveField({ row, field: 'rate' });
      else if (field === 'rate') setActiveField({ row, field: 'qty' });
      else if (field === 'qty') {
        if (row === items.length - 1) addRow();
        else setActiveField({ row: row + 1, field: 'particulars' });
      }
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="bill-table w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="w-10 text-center">S.No</th>
            <th>Particulars</th>
            <th className="w-24 text-center">HSN</th>
            <th className="w-20 text-right">Rate</th>
            <th className="w-16 text-right">Qty</th>
            <th className="w-24 text-right">Taxable</th>
            <th className="w-20 text-right">CGST</th>
            <th className="w-20 text-right">SGST</th>
            <th className="w-24 text-right">Amount</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {items.map((item, i) => (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className={`border-b border-border/40 ${activeField?.row === i ? 'bg-primary/5' : ''}`}
              >
                <td className="text-muted-foreground text-center">{i + 1}</td>
                <td>
                  <input
                    ref={setRef(`${i}-particulars`)}
                    value={item.particulars}
                    onChange={e => updateItem(i, 'particulars', e.target.value)}
                    onFocus={() => setActiveField({ row: i, field: 'particulars' })}
                    onClick={() => setActiveField({ row: i, field: 'particulars' })}
                    onKeyDown={e => handleKeyDown(e, i, 'particulars')}
                    className="w-full"
                    placeholder="Item description"
                  />
                </td>
                <td className="relative">
                  {/* HSN Dropdown */}
                  <div
                    className="w-full text-center cursor-pointer border border-border/40 rounded px-1 py-1 text-sm hover:border-primary/50 transition-colors"
                    onClick={() => setHsnDropdownRow(hsnDropdownRow === i ? null : i)}
                  >
                    {item.hsn || 'Select'}
                  </div>
                  {hsnDropdownRow === i && (
                    <div className="absolute z-50 top-full left-0 bg-background border border-border rounded-lg shadow-lg min-w-[200px] mt-1">
                      {hsnCodes.map(h => (
                        <button
                          key={h.code}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 transition-colors"
                          onClick={() => {
                            updateItem(i, 'hsn', h.code);
                            setHsnDropdownRow(null);
                          }}
                        >
                          <span className="font-bold">{h.code}</span> — {h.description}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <input
                    ref={setRef(`${i}-rate`)}
                    value={item.rate}
                    onChange={e => updateItem(i, 'rate', e.target.value)}
                    onFocus={() => setActiveField({ row: i, field: 'rate' })}
                    onClick={() => setActiveField({ row: i, field: 'rate' })}
                    onKeyDown={e => handleKeyDown(e, i, 'rate')}
                    className="w-full text-right font-medium"
                    inputMode={mobileWithKeypad ? 'none' : 'decimal'}
                    readOnly={mobileWithKeypad}
                  />
                </td>
                <td>
                  <input
                    ref={setRef(`${i}-qty`)}
                    value={item.qty}
                    onChange={e => updateItem(i, 'qty', e.target.value)}
                    onFocus={() => setActiveField({ row: i, field: 'qty' })}
                    onClick={() => setActiveField({ row: i, field: 'qty' })}
                    onKeyDown={e => handleKeyDown(e, i, 'qty')}
                    className="w-full text-right"
                    inputMode={mobileWithKeypad ? 'none' : 'numeric'}
                    readOnly={mobileWithKeypad}
                  />
                </td>
                <td className="text-right text-muted-foreground text-xs">
                  {item.taxable_value > 0 ? `₹${item.taxable_value.toFixed(2)}` : ''}
                </td>
                <td className="text-right text-muted-foreground text-xs">
                  {item.cgst_amount > 0 ? `₹${item.cgst_amount.toFixed(2)}` : ''}
                </td>
                <td className="text-right text-muted-foreground text-xs">
                  {item.sgst_amount > 0 ? `₹${item.sgst_amount.toFixed(2)}` : ''}
                </td>
                <td className="text-right font-semibold">
                  {item.amount > 0 ? `₹${item.amount.toFixed(2)}` : ''}
                </td>
                <td>
                  <button
                    onClick={() => deleteRow(i)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={addRow}
        className="mt-2 flex items-center gap-1 text-sm text-primary font-medium px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors"
      >
        <Plus size={16} /> Add Row
      </motion.button>
    </div>
  );
};

export default BillTable;