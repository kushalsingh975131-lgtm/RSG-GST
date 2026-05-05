import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, LogOut, FileText, Package, PlusCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import InventoryTab from '@/components/admin/InventoryTab';
import ViewBillsTab from '@/components/admin/ViewBillsTab';

const Admin = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/login');
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <ShoppingBag className="text-primary" size={32} />
        </motion.div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 glass-card-gold border-b border-primary/20 px-4 py-3"
      >
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-primary" size={22} />
            <h1 className="text-lg font-serif font-bold gold-text">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1">
              Create Bill
            </Link>
            <button
              onClick={() => { signOut(); navigate('/'); }}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </motion.header>

      <main className="max-w-5xl mx-auto px-3 py-4">
        <Tabs defaultValue="bills" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4 bg-muted/50 rounded-xl p-1">
            <TabsTrigger value="create" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <PlusCircle size={14} className="mr-1" /> Create
            </TabsTrigger>
            <TabsTrigger value="bills" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText size={14} className="mr-1" /> Bills
            </TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Package size={14} className="mr-1" /> Inventory
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <div className="text-center py-8">
              <Link to="/" className="gold-gradient text-primary-foreground font-semibold px-6 py-3 rounded-xl inline-flex items-center gap-2">
                <PlusCircle size={18} /> Go to Bill Creation
              </Link>
            </div>
          </TabsContent>
          <TabsContent value="bills">
            <ViewBillsTab />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
