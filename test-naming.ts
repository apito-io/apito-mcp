import assert from 'node:assert/strict';
import {
  canonicalizeFieldIdentifier,
  fieldIdentifierNeedsCanonicalization,
  apitoSingularResourceName,
  apitoMultipleResourceName,
  apitoStoredSnakeModelId,
  apitoConnectionFieldNameForRelation,
  apitoRelationFilterGraphQLKey,
  apitoMutationConnectHasOneIdField,
  apitoMutationConnectHasManyIdsField,
  rootOperationsForModel,
  buildPublicGraphqlModelMap,
} from './src/apito-naming.js';
import { buildProbePublicDocumentQuery, summarizeProbeRelations } from './src/public-graphql.js';

assert.equal(canonicalizeFieldIdentifier('subscriptionPlanDraft'), 'subscription_plan_draft');
assert.equal(canonicalizeFieldIdentifier('Pro Request Email'), 'pro_request_email');
assert.equal(canonicalizeFieldIdentifier('proRequestEmail'), 'pro_request_email');
assert.equal(canonicalizeFieldIdentifier('pro_request_email'), 'pro_request_email');
assert.equal(canonicalizeFieldIdentifier('Weight (KG)'), 'weight_kg');

assert.equal(fieldIdentifierNeedsCanonicalization('subscriptionPlanDraft'), true);
assert.equal(fieldIdentifierNeedsCanonicalization('pro_request_email'), false);

assert.equal(apitoSingularResourceName('food_order'), 'foodOrder');
assert.equal(apitoMultipleResourceName('food_order'), 'foodOrderList');
assert.equal(apitoStoredSnakeModelId('FoodCategory'), 'food_category');
assert.equal(apitoConnectionFieldNameForRelation('customer', 'has_one'), 'customer');
assert.equal(apitoConnectionFieldNameForRelation('ledger', 'has_many'), 'ledger_list');
assert.equal(apitoRelationFilterGraphQLKey('ledger', null), 'ledger');
assert.equal(apitoRelationFilterGraphQLKey('ledger', 'primary_ledger'), 'primary_ledger');
assert.equal(apitoMutationConnectHasOneIdField('customer'), 'customer_id');
assert.equal(apitoMutationConnectHasManyIdsField('ledger'), 'ledger_ids');

const ops = rootOperationsForModel('order');
assert.equal(ops.list, 'orderList');
assert.equal(ops.create, 'createOrder');

const map = buildPublicGraphqlModelMap(
  {
    name: 'order',
    fields: [
      { identifier: 'total', field_type: 'number' },
      { identifier: 'note', field_type: 'text' },
    ],
    connections: [
      { model: 'customer', relation: 'has_one' },
      { model: 'ledger', relation: 'has_many' },
    ],
  },
  ['order', 'customer', 'ledger', 'product']
);
assert.equal(map.root_operations.get_one, 'order');
assert.equal(map.relations.length, 2);
assert.equal(map.relations[0]!.selection_key, 'customer');
assert.equal(map.relations[0]!.connect_key, 'customer_id');
assert.equal(map.relations[1]!.selection_key, 'ledger_list');
assert.equal(map.relations[1]!.connect_key, 'ledger_ids');
assert.ok(map.missing_notes.some((n) => n.includes('product')));

const emptyMap = buildPublicGraphqlModelMap({ name: 'tag', fields: [], connections: [] });
assert.ok(emptyMap.missing_notes[0]?.includes('no forward connections'));

const built = buildProbePublicDocumentQuery({
  modelMap: map,
  relations: ['customer', 'missing_thing'],
  peerDataFields: { customer: ['name'] },
});
assert.ok(built.query.includes('order(_id: $_id)'));
assert.ok(built.query.includes('customer {'));
assert.equal(built.selectedRelations.length, 1);
assert.equal(built.skippedRelations[0]!.selection_key, 'missing_thing');

const report = summarizeProbeRelations(
  { order: { id: '1', customer: { id: 'c1' }, ledger_list: [] } },
  'order',
  map.relations,
  []
);
assert.equal(report.find((r) => r.selection_key === 'customer')?.status, 'present');
assert.equal(report.find((r) => r.selection_key === 'ledger_list')?.status, 'empty_list');

console.log('test-naming: ok');
