import { QRCodeSVG } from 'qrcode.react';
import React from 'react';

// Generate UPI QR code URL using external API
export const generateUpiQrCodeUrl = (upiId, name, amount, description, orderId) => {
  try {
    // Format the UPI URL with all parameters
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}&tr=${encodeURIComponent(orderId)}`;
    
    // Generate QR code using a QR code API service
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiUrl)}&size=250x250&margin=10`;
    
    return qrCodeUrl;
  } catch (error) {
    console.error("Error generating UPI QR code URL:", error);
    return null;
  }
};

// React component for UPI QR code
export const UpiQRCode = ({ upiId, name, amount, description, orderId, size = 250 }) => {
  // Create the UPI payment URL
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}&tr=${encodeURIComponent(orderId)}`;
  
  return (
    <QRCodeSVG 
      value={upiUrl}
      size={size}
      level="M" // QR code error correction level: L, M, Q, H
      includeMargin={true}
      bgColor={"#ffffff"}
      fgColor={"#000000"}
    />
  );
};

// Generate QR code as data URL
export const generateQrCodeDataUrl = async (upiId, name, amount, description, orderId) => {
  try {
    // Import QRCode only on client side
    const QRCode = (await import('qrcode')).default;
    
    // Format the UPI URL
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}&tr=${encodeURIComponent(orderId)}`;
    
    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(upiUrl, {
      width: 250,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
    
    return dataUrl;
  } catch (error) {
    console.error("Error generating UPI QR code data URL:", error);
    return null;
  }
};
