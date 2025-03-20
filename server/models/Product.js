//models/Product.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['protein', 'preworkout', 'vitamins', 'accessories']
  },
  price: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  image: {
    type: String,
    required: true
  },
  badge: {
    type: String
  },
  description: {
    type: String
  },
  stock: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Product = mongoose.model('Product', productSchema);

export default Product;
