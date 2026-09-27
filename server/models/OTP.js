const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    required: true,
    enum: ['registration', 'password-reset'],
    default: 'registration',
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3, // Maximum 3 verification attempts
  },
}, {
  timestamps: true,
});

// Index to automatically delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient queries
otpSchema.index({ email: 1, purpose: 1 });

// Static method to verify OTP
otpSchema.statics.verifyOTP = async function(email, otp, purpose = 'registration') {
  const emailLower = email.toLowerCase().trim();
  
  // Find the most recent unused OTP for this email and purpose
  const otpRecord = await this.findOne({
    email: emailLower,
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return { success: false, message: 'Invalid or expired OTP' };
  }

  // Check if maximum attempts exceeded
  if (otpRecord.attempts >= 3) {
    return { success: false, message: 'Maximum verification attempts exceeded' };
  }

  // Increment attempts
  otpRecord.attempts += 1;
  await otpRecord.save();

  // Check if OTP matches
  if (otpRecord.otp !== otp) {
    return { success: false, message: 'Invalid OTP' };
  }

  // Mark OTP as used
  otpRecord.isUsed = true;
  await otpRecord.save();

  return { success: true, message: 'OTP verified successfully' };
};

// Static method to create new OTP
otpSchema.statics.createOTP = async function(email, otp, purpose = 'registration') {
  const emailLower = email.toLowerCase().trim();
  
  // Remove any existing unused OTPs for this email and purpose
  await this.deleteMany({
    email: emailLower,
    purpose,
    isUsed: false,
  });

  // Create new OTP
  const otpRecord = await this.create({
    email: emailLower,
    otp,
    purpose,
  });

  return otpRecord;
};

module.exports = mongoose.model('OTP', otpSchema);