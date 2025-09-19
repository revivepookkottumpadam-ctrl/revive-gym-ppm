// src/utils/validation.js

const validateMemberData = (data) => {
  const validMembershipTypes = ['monthly', 'quarterly', 'yearly'];
  const validPaymentStatuses = ['paid', 'unpaid'];

  // Name validation
  if (!data.name || data.name.trim() === '') {
    throw new Error('Name is required');
  }
  if (data.name.trim().length < 2) {
    throw new Error('Name must be at least 2 characters long');
  }

  // Email validation - allow empty or default email, but validate if provided
  if (!data.email || data.email.trim() === '') {
    data.email = 'member@revivefitness.com';
  } else if (data.email.trim() !== 'member@revivefitness.com') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      throw new Error('Please enter a valid email address');
    }
  }

  // Phone validation
  if (!data.phone || data.phone.trim() === '') {
    throw new Error('Phone is required');
  }
  
  const cleanPhone = data.phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    throw new Error('Phone number must have at least 10 digits');
  } else if (cleanPhone.length > 15) {
    throw new Error('Phone number cannot exceed 15 digits');
  } else if (cleanPhone.length === 10 && !/^[6-9]/.test(cleanPhone)) {
    throw new Error('Invalid Indian phone number format');
  }

  // Membership type validation
  if (!data.membershipType || !validMembershipTypes.includes(data.membershipType)) {
    throw new Error('Invalid membership type');
  }

  // Payment status validation
  if (!data.paymentStatus || !validPaymentStatuses.includes(data.paymentStatus)) {
    throw new Error('Invalid payment status');
  }

  // Start date validation
  if (!data.startDate) {
    throw new Error('Start date is required');
  }
  if (isNaN(Date.parse(data.startDate))) {
    throw new Error('Invalid start date format');
  }

  // End date validation
  if (!data.endDate) {
    throw new Error('End date is required');
  }
  if (isNaN(Date.parse(data.endDate))) {
    throw new Error('Invalid end date format');
  }
  if (data.startDate && new Date(data.endDate) <= new Date(data.startDate)) {
    throw new Error('End date must be after start date');
  }

  return {
    name: data.name.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    membershipType: data.membershipType,
    paymentStatus: data.paymentStatus,
    startDate: data.startDate,
    endDate: data.endDate
  };
};

module.exports = { validateMemberData };