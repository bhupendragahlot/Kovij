import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as server from '../config/permissions.js';
import * as frontend from '../../kovij-fitness-zone/src/features/auth/permissionRules.js';

test('frontend permission rules mirror the server exactly', () => {
  assert.deepEqual(frontend.STAFF_ROLES, server.STAFF_ROLES);
  assert.deepEqual(frontend.PERMISSIONS, server.PERMISSIONS);
});

test('money and administration stay out of reach of trainers', () => {
  for (const p of ['payments.view', 'payments.collect', 'revenue.view', 'expenses.manage', 'settings.manage', 'staff.manage']) {
    assert.equal(server.can('trainer', p), false, p);
  }
  for (const p of ['workouts.manage', 'diets.manage', 'progress.manage', 'notes.manage', 'attendance.view']) {
    assert.equal(server.can('trainer', p), true, p);
  }
  assert.equal(server.can(undefined, 'members.view'), false);
});
