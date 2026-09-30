import Plan from '../models/Plan.js';
import Membership from '../models/Membership.js';
import { AppError } from '../middleware/errorHandler.js';
import { crudController } from './crudFactory.js';

export const plans = crudController(Plan, {
  label: 'Plan',
  plural: 'plans',
  sort: { price: 1, createdAt: 1 },
  async beforeDelete(plan) {
    // Deleting a sold plan would orphan membership history; archive it instead.
    if (await Membership.exists({ planId: plan._id })) {
      throw new AppError('Members have bought this plan. Mark it inactive instead of deleting it.', 409, 'PLAN_IN_USE');
    }
  },
});
