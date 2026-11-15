ALTER TABLE shipping_methods ADD COLUMN pricing_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE shipping_methods ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';
UPDATE shipping_methods SET pricing_json='[{"label":"پایه","destRegion":"*","basePrice":0,"baseWeightLimit":1000,"baseWeightUnit":"g","overageStepWeight":1000,"overageStepUnit":"g","overageStepPrice":0,"maxWeight":30000,"etaDaysMin":3,"etaDaysMax":5}]' WHERE code='post_pishtaz' AND pricing_json='[]';
