import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { API_URL } from '@/config/apiBaseUrl';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setIsSubmitted(true);
      toast.success('Check your email for a password reset link');
    } catch (error) {
      // Still show success message for security (don't reveal if email exists)
      setIsSubmitted(true);
      toast.success('If an account exists, a reset link has been sent');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen pt-36 lg:pt-40 pb-20 bg-gray-50 flex items-center">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
              <p className="text-gray-600 mb-6">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                The link will expire in 1 hour. Check your spam folder if you don&apos;t see the email.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => setIsSubmitted(false)}
                  variant="outline"
                  className="w-full"
                >
                  Try Another Email
                </Button>
                <Link to="/login" className="block">
                  <Button className="w-full bg-[#006332] hover:bg-[#005028] text-white">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-36 lg:pt-40 pb-20 bg-gray-50 flex items-center">
      <div className="container mx-auto px-4 max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">Forgot Password?</h1>
          <p className="text-base md:text-lg text-gray-600">
            No worries, we&apos;ll send you reset instructions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Mail className="w-6 h-6 text-[#006332]" />
              Reset Password
            </CardTitle>
            <CardDescription>Enter your email address and we&apos;ll send you a link to reset your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@facility.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-12"
                  data-testid="forgot-password-email"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#006332] to-[#00a550] hover:from-[#005028] hover:to-[#008844] text-white shadow-lg hover:shadow-xl transition-all duration-300"
                data-testid="forgot-password-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
              <Link to="/login" className="flex items-center justify-center gap-2 text-[#006332] hover:underline">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
