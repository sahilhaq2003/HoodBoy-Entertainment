const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: {
    type: String,
    enum: ['admin', 'manager', 'artist', 'finance', 'marketing'],
    default: 'manager'
  },
  avatar: { type: String, default: '' },
  department: { type: String, default: '' },
  phone: { type: String, default: '' },
  notificationPreferences: [{
    key: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  }],
  appearance: {
    theme: { type: String, enum: ['light', 'indigo', 'warm', 'dark'], default: 'light' },
    fontSize: { type: String, enum: ['small', 'default', 'large'], default: 'default' },
  },
  integrationLinks: {
    spotify: { type: String, default: '' },
    appleMusic: { type: String, default: '' },
    distributor: { type: String, default: '' },
  },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: '', select: false },
  passwordResetToken: { type: String, default: '', select: false },
  passwordResetExpires: { type: Date, select: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.index({ isActive: 1, name: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
