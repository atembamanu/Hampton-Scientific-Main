import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Phone, Mail, Menu, X, User } from 'lucide-react';
import axios from 'axios';

import { Button } from './ui/button';
import { HamptonLogo } from './HamptonLogo';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '@/config/apiBaseUrl';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [siteInfo, setSiteInfo] = useState({ phone: '', email: '' });

  useEffect(() => {
    axios.get(`${API_URL}/api/settings`).then(res => {
      if (res.data) setSiteInfo(res.data);
    }).catch(() => {});
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'Training', path: '/training' },
    { name: 'About', path: '/about' },
    { name: 'Get In Touch', path: '/contact' }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        {/* Top bar */}
        <div className="hidden md:flex items-center justify-end gap-6 py-2 text-sm border-b border-gray-100">
          {siteInfo.phone && <a href={`tel:${siteInfo.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-gray-600 hover:text-[#006332] transition-colors duration-300">
            <Phone className="w-4 h-4" />
            <span>{siteInfo.phone}</span>
          </a>}
          {siteInfo.email && <a href={`mailto:${siteInfo.email}`} className="flex items-center gap-2 text-gray-600 hover:text-[#006332] transition-colors duration-300">
            <Mail className="w-4 h-4" />
            <span>{siteInfo.email}</span>
          </a>}
        </div>

        {/* Main navigation */}
        <div className="flex items-center justify-between py-4">
          <Link to="/" className="group hover:opacity-90 transition-opacity">
            <HamptonLogo size="default" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative text-base font-medium transition-colors duration-300 hover:text-[#006332] ${
                  isActive(link.path) ? 'text-[#006332]' : 'text-gray-700'
                } group`}
              >
                {link.name}
                <span
                  className={`absolute -bottom-1 left-0 h-0.5 bg-[#006332] transition-all duration-300 ${
                    isActive(link.path) ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            {isAuthenticated ? (
              <Link to="/profile">
                <Button variant="outline" className="border-[#006332] text-[#006332] hover:bg-[#006332] hover:text-white transition-all duration-300" data-testid="profile-btn">
                  <User className="w-4 h-4 mr-2" />
                  {user?.firstName || 'My Profile'}
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button variant="outline" className="border-[#006332] text-[#006332] hover:bg-[#006332] hover:text-white transition-all duration-300" data-testid="login-btn">
                  <User className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </Link>
            )}
            <Link to="/contact">
              <Button className="bg-[#006332] hover:bg-[#005028] text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                Request Quote
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 text-gray-700 hover:text-[#006332] transition-colors duration-300"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-gray-100">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`block py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                  isActive(link.path)
                    ? 'text-[#006332] bg-green-50'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-[#006332]'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="mt-4 space-y-3">
              {isAuthenticated ? (
                <Link to="/profile" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="outline" className="w-full border-[#006332] text-[#006332]">
                    <User className="w-4 h-4 mr-2" />
                    {user?.firstName || 'My Profile'}
                  </Button>
                </Link>
              ) : (
                <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="outline" className="w-full border-[#006332] text-[#006332]">
                    <User className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                </Link>
              )}
              <Link to="/contact" onClick={() => setIsMenuOpen(false)} className="block mt-3">
                <Button className="w-full bg-[#006332] hover:bg-[#005028] text-white">
                  Request Quote
                </Button>
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
