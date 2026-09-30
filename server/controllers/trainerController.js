import Trainer from '../models/Trainer.js';
import { crudController } from './crudFactory.js';

export const trainers = crudController(Trainer, {
  label: 'Trainer',
  plural: 'trainers',
  sort: { createdAt: 1 },
  // Phone, email and shift are for staff only.
  publicFields: 'name role image instagram description specialties showOnFrontend',
  publicFilter: { isActive: { $ne: false } },
});
