import { createContext, useContext, useState, useCallback, useEffect } from 'react';

import axios from 'axios';

import { toast } from 'sonner';

import { API_URL } from '../config/apiBaseUrl';



const QuoteContext = createContext(null);



const STORAGE_KEY = 'hampton_quote_cart';

const META_STORAGE_KEY = 'hampton_quote_meta';



export const useQuote = () => {

  const context = useContext(QuoteContext);

  if (!context) {

    throw new Error('useQuote must be used within a QuoteProvider');

  }

  return context;

};



const readMeta = () => {

  try {

    const saved = localStorage.getItem(META_STORAGE_KEY);

    return saved ? JSON.parse(saved) : {};

  } catch {

    return {};

  }

};



const mapHistoryItem = (item, index) => {

  const productId = item.product_id || item.productId || '';

  const category = item.category || item.categoryName || '';

  const categoryId = item.category_id || item.categoryId || category || 'history';

  const name = item.product_name || item.name || 'Product';

  const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);

  const price =

    Number(

      item.list_price ??

        item.listPrice ??

        item.unit_price ??

        item.modified_price ??

        item.original_price ??

        item.price ??

        0,

    ) || 0;



  return {

    id: `history-${productId || index}`,

    productId: productId || `history-${index}`,

    sku: item.sku || item.slug || String(productId || ''),

    categoryId,

    name,

    category,

    listPrice: price,

    price,

    unit: item.unit || 'unit',

    quantity,

    notes: item.notes || '',

    _priorPrice: Number(item.unit_price ?? item.agreed_unit_price ?? 0) || null,

  };

};



export const QuoteProvider = ({ children }) => {

  const [quoteItems, setQuoteItems] = useState(() => {

    try {

      const saved = localStorage.getItem(STORAGE_KEY);

      return saved ? JSON.parse(saved) : [];

    } catch {

      return [];

    }

  });



  const [quoteReference, setQuoteReference] = useState(() => readMeta().quoteReference || null);

  const [draftQuoteId, setDraftQuoteId] = useState(() => readMeta().draftQuoteId || null);

  const [quoteExtras, setQuoteExtras] = useState(() => ({

    orderedForBranchId: readMeta().orderedForBranchId || null,

    deliveryLocationId: readMeta().deliveryLocationId || null,

    sourceOrderNumber: readMeta().sourceOrderNumber || null,

    additionalNotes: readMeta().additionalNotes || '',

  }));

  const [referenceLoading, setReferenceLoading] = useState(false);



  useEffect(() => {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(quoteItems));

  }, [quoteItems]);



  useEffect(() => {

    if (quoteReference || draftQuoteId) {

      localStorage.setItem(META_STORAGE_KEY, JSON.stringify({

        quoteReference,

        draftQuoteId,

        ...quoteExtras,

      }));

    } else {

      localStorage.removeItem(META_STORAGE_KEY);

    }

  }, [quoteReference, draftQuoteId, quoteExtras]);



  useEffect(() => {

    if (quoteItems.length === 0 && quoteReference && !draftQuoteId) {

      setQuoteReference(null);

    }

  }, [quoteItems.length, quoteReference, draftQuoteId]);



  const getAuthHeader = useCallback(() => {

    const token = localStorage.getItem('auth_token');

    return token ? { Authorization: `Bearer ${token}` } : {};

  }, []);



  const ensureQuoteReference = useCallback(async () => {

    if (quoteReference || draftQuoteId) return quoteReference;



    setReferenceLoading(true);

    try {

      const response = await axios.post(

        `${API_URL}/api/quotes/draft-reference`,

        {},

        { headers: getAuthHeader() },

      );

      const ref = response.data.reference;

      setQuoteReference(ref);

      return ref;

    } catch (err) {

      const detail = err.response?.data?.detail;

      toast.error(

        typeof detail === 'string'

          ? detail

          : 'Could not generate quote reference. Please sign in and try again.',

      );

      throw err;

    } finally {

      setReferenceLoading(false);

    }

  }, [quoteReference, draftQuoteId, getAuthHeader]);



  useEffect(() => {

    if (

      quoteItems.length > 0

      && !quoteReference

      && !draftQuoteId

      && localStorage.getItem('auth_token')

    ) {

      ensureQuoteReference().catch(() => {});

    }

  }, [quoteItems.length, quoteReference, draftQuoteId, ensureQuoteReference]);



  const addToQuote = useCallback(async (product, quantity = 1, notes = '') => {

    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    const noteText = (notes || '').trim();



    const isAuthenticated = Boolean(localStorage.getItem('auth_token'));

    if (isAuthenticated && quoteItems.length === 0 && !quoteReference && !draftQuoteId) {

      try {

        await ensureQuoteReference();

      } catch {

        return;

      }

    }



    setQuoteItems((prev) => {

      const existingIndex = prev.findIndex(

        (item) => item.productId === product.id && item.categoryId === product.categoryId,

      );



      if (existingIndex !== -1) {

        const updated = [...prev];

        updated[existingIndex] = {

          ...updated[existingIndex],

          quantity: updated[existingIndex].quantity + qty,

          notes: noteText || updated[existingIndex].notes,

        };

        toast.success(`${product.name} quantity updated in quote`);

        return updated;

      }



      const newItem = {

        id: `${product.categoryId}-${product.id}`,

        productId: product.id,

        sku: product.sku || product.slug || String(product.id),

        categoryId: product.categoryId,

        name: product.name,

        category: product.categoryName,

        listPrice: product.listPrice ?? product.price ?? 0,

        priceUnit: product.priceUnit || product.unit || 'unit',

        price: product.listPrice ?? product.price ?? 0,

        unit: product.priceUnit || product.unit || 'unit',

        quantity: qty,

        notes: noteText,

      };



      toast.success(`${product.name} added to quote request!`);

      return [...prev, newItem];

    });

  }, [quoteItems.length, quoteReference, draftQuoteId, ensureQuoteReference]);



  const removeFromQuote = useCallback((itemId) => {

    setQuoteItems((prev) => {

      const item = prev.find((i) => i.id === itemId);

      if (item) {

        toast.success(`${item.name} removed from quote`);

      }

      return prev.filter((item) => item.id !== itemId);

    });

  }, []);



  const updateQuantity = useCallback((itemId, quantity) => {

    if (quantity < 1) return;

    setQuoteItems((prev) =>

      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),

    );

  }, []);



  const updateNotes = useCallback((itemId, notes) => {

    setQuoteItems((prev) =>

      prev.map((item) => (item.id === itemId ? { ...item, notes } : item)),

    );

  }, []);



  const clearQuote = useCallback((options = {}) => {

    const silent = options === true || options?.silent;

    setQuoteItems([]);

    setQuoteReference(null);

    setDraftQuoteId(null);

    setQuoteExtras({

      orderedForBranchId: null,

      deliveryLocationId: null,

      sourceOrderNumber: null,

      additionalNotes: '',

    });

    localStorage.removeItem(STORAGE_KEY);

    localStorage.removeItem(META_STORAGE_KEY);

    if (!silent) {

      toast.success('Quote cart cleared');

    }

  }, []);



  const loadHistoryItems = useCallback(async (rawItems, { sourceLabel } = {}) => {

    const mapped = (rawItems || [])

      .map(mapHistoryItem)

      .filter((item) => item.name);



    if (mapped.length === 0) {

      toast.error('No items found to re-quote');

      return false;

    }



    setQuoteItems(mapped);

    setDraftQuoteId(null);

    setQuoteExtras({

      orderedForBranchId: null,

      deliveryLocationId: null,

      sourceOrderNumber: sourceLabel || null,

      additionalNotes: '',

    });

    setQuoteReference(null);

    if (localStorage.getItem('auth_token')) {

      try {

        await ensureQuoteReference();

      } catch {

        // Items loaded; reference will be created on next add if needed

      }

    }



    toast.success(

      `Loaded ${mapped.length} item${mapped.length === 1 ? '' : 's'}${

        sourceLabel ? ` from ${sourceLabel}` : ''

      }. Review quantities and submit as a new quote.`,

    );

    return true;

  }, [ensureQuoteReference]);



  const loadReorderQuote = useCallback((quote, { sourceLabel } = {}) => {

    const mapped = (quote?.items || [])

      .map(mapHistoryItem)

      .filter((item) => item.name);



    if (mapped.length === 0) {

      toast.error('No items found to order again');

      return false;

    }



    setQuoteItems(mapped);

    setQuoteReference(quote.quote_number || null);

    setDraftQuoteId(quote.id);

    setQuoteExtras({

      orderedForBranchId: quote.ordered_for_branch_id || quote.orderedForBranchId || null,

      deliveryLocationId: quote.delivery_location_id || quote.deliveryLocationId || null,

      sourceOrderNumber: sourceLabel || quote.sourceOrderNumber || null,

      additionalNotes: quote.additional_notes || quote.additionalNotes || '',

    });

    toast.success(

      `Quote ${quote.quote_number || ''} is ready. Change quantities or add products, then submit for review.`,

    );

    return true;

  }, []);



  const isInQuote = useCallback((productId, categoryId) => {

    return quoteItems.some(

      (item) => item.productId === productId && item.categoryId === categoryId,

    );

  }, [quoteItems]);



  const getItemCount = useCallback(() => quoteItems.length, [quoteItems]);



  const getTotalItems = useCallback(() => {

    return quoteItems.reduce((total, item) => total + item.quantity, 0);

  }, [quoteItems]);



  const hasItems = quoteItems.length > 0;



  const value = {

    quoteItems,

    quoteReference,

    draftQuoteId,

    quoteExtras,

    referenceLoading,

    hasItems,

    addToQuote,

    removeFromQuote,

    updateQuantity,

    updateNotes,

    clearQuote,

    loadHistoryItems,

    loadReorderQuote,

    ensureQuoteReference,

    isInQuote,

    getItemCount,

    getTotalItems,

  };



  return (

    <QuoteContext.Provider value={value}>

      {children}

    </QuoteContext.Provider>

  );

};



export default QuoteContext;

