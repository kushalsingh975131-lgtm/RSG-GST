import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, LogIn, ArrowLeft } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// ===== PERMANENT USER (commented out) =====
/*
const PERMANENT_USER = {
  phone: '8940202421',
  password: 'Rajshree77',
};
*/
// ===== END PERMANENT USER =====

const Login = () => {
  const { signIn, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ===== CREATE PERMANENT USER FUNCTION (Comment out or remove after creating user) =====
  /*const createPermanentUser = async () => {
    setLoading(true);
    const { error } = await signUp(PERMANENT_USER.phone, PERMANENT_USER.password);
    setLoading(false);
    if (error) {
      toast({ 
        title: 'User creation failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } else {
      toast({ 
        title: 'User created successfully! ✨', 
        description: `Phone: +91${PERMANENT_USER.phone}` 
      });
      setPhone(PERMANENT_USER.phone);
      setPassword(PERMANENT_USER.password);
    }
  };*/
  // ===== END CREATE USER FUNCTION =====

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast({ title: 'Enter phone number and password', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signIn(phone, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Welcome back! ✨' });
      navigate('/admin');
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card-gold p-8 w-full max-w-sm text-center space-y-4"
        >
          <ShoppingBag className="mx-auto text-primary" size={40} />
          <h2 className="font-serif text-xl font-bold">Logged In</h2>
          <p className="text-sm text-muted-foreground">{user.phone}</p>
          <div className="flex flex-col gap-2">
            <Link to="/admin" className="w-full py-3 rounded-xl gold-gradient text-primary-foreground font-semibold text-sm text-center">
              Go to Admin Panel
            </Link>
            <button
              onClick={() => { signOut(); navigate('/'); }}
              className="w-full py-3 rounded-xl bg-muted text-foreground font-medium text-sm"
            >
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="glass-card-gold p-8 w-full max-w-sm space-y-6"
      >
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="text-center space-y-2">
          <motion.div
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <ShoppingBag className="mx-auto text-primary" size={44} />
          </motion.div>
          <h1 className="font-serif text-2xl font-bold gold-text">ALogin</h1>
          <p className="text-sm text-muted-foreground">RSG GST</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label className="text-sm">Phone Number</Label>
            <div className="flex gap-2 mt-1">
              <span className="flex items-center px-3 text-sm bg-muted rounded-lg border border-border">+91</span>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                inputMode="tel"
                className="flex-1 bg-background/50"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 bg-background/50"
            />
          </div>
          {/* Create user button - commented out after creation */}
          {/*
          <button
            type="button"
            onClick={createPermanentUser}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating User...' : 'Create Permanent User'}
          </button>
          */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl gold-gradient text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            <LogIn size={18} />
            {loading ? 'Signing in...' : 'Sign In'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
