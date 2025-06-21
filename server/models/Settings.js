//models/Settings.js
import mongoose from 'mongoose';

const SettingSchema = new mongoose.Schema({
  heroBackgroundImage: {
    type: String,
    default: "https://c1.wallpaperflare.com/preview/497/845/200/gym-strong-fitness-athlete.jpg"
  },
  heroHeadline: {
    type: String,
    default: "TRANSFORM YOUR BODY, TRANSFORM YOUR LIFE"
  },
  heroDescription: {
    type: String,
    default: "Achieve your fitness goals with state-of-the-art equipment, expert trainers, and a motivating environment."
  },
    address: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  facebook: {
    type: String
  },
  instagram: {
    type: String
  },
  whatsapp: {
    type: String
  },
  mapEmbedUrl: {
    type: String,
    default: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3712.1985550394793!2d75.89803922711107!3d25.179997694741587!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x396f911faffd7c31%3A0xec54a1034fdf7b9a!2sKovij%20Fitness%20Zone!5e0!3m2!1sen!2sin!4v1742579483445!5m2!1sen!2sin"
  }
});

const Settings = mongoose.model('Settings', SettingSchema);

export default Settings;
