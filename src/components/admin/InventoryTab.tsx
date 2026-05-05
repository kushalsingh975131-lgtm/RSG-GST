import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Save, X, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface InventoryItem {
  id: string;
  pid: string;
  name: string;
  purchase_price: number;
  qty: number;
}

const InventoryTab = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', purchase_price: '', qty: '' });
  const [addForm, setAddForm] = useState({ name: '', purchase_price: '', qty: '' });
  const [showAdd, setShowAdd] = useState(false);

  const fetchItems = async () => {
    const { data, error } = await supabase.from('inventory').select('*').order('pid');
    if (error) toast({ title: 'Error loading inventory', variant: 'destructive' });
    else setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const addItem = async () => {
    if (!addForm.name) return;
    const { data: pid } = await supabase.rpc('get_next_pid');
    const { error } = await supabase.from('inventory').insert({
      pid: pid as string,
      name: addForm.name,
      purchase_price: parseFloat(addForm.purchase_price) || 0,
      qty: parseFloat(addForm.qty) || 0,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Item added ✨' });
      setAddForm({ name: '', purchase_price: '', qty: '' });
      setShowAdd(false);
      fetchItems();
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, purchase_price: String(item.purchase_price), qty: String(item.qty) });
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from('inventory').update({
      name: editForm.name,
      purchase_price: parseFloat(editForm.purchase_price) || 0,
      qty: parseFloat(editForm.qty) || 0,
    }).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Updated ✨' });
      setEditingId(null);
      fetchItems();
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) toast({ title: 'Error', variant: 'destructive' });
    else { toast({ title: 'Deleted' }); fetchItems(); }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-serif text-lg font-bold">Inventory</h2>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-sm font-medium gold-gradient text-primary-foreground px-4 py-2 rounded-xl"
        >
          <Plus size={16} /> Add Item
        </motion.button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="glass-card p-4 flex gap-2 flex-wrap items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className="mt-1" />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground">Price</label>
                <Input value={addForm.purchase_price} onChange={e => setAddForm({ ...addForm, purchase_price: e.target.value })} inputMode="numeric" className="mt-1" />
              </div>
              <div className="w-20">
                <label className="text-xs text-muted-foreground">Qty</label>
                <Input value={addForm.qty} onChange={e => setAddForm({ ...addForm, qty: e.target.value })} inputMode="numeric" className="mt-1" />
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={addItem} className="p-2 rounded-lg bg-primary text-primary-foreground"><Save size={18} /></motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">PID</th>
              <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="py-2 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Price</th>
              <th className="py-2 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Qty</th>
              <th className="py-2 px-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <motion.tr key={item.id} layout className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="py-2 px-3 font-mono text-xs font-medium text-primary">{item.pid}</td>
                <td className="py-2 px-3">
                  {editingId === item.id ? (
                    <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-7 text-sm" />
                  ) : item.name}
                </td>
                <td className="py-2 px-3 text-right">
                  {editingId === item.id ? (
                    <Input value={editForm.purchase_price} onChange={e => setEditForm({ ...editForm, purchase_price: e.target.value })} className="h-7 text-sm text-right w-20 ml-auto" inputMode="numeric" />
                  ) : `₹${item.purchase_price}`}
                </td>
                <td className="py-2 px-3 text-right">
                  {editingId === item.id ? (
                    <Input value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} className="h-7 text-sm text-right w-16 ml-auto" inputMode="numeric" />
                  ) : (
                    <span className={item.qty <= 5 ? 'text-destructive font-semibold flex items-center justify-end gap-1' : ''}>
                      {item.qty <= 5 && <AlertTriangle size={12} />}
                      {item.qty}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3">
                  <div className="flex gap-1 justify-end">
                    {editingId === item.id ? (
                      <>
                        <button onClick={() => saveEdit(item.id)} className="p-1 text-primary hover:text-primary/80"><Save size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(item)} className="p-1 text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
                        <button onClick={() => deleteItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No inventory items yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryTab;
