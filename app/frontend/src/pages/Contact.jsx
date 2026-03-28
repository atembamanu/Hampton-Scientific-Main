import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, FileText, MapPin, Mail, MessageSquare, Phone, Send, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { API_URL } from '@/config/apiBaseUrl';

// Default contact info as fallback
const defaultContactInfo = {
  address: 'Ushuru Pension Plaza, Muthangari Drive Block C, First Floor',
  poBox: 'P.O. Box 162 - 00517 Westlands, Nairobi',
  phone: '0717 023 814',
  email: 'info@hamptonscientific.com',
  working_hours: 'Mon - Fri: 8:00 AM - 5:00 PM EAT'
};

export const Contact = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('contact');
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
          email: response.data.email || defaultContactInfo.email,
          working_hours: response.data.working_hours || defaultContactInfo.working_hours
        });
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        // Keep using default contact info
      }
    };
    fetchSettings();
  }, []);
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['contact', 'quote', 'training'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location]);

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const [quoteForm, setQuoteForm] = useState({
    facilityName: '',
    contactPerson: '',
    email: '',
    phone: '',
    productCategory: '',
    specificProducts: '',
    quantity: '',
    message: ''
  });

  const [trainingForm, setTrainingForm] = useState({
    facilityName: '',
    contactPerson: '',
    email: '',
    phone: '',
    trainingType: '',
    numberOfParticipants: '',
    preferredDate: '',
    message: ''
  });

  // Auto-fill forms when user is logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      
      setContactForm(prev => ({
        ...prev,
        name: fullName,
        email: user.email || '',
        phone: user.phone || ''
      }));
      
      setQuoteForm(prev => ({
        ...prev,
        facilityName: user.facilityName || '',
        contactPerson: fullName,
        email: user.email || '',
        phone: user.phone || ''
      }));
      
      setTrainingForm(prev => ({
        ...prev,
        facilityName: user.facilityName || '',
        contactPerson: fullName,
        email: user.email || '',
        phone: user.phone || ''
      }));
    }
  }, [isAuthenticated, user]);

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/contact/inquiry`, {
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone,
        subject: contactForm.subject,
        message: contactForm.message
      });
      toast.success('Thank you! We will get back to you shortly.');
      if (!isAuthenticated) {
        setContactForm({ name: '', email: '', phone: '', subject: '', message: '' });
      } else {
        setContactForm(prev => ({ ...prev, subject: '', message: '' }));
      }
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/quotes`, {
        facility_name: quoteForm.facilityName,
        contact_person: quoteForm.contactPerson,
        email: quoteForm.email,
        phone: quoteForm.phone,
        additional_notes: `Category: ${quoteForm.productCategory}\n${quoteForm.message}`,
        items: []
      });
      toast.success('Quote request received! We will send you a detailed quotation soon.');
      if (!isAuthenticated) {
        setQuoteForm({
          facilityName: '',
          contactPerson: '',
          email: '',
          phone: '',
          productCategory: '',
          specificProducts: '',
          quantity: '',
          message: ''
        });
      } else {
        setQuoteForm(prev => ({ ...prev, productCategory: '', specificProducts: '', quantity: '', message: '' }));
      }
    } catch (error) {
      toast.error('Failed to submit quote request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrainingSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/training/register`, {
        facility_name: trainingForm.facilityName,
        contact_person: trainingForm.contactPerson,
        email: trainingForm.email,
        phone: trainingForm.phone,
        training_type: trainingForm.trainingType,
        number_of_participants: parseInt(trainingForm.numberOfParticipants) || 1,
        preferred_date: trainingForm.preferredDate,
        message: trainingForm.message
      });
      toast.success('Training registration received! We will contact you to schedule.');
      if (!isAuthenticated) {
        setTrainingForm({
          facilityName: '',
          contactPerson: '',
          email: '',
          phone: '',
          trainingType: '',
          numberOfParticipants: '',
          preferredDate: '',
          message: ''
        });
      } else {
        setTrainingForm(prev => ({ ...prev, trainingType: '', numberOfParticipants: '', preferredDate: '', message: '' }));
      }
    } catch (error) {
      toast.error('Failed to submit registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/newsletter/subscribe`, { email: newsletterEmail });
      toast.success('Successfully subscribed to our newsletter!');
      setNewsletterEmail('');
    } catch (error) {
      toast.error('Failed to subscribe. Please try again.');
    }
  };

  const tabs = [
    { id: 'contact', label: 'General Inquiry', icon: MessageSquare },
    { id: 'quote', label: 'Request Quote', icon: FileText },
    { id: 'training', label: 'Training Registration', icon: GraduationCap }
  ];

  const renderContactInfoCards = () => (
    <div className="grid md:grid-cols-3 gap-6 mb-16">
      <Card className="border-2 border-gray-100 hover:border-[#006332] hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 group bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="w-14 h-14 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-500">
            <MapPin className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-xl">Visit Us</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 text-sm leading-relaxed">
            {contactInfo.address}<br />
            {contactInfo.poBox}
          </p>
        </CardContent>
      </Card>

      <Card className="border-2 border-gray-100 hover:border-[#006332] hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 group bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="w-14 h-14 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-500">
            <Phone className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-xl">Call Us</CardTitle>
        </CardHeader>
        <CardContent>
          <a href={`tel:${contactInfo.phone}`} className="text-gray-700 hover:text-[#006332] transition-colors duration-300 font-medium">
            {contactInfo.phone}
          </a>
          <p className="text-sm text-gray-500 mt-2">{contactInfo.working_hours}</p>
        </CardContent>
      </Card>

      <Card className="border-2 border-gray-100 hover:border-[#006332] hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 group bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="w-14 h-14 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-500">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-xl">Email Us</CardTitle>
        </CardHeader>
        <CardContent>
          <a href={`mailto:${contactInfo.email}`} className="text-gray-700 hover:text-[#006332] transition-colors duration-300 font-medium break-all">
            {contactInfo.email}
          </a>
          <p className="text-sm text-gray-500 mt-2">We'll respond within 24 hours</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderTabButtons = () => (
    <div className="flex flex-wrap gap-4 mb-8 justify-center">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const activeClass = 'bg-gradient-to-r from-[#006332] to-[#00a550] text-white scale-105';
        const inactiveClass = 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white border-2 border-gray-200 hover:border-[#006332]/30';
        
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group relative px-8 py-4 rounded-2xl font-semibold text-base transition-all duration-500 flex items-center gap-3 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 ${isActive ? activeClass : inactiveClass}`}
          >
            <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span>{tab.label}</span>
            {isActive && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-r from-[#006332] to-[#00a550] rounded-full shadow-lg" />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen pt-36 lg:pt-40 pb-20 px-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-blue-50 opacity-50" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-96 h-96 bg-[#006332] rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-[#00a550] rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto relative z-10">
        {/* Header with Animation */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-[#006332]/20 mb-6 shadow-lg">
            <Sparkles className="w-4 h-4 text-[#006332]" />
            <span className="text-sm font-semibold text-[#006332]">We're Here to Help</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
            Get In Touch
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Whether you need equipment, training, or have questions, our team is ready to assist you
          </p>
        </div>

        {renderContactInfoCards()}

        {/* Forms Section */}
        <div className="mb-16">
          {renderTabButtons()}

          {/* Tab Content */}
          <div className="relative">
            {/* Contact Form */}
            {activeTab === 'contact' && (
              <Card className="border-2 border-gray-200 shadow-2xl bg-white/90 backdrop-blur-md">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <CardTitle className="text-3xl">Send Us a Message</CardTitle>
                      <CardDescription className="text-base">Fill out the form and we&apos;ll get back to you soon</CardDescription>
                    </div>
                    {isAuthenticated && (
                      <div className="flex items-center gap-2 text-sm text-[#006332] bg-green-50 px-3 py-1.5 rounded-full">
                        <User className="w-4 h-4" />
                        <span>Pre-filled from profile</span>
                      </div>
                    )}
                  </div>
                  {!isAuthenticated && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <Link to="/login" className="font-semibold underline hover:no-underline">Sign in</Link> to auto-fill your information
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleContactSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-base font-semibold">Full Name *</Label>
                        <Input
                          id="name"
                          placeholder="John Doe"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          required
                          className="h-12 text-base"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-base font-semibold">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="john@example.com"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          required
                          className="h-12 text-base"
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-base font-semibold">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+254 700 000 000"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          className="h-12 text-base"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject" className="text-base font-semibold">Subject *</Label>
                        <Input
                          id="subject"
                          placeholder="How can we help?"
                          value={contactForm.subject}
                          onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                          required
                          className="h-12 text-base"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-base font-semibold">Message *</Label>
                      <Textarea
                        id="message"
                        placeholder="Tell us more..."
                        rows={6}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        required
                        className="text-base resize-none"
                      />
                    </div>
                    <Button type="submit" size="lg" className="bg-gradient-to-r from-[#006332] to-[#00a550] hover:from-[#005028] hover:to-[#008844] text-white shadow-lg">
                      Send Message
                      <Send className="ml-2 w-5 h-5" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Quote Form */}
            {activeTab === 'quote' && (
              <Card className="border-2 border-gray-200 shadow-2xl bg-white/90 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-3xl">Request a Quote</CardTitle>
                  <CardDescription className="text-base">Tell us what you need</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleQuoteSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Facility Name *</Label>
                        <Input
                          placeholder="Your Facility"
                          value={quoteForm.facilityName}
                          onChange={(e) => setQuoteForm({ ...quoteForm, facilityName: e.target.value })}
                          required
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person *</Label>
                        <Input
                          placeholder="Full Name"
                          value={quoteForm.contactPerson}
                          onChange={(e) => setQuoteForm({ ...quoteForm, contactPerson: e.target.value })}
                          required
                          className="h-12"
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          placeholder="email@facility.com"
                          value={quoteForm.email}
                          onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                          required
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone *</Label>
                        <Input
                          type="tel"
                          placeholder="+254 700 000 000"
                          value={quoteForm.phone}
                          onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                          required
                          className="h-12"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Product Category *</Label>
                      <Select value={quoteForm.productCategory} onValueChange={(value) => setQuoteForm({ ...quoteForm, productCategory: value })}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diagnostic">Diagnostic Test Kits</SelectItem>
                          <SelectItem value="hematology">Hematology & Blood Collection</SelectItem>
                          <SelectItem value="equipment">Equipment & Instruments</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea
                        placeholder="Additional details..."
                        rows={4}
                        value={quoteForm.message}
                        onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })}
                        className="resize-none"
                      />
                    </div>
                    <Button type="submit" size="lg" className="bg-gradient-to-r from-[#006332] to-[#00a550] hover:from-[#005028] hover:to-[#008844] text-white shadow-lg">
                      Submit Quote
                      <Send className="ml-2 w-5 h-5" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Training Form */}
            {activeTab === 'training' && (
              <Card className="border-2 border-gray-200 shadow-2xl bg-white/90 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-3xl">Register for Training</CardTitle>
                  <CardDescription className="text-base">Schedule training for your team</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTrainingSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Facility Name *</Label>
                        <Input
                          placeholder="Your Facility"
                          value={trainingForm.facilityName}
                          onChange={(e) => setTrainingForm({ ...trainingForm, facilityName: e.target.value })}
                          required
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person *</Label>
                        <Input
                          placeholder="Full Name"
                          value={trainingForm.contactPerson}
                          onChange={(e) => setTrainingForm({ ...trainingForm, contactPerson: e.target.value })}
                          required
                          className="h-12"
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          placeholder="email@facility.com"
                          value={trainingForm.email}
                          onChange={(e) => setTrainingForm({ ...trainingForm, email: e.target.value })}
                          required
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone *</Label>
                        <Input
                          type="tel"
                          placeholder="+254 700 000 000"
                          value={trainingForm.phone}
                          onChange={(e) => setTrainingForm({ ...trainingForm, phone: e.target.value })}
                          required
                          className="h-12"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Training Type *</Label>
                      <Select value={trainingForm.trainingType} onValueChange={(value) => setTrainingForm({ ...trainingForm, trainingType: value })}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select training" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="analyzer">Diagnostic & Laboratory Analyzer</SelectItem>
                          <SelectItem value="microscopy">Microscopy & Imaging</SelectItem>
                          <SelectItem value="maintenance">Routine Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea
                        placeholder="Additional details..."
                        rows={4}
                        value={trainingForm.message}
                        onChange={(e) => setTrainingForm({ ...trainingForm, message: e.target.value })}
                        className="resize-none"
                      />
                    </div>
                    <Button type="submit" size="lg" className="bg-gradient-to-r from-[#006332] to-[#00a550] hover:from-[#005028] hover:to-[#008844] text-white shadow-lg">
                      Submit Registration
                      <Send className="ml-2 w-5 h-5" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Newsletter */}
        <div className="relative overflow-hidden rounded-3xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#006332] via-[#00a550] to-[#006332] opacity-95" />
          <div className="relative z-10 p-12 text-white text-center">
            <Mail className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-4xl font-bold mb-4">Subscribe to Our Newsletter</h2>
            <p className="text-xl mb-8 opacity-90">Stay updated with the latest medical equipment and healthcare innovations</p>
            <form onSubmit={handleNewsletterSubmit} className="flex gap-4 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Your email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                required
                className="bg-white text-gray-900 flex-1 h-14"
              />
              <Button type="submit" size="lg" className="bg-white text-[#006332] hover:bg-gray-100 h-14">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
