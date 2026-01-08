import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [prescriptionImage, setPrescriptionImage] = useState(null);
  const [scheduleHDeclaration, setScheduleHDeclaration] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('medilo_cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        localStorage.removeItem('medilo_cart');
      }
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('medilo_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (medicine) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === medicine.id);
      if (existing) {
        return prev.map((item) =>
          item.id === medicine.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...medicine, quantity: 1 }];
    });
  };

  const removeItem = (medicineId) => {
    setItems((prev) => prev.filter((item) => item.id !== medicineId));
  };

  const updateQuantity = (medicineId, quantity) => {
    if (quantity <= 0) {
      removeItem(medicineId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === medicineId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setPrescriptionImage(null);
    setScheduleHDeclaration(false);
    localStorage.removeItem('medilo_cart');
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Check highest bucket in cart
  const getHighestBucket = () => {
    const bucketPriority = { OTC: 0, SCHEDULE_H: 1, SCHEDULE_H1: 2 };
    let highest = 'OTC';
    items.forEach((item) => {
      if (bucketPriority[item.bucket] > bucketPriority[highest]) {
        highest = item.bucket;
      }
    });
    return highest;
  };

  const hasScheduleH1 = items.some((item) => item.bucket === 'SCHEDULE_H1');
  const hasScheduleH = items.some((item) => item.bucket === 'SCHEDULE_H');
  const requiresPrescription = hasScheduleH1;
  const requiresDeclarationOrPrescription = hasScheduleH && !hasScheduleH1;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        prescriptionImage,
        setPrescriptionImage,
        scheduleHDeclaration,
        setScheduleHDeclaration,
        getHighestBucket,
        hasScheduleH,
        hasScheduleH1,
        requiresPrescription,
        requiresDeclarationOrPrescription,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
