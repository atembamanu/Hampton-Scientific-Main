import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const QuoteContext = createContext(null);

// LocalStorage key
const STORAGE_KEY = 'hampton_quote_cart';

export const useQuote = () => {
  const context = useContext(QuoteContext);
  if (!context) {
    throw new Error('useQuote must be used within a QuoteProvider');
  }
  return context;
};

export const QuoteProvider = ({ children }) => {
  // Initialize from localStorage
  const [quoteItems, setQuoteItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quoteItems));
  }, [quoteItems]);

  const addToQuote = useCallback((product) => {
    setQuoteItems(prev => {
      // Check if product already exists using unique key
      const existingIndex = prev.findIndex(
        item => item.productId === product.id && item.categoryId === product.categoryId
      );
      
      if (existingIndex !== -1) {
        // Product already in cart
        toast.info(`${product.name} is already in your quote`);
        return prev;
      }
      
      // Add new product
      const newItem = {
        id: `${product.categoryId}-${product.id}`,
        productId: product.id,
        categoryId: product.categoryId,
        name: product.name,
        category: product.categoryName,
        price: product.price,
        unit: product.unit,
        quantity: 1,
        notes: ''
      };
      
      toast.success(`${product.name} added to quote request!`);
      return [...prev, newItem];
    });
  }, []);

  const removeFromQuote = useCallback((itemId) => {
    setQuoteItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (item) {
        toast.success(`${item.name} removed from quote`);
      }
      return prev.filter(item => item.id !== itemId);
    });
  }, []);

  const updateQuantity = useCallback((itemId, quantity) => {
    if (quantity < 1) return;
    setQuoteItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }, []);

  const updateNotes = useCallback((itemId, notes) => {
    setQuoteItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, notes } : item
      )
    );
  }, []);

  const clearQuote = useCallback(() => {
    setQuoteItems([]);
    localStorage.removeItem(STORAGE_KEY);
    toast.success('Quote cart cleared');
  }, []);

  const isInQuote = useCallback((productId, categoryId) => {
    return quoteItems.some(
      item => item.productId === productId && item.categoryId === categoryId
    );
  }, [quoteItems]);

  const getItemCount = useCallback(() => {
    return quoteItems.length;
  }, [quoteItems]);

  const getTotalItems = useCallback(() => {
    return quoteItems.reduce((total, item) => total + item.quantity, 0);
  }, [quoteItems]);

  const value = {
    quoteItems,
    addToQuote,
    removeFromQuote,
    updateQuantity,
    updateNotes,
    clearQuote,
    isInQuote,
    getItemCount,
    getTotalItems
  };

  return (
    <QuoteContext.Provider value={value}>
      {children}
    </QuoteContext.Provider>
  );
};

export default QuoteContext;
