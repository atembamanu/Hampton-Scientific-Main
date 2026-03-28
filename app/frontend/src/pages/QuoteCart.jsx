import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuote } from '../context/QuoteContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ArrowLeft, Minus, Plus, Send, ShoppingCart, Trash2, User } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { API_URL } from '@/config/apiBaseUrl';

export const QuoteCart = () => {
  const { quoteItems, updateQuantity, updateNotes, removeFromQuote, clearQuote } = useQuote();
  const { user, isAuthenticated, getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [companyInfo, setCompanyInfo] = useState({
    facilityName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    additionalNotes: ''
  });

  // Pre-fill form with user data when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setCompanyInfo(prev => ({
        ...prev,
        facilityName: user.facilityName || '',
        contactPerson: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email || '',
        phone: user.phone || '',
        address: user.address ? `${user.address}, ${user.city || ''}` : ''
      }));
    }
  }, [isAuthenticated, user]);

  const handleQuantityChange = (id, delta) => {
    const item = quoteItems.find(i => i.id === id);
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      updateQuantity(id, newQuantity);
    }
  };

  const handleNotesChange = (id, value) => {
    updateNotes(id, value);
  };

  const handleRemoveItem = (id) => {
    removeFromQuote(id);
  };

  const calculateTotal = (item) => {
    if (!item.price) return 0;
    return (item.price * item.quantity).toLocaleString();
  };

  const calculateGrandTotal = () => {
    return quoteItems
      .reduce((total, item) => {
        return total + (item.price || 0) * item.quantity;
      }, 0)
      .toLocaleString();
  };

  const handleSubmitQuote = async (e) => {
    e.preventDefault();
    
    // Validation
    if (quoteItems.length === 0) {
      toast.error('Please add items to your quote');
      return;
    }
    
    if (!companyInfo.facilityName || !companyInfo.contactPerson || !companyInfo.email || !companyInfo.phone) {
      toast.error('Please fill in all required company information fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const quoteData = {
        facility_name: companyInfo.facilityName,
        contact_person: companyInfo.contactPerson,
        email: companyInfo.email,
        phone: companyInfo.phone,
        address: companyInfo.address || '',
        additional_notes: companyInfo.additionalNotes || '',
        items: quoteItems.map(item => ({
          product_id: item.productId,
          product_name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit_price: item.price,
          notes: item.notes || ''
        }))
      };

      // Include auth header if logged in to link quote to user
      const headers = isAuthenticated ? getAuthHeader() : {};
      await axios.post(`${API_URL}/api/quotes`, quoteData, { headers });
      
      toast.success('Quote request submitted successfully! We will contact you shortly.');
      clearQuote();
      
      // Reset form
      setCompanyInfo({
        facilityName: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        additionalNotes: ''
      });
      
      // Navigate to home or confirmation page
      setTimeout(() => navigate('/'), 2000);
      
    } catch (error) {
      console.error('Quote submission error:', error);
      toast.error('Failed to submit quote. Please try again or contact us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-36 lg:pt-40 pb-20 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link to="/products" className="inline-flex items-center gap-2 text-[#006332] hover:text-[#005028] transition-colors mb-4">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Products</span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">Quote Request</h1>
          <p className="text-base md:text-lg text-gray-600">
            Review your selected items and provide details for your quote request
          </p>
        </div>

        {quoteItems.length === 0 ? (
          <Card className="p-12 text-center" data-testid="empty-cart">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Your quote is empty</h3>
            <p className="text-gray-600 mb-6">Add products from our catalog to request a quote</p>
            <Link to="/products">
              <Button className="bg-[#006332] hover:bg-[#005028] text-white" data-testid="browse-products-btn">
                Browse Products
              </Button>
            </Link>
          </Card>
        ) : (
          <form onSubmit={handleSubmitQuote} className="space-y-8">
            {/* Quote Items Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Selected Products ({quoteItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-2 font-semibold text-gray-700">Product</th>
                        <th className="text-left py-3 px-2 font-semibold text-gray-700">Category</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-700">Quantity</th>
                        <th className="text-left py-3 px-2 font-semibold text-gray-700">Notes</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteItems.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-2">
                            <p className="font-medium text-gray-900">{item.name}</p>
                          </td>
                          <td className="py-4 px-2">
                            <span className="text-sm text-gray-600">{item.category}</span>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.id, -1)}
                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                data-testid={`decrease-qty-${item.id}`}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-12 text-center font-semibold">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.id, 1)}
                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                data-testid={`increase-qty-${item.id}`}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <Input
                              type="text"
                              placeholder="Optional notes"
                              value={item.notes || ''}
                              onChange={(e) => handleNotesChange(item.id, e.target.value)}
                              className="w-48"
                            />
                          </td>
                          <td className="py-4 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              data-testid={`remove-item-${item.id}`}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300">
                        <td colSpan="5" className="py-4 px-2">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                            <p className="text-blue-800 font-medium">Pricing will be provided after quote review</p>
                            <p className="text-sm text-blue-600 mt-1">Our team will review your request and send you a detailed quotation with prices.</p>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {quoteItems.map((item) => (
                    <Card key={item.id} className="border-2 border-gray-200">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                            <p className="text-sm text-gray-600">{item.category}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm mb-1">Quantity</Label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.id, -1)}
                                className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="flex-1 text-center font-semibold text-base">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.id, 1)}
                                className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm mb-1">Notes (Optional)</Label>
                            <Input
                              type="text"
                              placeholder="Add notes"
                              value={item.notes || ''}
                              onChange={(e) => handleNotesChange(item.id, e.target.value)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <p className="text-blue-800 font-medium">Pricing will be provided after quote review</p>
                    <p className="text-sm text-blue-600 mt-1">Our team will review your request and send you a detailed quotation.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Information Form */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="text-2xl">Company Information</CardTitle>
                  {isAuthenticated && (
                    <div className="flex items-center gap-2 text-sm text-[#006332] bg-green-50 px-3 py-1.5 rounded-full">
                      <User className="w-4 h-4" />
                      <span>Pre-filled from your profile</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!isAuthenticated && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <Link to="/login" className="font-semibold underline hover:no-underline">Sign in</Link> to auto-fill your company information and track your quote history.
                    </p>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="facilityName">Facility Name *</Label>
                    <Input
                      id="facilityName"
                      placeholder="Your Healthcare Facility"
                      value={companyInfo.facilityName}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, facilityName: e.target.value })}
                      required
                      className="h-12"
                      data-testid="facility-name-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person *</Label>
                    <Input
                      id="contactPerson"
                      placeholder="Full Name"
                      value={companyInfo.contactPerson}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, contactPerson: e.target.value })}
                      required
                      className="h-12"
                      data-testid="contact-person-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="contact@facility.com"
                      value={companyInfo.email}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                      required
                      className="h-12"
                      data-testid="email-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+254 700 000 000"
                      value={companyInfo.phone}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                      required
                      className="h-12"
                      data-testid="phone-input"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Facility Address</Label>
                    <Input
                      id="address"
                      placeholder="Street, City, Country"
                      value={companyInfo.address}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                      className="h-12"
                      data-testid="address-input"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="additionalNotes">Additional Notes</Label>
                    <Textarea
                      id="additionalNotes"
                      placeholder="Any special requirements or additional information..."
                      rows={4}
                      value={companyInfo.additionalNotes}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, additionalNotes: e.target.value })}
                      className="resize-none"
                      data-testid="additional-notes-input"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <Link to="/products">
                <Button type="button" variant="outline" className="w-full sm:w-auto border-gray-300">
                  Continue Shopping
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#006332] to-[#00a550] hover:from-[#005028] hover:to-[#008844] text-white shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto px-8"
                data-testid="submit-quote-btn"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Quote Request'}
                {!isSubmitting && <Send className="ml-2 w-5 h-5" />}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
