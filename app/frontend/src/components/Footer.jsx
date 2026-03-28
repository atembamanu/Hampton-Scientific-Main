import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Facebook, Loader2, Linkedin, Mail, MapPin, Phone, Send, Twitter } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import { HamptonLogo } from './HamptonLogo';
import { API_URL } from '@/config/apiBaseUrl';

// Default contact info as fallback
const defaultContactInfo = {
  address: '',
  poBox: '',
  phone: '',
  email: ''
};

export const Footer = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [contactInfo, setContactInfo] = useState(defaultContactInfo);

  // Fetch site settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/settings`);
        setContactInfo({
          address: response.data.address || defaultContactInfo.address,
          poBox: response.data.po_box || defaultContactInfo.poBox,
          phone: response.data.phone || defaultContactInfo.phone,
          email: response.data.email || defaultContactInfo.email
        });
      } catch (error) {
        // Keep using default contact info
      }
    };
    fetchSettings();
  }, []);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/newsletter/subscribe`, { email });
      setIsSubscribed(true);
      toast.success('Successfully subscribed to our newsletter!');
      setEmail('');
    } catch (error) {
      if (error.response?.status === 400) {
        toast.info('You are already subscribed!');
        setIsSubscribed(true);
      } else {
        toast.error('Failed to subscribe. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="mb-4">
              <HamptonLogo size="small" className="brightness-0 invert" />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Connecting Africa's healthcare sector with global scientific and healthcare innovations.
            </p>
            <div className="flex gap-4 mt-6">
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-[#006332] transition-all hover:scale-110">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-[#006332] transition-all hover:scale-110">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-[#006332] transition-all hover:scale-110">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-gray-400 hover:text-[#00a550] transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-gray-400 hover:text-[#00a550] transition-colors text-sm">
                  Products
                </Link>
              </li>
              <li>
                <Link to="/training" className="text-gray-400 hover:text-[#00a550] transition-colors text-sm">
                  Training Programs
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-400 hover:text-[#00a550] transition-colors text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-[#00a550] transition-colors text-sm">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Our Services</h3>
            <ul className="space-y-3">
              <li className="text-gray-400 text-sm">Medical Equipment Supply</li>
              <li className="text-gray-400 text-sm">Laboratory Consumables</li>
              <li className="text-gray-400 text-sm">Equipment Installation</li>
              <li className="text-gray-400 text-sm">Technical Training</li>
              <li className="text-gray-400 text-sm">Maintenance Services</li>
            </ul>
          </div>

          {/* Contact Info & Newsletter */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Contact Us</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <MapPin className="w-5 h-5 text-[#00a550] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-400">
                  <p>{contactInfo.address}</p>
                  <p className="mt-1">{contactInfo.poBox}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Phone className="w-5 h-5 text-[#00a550] flex-shrink-0" />
                <a href={`tel:${contactInfo.phone}`} className="text-sm text-gray-400 hover:text-[#00a550] transition-colors">
                  {contactInfo.phone}
                </a>
              </div>
              <div className="flex gap-3">
                <Mail className="w-5 h-5 text-[#00a550] flex-shrink-0" />
                <a href={`mailto:${contactInfo.email}`} className="text-sm text-gray-400 hover:text-[#00a550] transition-colors">
                  {contactInfo.email}
                </a>
              </div>
            </div>
            
            {/* Newsletter Signup */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <h4 className="text-sm font-semibold mb-3 text-white">Subscribe to Newsletter</h4>
              {isSubscribed ? (
                <div className="flex items-center gap-2 text-[#00a550] text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Thanks for subscribing!</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00a550] transition-colors"
                    disabled={isLoading}
                    data-testid="newsletter-email-input"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-3 py-2 bg-[#006332] hover:bg-[#005028] rounded-lg transition-colors disabled:opacity-50"
                    data-testid="newsletter-submit-btn"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} Hampton Scientific Limited. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
