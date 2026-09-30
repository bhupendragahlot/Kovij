import Product from '../models/Product.js';
import { crudController } from './crudFactory.js';

export const products = crudController(Product, { label: 'Product', plural: 'products' });
