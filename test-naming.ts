import assert from 'node:assert/strict';
import {
  canonicalizeFieldIdentifier,
  fieldIdentifierNeedsCanonicalization,
} from './src/apito-naming.js';

assert.equal(canonicalizeFieldIdentifier('subscriptionPlanDraft'), 'subscription_plan_draft');
assert.equal(canonicalizeFieldIdentifier('Pro Request Email'), 'pro_request_email');
assert.equal(canonicalizeFieldIdentifier('proRequestEmail'), 'pro_request_email');
assert.equal(canonicalizeFieldIdentifier('pro_request_email'), 'pro_request_email');
assert.equal(canonicalizeFieldIdentifier('Weight (KG)'), 'weight_kg');

assert.equal(fieldIdentifierNeedsCanonicalization('subscriptionPlanDraft'), true);
assert.equal(fieldIdentifierNeedsCanonicalization('pro_request_email'), false);

console.log('test-naming: ok');
