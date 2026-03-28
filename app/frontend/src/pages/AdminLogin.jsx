import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Lock, Loader2 } from 'lucide-react';
import { API_URL } from '@/config/apiBaseUrl';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // Check if already logged in as admin
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const adminUser = localStorage.getItem('admin_user');
    if (token && adminUser) {
      const user = JSON.parse(adminUser);
      if (user.role === 'admin') {
        navigate('/sysadmin/dashboard');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    console.log('Admin login attempt with email:', formData.email);

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email: formData.email,
        password: formData.password
      });
      
      const { access_token, user } = response.data;
      
      // Check if user is admin
      if (user.role !== 'admin') {
        toast.error('Access denied. Admin credentials required.');
        setIsLoading(false);
        return;
      }
      
      // Store admin session separately
      localStorage.setItem('admin_token', access_token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      
      toast.success('Welcome to Admin Dashboard');
      navigate('/sysadmin/dashboard');
      
    } catch (error) {
      console.error('Admin login error:', error);
      const message = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src="/hampton-logo.svg" 
            alt="Hampton Scientific"
            className="h-14 w-auto mx-auto mb-6 brightness-0 invert"
          />
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
        </div>

        <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#00a550]" />
              System Administrator
            </CardTitle>
            <CardDescription className="text-gray-400">
              Enter your admin credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-gray-300">Email Address</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@hamptonscientific.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-12 bg-gray-700/50 border-gray-600 text-white placeholder-gray-500 focus:border-[#00a550]"
                  data-testid="admin-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-gray-300">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-12 bg-gray-700/50 border-gray-600 text-white placeholder-gray-500 focus:border-[#00a550]"
                  data-testid="admin-password-input"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-[#006332] hover:bg-[#005028] text-white font-semibold transition-all"
                disabled={isLoading}
                data-testid="admin-login-btn"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Access Dashboard'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center text-gray-500 text-sm mt-6">
          Authorized personnel only. All access is logged.
        </p>
      </div>
    </div>
  );
};
