//models/Plan.js
import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true,
    enum: ['day', 'week', 'month', 'year']
  },
  features: [{
    type: String,
    required: true
  }],
  popular: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: 'from-gray-600 to-gray-700'
  },
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
   showOnFrontend: { // also called showOnFrontend:
    type: Boolean,
    default: true
  },
}, {
  timestamps: true
});

const Plan = mongoose.model('Plan', planSchema);

export default Plan;
