//models/Trainer.js
import mongoose from 'mongoose';

const trainerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  instagram: {
    type: String,
    default: 'https://instagram.com'
  },
  description: {
    type: String,
    required: true
  },
  showOnFrontend: {
    type: Boolean,
    default: true 
  }
},{ timestamps: true });

const Trainer = mongoose.model('Trainer', trainerSchema);

export default Trainer;
