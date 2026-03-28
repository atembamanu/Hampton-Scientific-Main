import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { User, Building2, MapPin, Phone, Mail, Edit2, Save, LogOut, FileText, Clock, Loader2, ChevronLeft, ChevronRight, CheckCircle, X, DollarSign, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '@/config/apiBaseUrl';

const QUOTES_PER_PAGE = 10;

// Slide-out panel
const SlideOutPanel = ({ isOpen, onClose, title, subtitle, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[40vw] min-w-[400px] max-w-[700px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

export const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, logout, updateProfile, getAuthHeader } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({});
  const [quotes, setQuotes] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [activeSection, setActiveSection] = useState('profile');

  // Quote filtering
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [quotePage, setQuotePage] = useState(1);

  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Quote response panel
  const [showResponsePanel, setShowResponsePanel] = useState(null);
  const [responseType, setResponseType] = useState('accepted');
  const [responseNotes, setResponseNotes] = useState('');
  const [proposedPrices, setProposedPrices] = useState({});
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [isAuthenticated, authLoading, navigate]);
  useEffect(() => { if (user) setEditData({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '', facilityName: user.facilityName || '', facilityType: user.facilityType || '', address: user.address || '', city: user.city || '', postalCode: user.postalCode || '' }); }, [user]);

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!isAuthenticated) return;
      try { const res = await axios.get(`${API_URL}/api/quotes`, { headers: getAuthHeader() }); setQuotes(res.data); }
      catch (e) { console.error('Error fetching quotes:', e); }
      finally { setLoadingQuotes(false); }
    };
    const fetchInvoices = async () => {
      if (!isAuthenticated) return;
      setLoadingInvoices(true);
      try { const res = await axios.get(`${API_URL}/api/invoices`, { headers: getAuthHeader() }); setCustomerInvoices(res.data); }
      catch (e) { console.error('Error fetching invoices:', e); }
      finally { setLoadingInvoices(false); }
    };
    if (isAuthenticated) { fetchQuotes(); fetchInvoices(); }
  }, [isAuthenticated, getAuthHeader]);

  const handleSave = async () => { setIsSaving(true); const result = await updateProfile(editData); if (result.success) { setIsEditing(false); toast.success('Profile updated!'); } else toast.error(result.error); setIsSaving(false); };
  const handleLogout = () => { logout(); toast.success('Logged out'); navigate('/'); };

  const getStatusColor = (status) => {
    const map = { quoted: 'bg-blue-100 text-blue-800', invoiced: 'bg-green-100 text-green-800' };
    return map[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const calculateQuoteValue = (items) => items?.reduce((sum, i) => sum + (i.unit_price || 0) * i.quantity, 0) || 0;

  const handleQuoteResponse = async (quoteId) => {
    setSubmittingResponse(true);
    try {
      const quote = quotes.find(q => q.id === quoteId);
      const responseData = {
        response: responseType,
        notes: responseNotes,
        items: responseType === 'negotiating' ? quote.items.map(item => ({ product_id: item.product_id, customer_proposed_price: proposedPrices[item.product_id] || null })) : null
      };
      await axios.put(`${API_URL}/api/quotes/${quoteId}/respond`, responseData, { headers: getAuthHeader() });
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, customer_response: responseType, customer_notes: responseNotes } : q));
      toast.success(responseType === 'accepted' ? 'Quote accepted! Your order will be processed.' : 'Counter-proposal submitted.');
      setShowResponsePanel(null); setResponseType('accepted'); setResponseNotes(''); setProposedPrices({});
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to submit response'); }
    finally { setSubmittingResponse(false); }
  };

  const filteredQuotesAll = quotes.filter(q => statusFilter === 'all' || q.status === statusFilter).sort((a, b) => sortOrder === 'newest' ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at));
  const totalQuotePages = Math.ceil(filteredQuotesAll.length / QUOTES_PER_PAGE);
  const filteredQuotes = filteredQuotesAll.slice((quotePage - 1) * QUOTES_PER_PAGE, quotePage * QUOTES_PER_PAGE);

  if (authLoading) return <div className="min-h-screen pt-36 pb-20 bg-gray-50 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-[#006332]" /></div>;
  if (!user) return null;

  const navItems = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'company', label: 'Company Info', icon: Building2 },
    { id: 'quotes', label: 'Quote History', icon: FileText },
    { id: 'invoices', label: 'Invoices', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen pt-28 lg:pt-32 pb-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <aside className="w-[220px] flex-shrink-0" data-testid="profile-sidebar">
            <div className="sticky top-32 space-y-1">
              <div className="flex items-center gap-3 mb-6 px-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              {navItems.map(item => (
                <button
                  key={item.id}
                  data-testid={`profile-nav-${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${activeSection === item.id ? 'bg-[#006332] text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <item.icon className="w-4 h-4" /> {item.label}
                </button>
              ))}
              <div className="pt-4 mt-4 border-t">
                <Button onClick={handleLogout} variant="outline" size="sm" className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50 gap-2" data-testid="logout-btn">
                  <LogOut className="w-4 h-4" /> Logout
                </Button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 max-w-3xl">
            {/* Contact Person */}
            {activeSection === 'profile' && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div><CardTitle className="text-2xl">Contact Person</CardTitle><CardDescription>Your personal information</CardDescription></div>
                    {!isEditing && <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2" data-testid="edit-profile-btn"><Edit2 className="w-4 h-4" /> Edit</Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label>First Name</Label>{isEditing ? <Input value={editData.firstName} onChange={e => setEditData({ ...editData, firstName: e.target.value })} /> : <p className="text-lg font-medium">{user.firstName}</p>}</div>
                    <div className="space-y-2"><Label>Last Name</Label>{isEditing ? <Input value={editData.lastName} onChange={e => setEditData({ ...editData, lastName: e.target.value })} /> : <p className="text-lg font-medium">{user.lastName}</p>}</div>
                    <div className="space-y-2"><Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</Label><p className="text-lg font-medium">{user.email}</p><p className="text-xs text-gray-500">Cannot be changed</p></div>
                    <div className="space-y-2"><Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> Phone</Label>{isEditing ? <Input type="tel" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} /> : <p className="text-lg font-medium">{user.phone}</p>}</div>
                  </div>
                  {isEditing && <div className="flex gap-4 justify-end mt-6"><Button onClick={() => setIsEditing(false)} variant="outline" disabled={isSaving}>Cancel</Button><Button onClick={handleSave} disabled={isSaving} className="bg-[#006332] hover:bg-[#005028] text-white gap-2" data-testid="save-profile-btn">{isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}</Button></div>}
                </CardContent>
              </Card>
            )}

            {/* Company Info */}
            {activeSection === 'company' && (
              <Card>
                <CardHeader><CardTitle className="text-2xl">Company Information</CardTitle><CardDescription>Your facility details</CardDescription></CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label>Facility Name</Label>{isEditing ? <Input value={editData.facilityName} onChange={e => setEditData({ ...editData, facilityName: e.target.value })} /> : <p className="text-lg font-medium">{user.facilityName}</p>}</div>
                    <div className="space-y-2"><Label>Facility Type</Label>{isEditing ? <Input value={editData.facilityType || ''} onChange={e => setEditData({ ...editData, facilityType: e.target.value })} /> : <p className="text-lg font-medium">{user.facilityType || 'N/A'}</p>}</div>
                    <div className="space-y-2 md:col-span-2"><Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Address</Label>{isEditing ? <Input value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} /> : <p className="text-lg font-medium">{user.address}</p>}</div>
                    <div className="space-y-2"><Label>City</Label>{isEditing ? <Input value={editData.city} onChange={e => setEditData({ ...editData, city: e.target.value })} /> : <p className="text-lg font-medium">{user.city}</p>}</div>
                    <div className="space-y-2"><Label>Postal Code</Label>{isEditing ? <Input value={editData.postalCode || ''} onChange={e => setEditData({ ...editData, postalCode: e.target.value })} /> : <p className="text-lg font-medium">{user.postalCode || 'N/A'}</p>}</div>
                  </div>
                  {isEditing && <div className="flex gap-4 justify-end mt-6"><Button onClick={() => setIsEditing(false)} variant="outline" disabled={isSaving}>Cancel</Button><Button onClick={handleSave} disabled={isSaving} className="bg-[#006332] hover:bg-[#005028] text-white gap-2" data-testid="save-profile-btn">{isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}</Button></div>}
                </CardContent>
              </Card>
            )}

            {/* Quote History */}
            {activeSection === 'quotes' && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div><CardTitle className="text-2xl">Quote History</CardTitle><CardDescription>Your previous quote requests</CardDescription></div>
                    {quotes.length > 0 && <div className="flex gap-2">
                      <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setQuotePage(1); }} className="px-3 py-2 border rounded-lg text-sm"><option value="all">All Status</option><option value="quoted">Quoted</option><option value="invoiced">Invoiced</option></select>
                      <select value={sortOrder} onChange={e => { setSortOrder(e.target.value); setQuotePage(1); }} className="px-3 py-2 border rounded-lg text-sm"><option value="newest">Newest First</option><option value="oldest">Oldest First</option></select>
                    </div>}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingQuotes ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#006332]" /></div>
                    : quotes.length === 0 ? <div className="text-center py-8"><FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500 mb-4">No quote requests yet</p><Button onClick={() => navigate('/products')} className="bg-[#006332] text-white">Browse Products</Button></div>
                      : <>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead><tr className="border-b-2 border-gray-200"><th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th><th className="text-left py-3 px-4 font-semibold text-gray-700">Items</th><th className="text-right py-3 px-4 font-semibold text-gray-700">Value</th><th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th><th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th></tr></thead>
                            <tbody>
                              {filteredQuotes.map(quote => (
                                <tr key={quote.id} className="border-b hover:bg-gray-50 transition-colors">
                                  <td className="py-4 px-4"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /><p className="font-medium">{new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></div></td>
                                  <td className="py-4 px-4"><p className="font-medium">{quote.items?.length || 0} items</p><p className="text-xs text-gray-500 truncate max-w-[200px]">{quote.items?.slice(0, 2).map(i => i.product_name).join(', ')}{quote.items?.length > 2 && '...'}</p></td>
                                  <td className="py-4 px-4 text-right">{quote.status === 'quoted' && (quote.items || []).every(i => !i.unit_price) ? <span className="text-gray-500 text-sm">Awaiting quote</span> : <p className="font-bold text-[#006332]">KES {calculateQuoteValue(quote.items).toLocaleString()}</p>}</td>
                                  <td className="py-4 px-4 text-center"><div className="flex flex-col items-center gap-1"><Badge className={getStatusColor(quote.status)}>{quote.status?.charAt(0).toUpperCase() + quote.status?.slice(1)}</Badge>{quote.customer_response && <span className={`text-xs ${quote.customer_response === 'accepted' ? 'text-green-600' : 'text-orange-600'}`}>You: {quote.customer_response}</span>}</div></td>
                                  <td className="py-4 px-4 text-center"><div className="flex justify-center gap-2">
                                    {quote.status === 'quoted' && quote.current_handler !== 'ADMIN_REVIEW' && !quote.customer_response && <button onClick={() => { setShowResponsePanel(quote); setProposedPrices({}); setResponseNotes(''); setResponseType('accepted'); }} className="bg-[#006332] text-white px-3 py-1 rounded text-sm hover:bg-[#005028]" data-testid={`respond-quote-${quote.id}`}>Respond</button>}
                                    {quote.status === 'quoted' && quote.current_handler === 'ADMIN_REVIEW' && <span className="text-sm text-purple-600 font-medium">Pending Admin Review</span>}
                                  </div></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {totalQuotePages > 1 && <div className="flex items-center justify-between pt-6 mt-6 border-t"><p className="text-sm text-gray-500">Page {quotePage}/{totalQuotePages}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setQuotePage(p => p - 1)} disabled={quotePage === 1}><ChevronLeft className="w-4 h-4" /> Prev</Button><Button variant="outline" size="sm" onClick={() => setQuotePage(p => p + 1)} disabled={quotePage === totalQuotePages}>Next <ChevronRight className="w-4 h-4" /></Button></div></div>}
                      </>}
                </CardContent>
              </Card>
            )}
            {/* Invoices */}
            {activeSection === 'invoices' && (
              <Card>
                <CardHeader><CardTitle className="text-2xl">Invoices</CardTitle><CardDescription>Your invoices and payment history</CardDescription></CardHeader>
                <CardContent>
                  {loadingInvoices ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#006332]" /></div>
                    : customerInvoices.length === 0 ? <div className="text-center py-8"><DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">No invoices yet</p></div>
                      : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b-2 border-gray-200"><th className="text-left py-3 px-4 font-semibold text-gray-700">Invoice #</th><th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th><th className="text-right py-3 px-4 font-semibold text-gray-700">Total</th><th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th><th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th></tr></thead>
                        <tbody>{customerInvoices.map(inv => (
                          <tr key={inv.id} className="border-b hover:bg-gray-50">
                            <td className="py-4 px-4 font-mono font-semibold text-[#006332]">{inv.invoice_number}</td>
                            <td className="py-4 px-4">{new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td className="py-4 px-4 text-right font-bold">KES {(inv.total || 0).toLocaleString()}</td>
                            <td className="py-4 px-4 text-center"><Badge className={inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{inv.status?.charAt(0).toUpperCase() + inv.status?.slice(1)}</Badge></td>
                            <td className="py-4 px-4 text-center"><button onClick={async () => { try { const r = await axios.get(`${API_URL}/api/invoices/${inv.id}/download`, { headers: getAuthHeader(), responseType: 'blob' }); const u = window.URL.createObjectURL(new Blob([r.data])); const a = document.createElement('a'); a.href = u; a.setAttribute('download', `Invoice_${inv.invoice_number}.pdf`); document.body.appendChild(a); a.click(); a.remove(); } catch (e) { toast.error('Failed to download'); } }} className="text-[#006332] hover:underline text-sm font-medium" data-testid={`download-invoice-${inv.id}`}>Download PDF</button></td>
                          </tr>
                        ))}</tbody></table></div>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Quote Response Slide-Out Panel */}
      <SlideOutPanel isOpen={!!showResponsePanel} onClose={() => setShowResponsePanel(null)} title="Respond to Quote" subtitle="Review prices and submit your response">
        {showResponsePanel && (
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3">Quoted Items</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100"><tr><th className="text-left p-3">Product</th><th className="text-center p-3">Qty</th><th className="text-right p-3">Quoted Price</th>{responseType === 'negotiating' && <th className="text-right p-3">Your Price</th>}</tr></thead>
                  <tbody>{showResponsePanel.items?.map((item, i) => (<tr key={i} className="border-t"><td className="p-3">{item.product_name}</td><td className="p-3 text-center">{item.quantity}</td><td className="p-3 text-right font-medium">KES {(item.unit_price || 0).toLocaleString()}</td>{responseType === 'negotiating' && <td className="p-3"><Input type="number" placeholder="Your price" value={proposedPrices[item.product_id] || ''} onChange={e => setProposedPrices({ ...proposedPrices, [item.product_id]: parseFloat(e.target.value) || null })} className="w-28 ml-auto" /></td>}</tr>))}</tbody>
                  <tfoot className="bg-gray-50">
                    {(() => {
                      const sub = showResponsePanel.items?.reduce((s, i) => {
                        const price = responseType === 'negotiating' && proposedPrices[i.product_id] ? proposedPrices[i.product_id] : (i.unit_price || 0);
                        return s + price * i.quantity;
                      }, 0) || 0;
                      const disc = showResponsePanel.discount_amount || 0;
                      const grand = sub - disc;
                      return (<>
                        <tr><td colSpan={responseType === 'negotiating' ? 3 : 2} className="p-3 text-right text-gray-500">Subtotal:</td><td className="p-3 text-right">KES {sub.toLocaleString()}</td></tr>
                        {disc > 0 && <tr><td colSpan={responseType === 'negotiating' ? 3 : 2} className="p-3 text-right text-gray-500">Discount:</td><td className="p-3 text-right text-red-600">- KES {disc.toLocaleString()}</td></tr>}
                        <tr className="font-bold"><td colSpan={responseType === 'negotiating' ? 3 : 2} className="p-3 text-right">Grand Total:</td><td className="p-3 text-right text-[#006332]">KES {grand.toLocaleString()}</td></tr>
                      </>);
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="font-semibold">Your Response</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant={responseType === 'accepted' ? 'default' : 'outline'} onClick={() => setResponseType('accepted')} className={responseType === 'accepted' ? 'bg-green-600 hover:bg-green-700' : ''} data-testid="response-accept-btn"><CheckCircle className="w-4 h-4 mr-2" /> Accept</Button>
                <Button type="button" variant={responseType === 'negotiating' ? 'default' : 'outline'} onClick={() => setResponseType('negotiating')} className={responseType === 'negotiating' ? 'bg-orange-500 hover:bg-orange-600' : ''} data-testid="response-negotiate-btn"><DollarSign className="w-4 h-4 mr-2" /> Negotiate</Button>
              </div>
            </div>
            <div><Label>Additional Notes (Optional)</Label><Textarea value={responseNotes} onChange={e => setResponseNotes(e.target.value)} placeholder={responseType === 'negotiating' ? "Explain your counter-proposal..." : "Any comments..."} rows={3} /></div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowResponsePanel(null)} disabled={submittingResponse}>Cancel</Button>
              <Button onClick={() => handleQuoteResponse(showResponsePanel.id)} disabled={submittingResponse} className={responseType === 'accepted' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'} data-testid="submit-response-btn">
                {submittingResponse && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {responseType === 'accepted' ? 'Accept Quote' : 'Submit Counter-Proposal'}
              </Button>
            </div>
          </div>
        )}
      </SlideOutPanel>
    </div>
  );
};
