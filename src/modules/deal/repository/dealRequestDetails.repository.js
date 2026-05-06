const { pool } = require('../../../infrastructure/config/db');

const run = (client) => client || pool;

const upsertSupplyDetails = async (client, requestId, details) => {
  const executor = run(client);
  const result = await executor.query(
    `
      INSERT INTO deal_request_supply_details (
        request_id,
        product_service_name,
        category,
        quantity_required,
        delivery_location,
        delivery_date,
        target_price_min,
        target_price_max,
        currency,
        payment_terms_preference,
        incoterm,
        bulk_discount_expectation,
        supply_type,
        key_specifications,
        material,
        dimensions_size,
        certifications_required,
        quality_level,
        quality_level_other_text,
        country_of_origin,
        max_lead_time_accepted,
        delivery_method_preference,
        packaging_requirements,
        special_conditions_notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17::jsonb, $18, $19, $20, $21, $22, $23, $24
      )
      ON CONFLICT (request_id)
      DO UPDATE SET
        product_service_name = EXCLUDED.product_service_name,
        category = EXCLUDED.category,
        quantity_required = EXCLUDED.quantity_required,
        delivery_location = EXCLUDED.delivery_location,
        delivery_date = EXCLUDED.delivery_date,
        target_price_min = EXCLUDED.target_price_min,
        target_price_max = EXCLUDED.target_price_max,
        currency = EXCLUDED.currency,
        payment_terms_preference = EXCLUDED.payment_terms_preference,
        incoterm = EXCLUDED.incoterm,
        bulk_discount_expectation = EXCLUDED.bulk_discount_expectation,
        supply_type = EXCLUDED.supply_type,
        key_specifications = EXCLUDED.key_specifications,
        material = EXCLUDED.material,
        dimensions_size = EXCLUDED.dimensions_size,
        certifications_required = EXCLUDED.certifications_required,
        quality_level = EXCLUDED.quality_level,
        quality_level_other_text = EXCLUDED.quality_level_other_text,
        country_of_origin = EXCLUDED.country_of_origin,
        max_lead_time_accepted = EXCLUDED.max_lead_time_accepted,
        delivery_method_preference = EXCLUDED.delivery_method_preference,
        packaging_requirements = EXCLUDED.packaging_requirements,
        special_conditions_notes = EXCLUDED.special_conditions_notes,
        updated_at = NOW()
      RETURNING *
    `,
    [
      requestId,
      details.productServiceName,
      details.category,
      details.quantityRequired ?? null,
      details.deliveryLocation ?? null,
      details.deliveryDate ?? null,
      details.targetPriceMin ?? null,
      details.targetPriceMax ?? null,
      details.currency ?? null,
      details.paymentTermsPreference ?? null,
      details.incoterm ?? null,
      details.bulkDiscountExpectation ?? null,
      details.supplyType ?? null,
      details.keySpecifications ?? null,
      details.material ?? null,
      details.dimensionsSize ?? null,
      JSON.stringify(details.certificationsRequired || []),
      details.qualityLevel ?? null,
      details.qualityLevelOtherText ?? null,
      details.countryOfOrigin ?? null,
      details.maxLeadTimeAccepted ?? null,
      details.deliveryMethodPreference ?? null,
      details.packagingRequirements ?? null,
      details.specialConditionsNotes ?? null,
    ]
  );
  return result.rows[0];
};

const upsertDemandDetails = async (client, requestId, details) => {
  const executor = run(client);
  const result = await executor.query(
    `
      INSERT INTO deal_request_demand_details (
        request_id,
        product_service_name,
        available_quantity,
        offer_validity_days,
        unit_price,
        currency,
        total_price,
        volume_discount_tiers,
        moq,
        availability_type,
        quantity_in_stock,
        max_produce_quantity,
        production_lead_time,
        specs_match_rfq,
        differences_from_rfq,
        material_offered,
        dimensions,
        certifications_held,
        payment_terms,
        delivery_terms,
        warranty_return_policy,
        exclusivity_confidentiality,
        additional_notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19::jsonb, $20, $21, $22, $23
      )
      ON CONFLICT (request_id)
      DO UPDATE SET
        product_service_name = EXCLUDED.product_service_name,
        available_quantity = EXCLUDED.available_quantity,
        offer_validity_days = EXCLUDED.offer_validity_days,
        unit_price = EXCLUDED.unit_price,
        currency = EXCLUDED.currency,
        total_price = EXCLUDED.total_price,
        volume_discount_tiers = EXCLUDED.volume_discount_tiers,
        moq = EXCLUDED.moq,
        availability_type = EXCLUDED.availability_type,
        quantity_in_stock = EXCLUDED.quantity_in_stock,
        max_produce_quantity = EXCLUDED.max_produce_quantity,
        production_lead_time = EXCLUDED.production_lead_time,
        specs_match_rfq = EXCLUDED.specs_match_rfq,
        differences_from_rfq = EXCLUDED.differences_from_rfq,
        material_offered = EXCLUDED.material_offered,
        dimensions = EXCLUDED.dimensions,
        certifications_held = EXCLUDED.certifications_held,
        payment_terms = EXCLUDED.payment_terms,
        delivery_terms = EXCLUDED.delivery_terms,
        warranty_return_policy = EXCLUDED.warranty_return_policy,
        exclusivity_confidentiality = EXCLUDED.exclusivity_confidentiality,
        additional_notes = EXCLUDED.additional_notes,
        updated_at = NOW()
      RETURNING *
    `,
    [
      requestId,
      details.productServiceName,
      details.availableQuantity ?? null,
      details.offerValidityDays ?? null,
      details.unitPrice ?? null,
      details.currency ?? null,
      details.totalPrice ?? null,
      JSON.stringify(details.volumeDiscountTiers || []),
      details.moq ?? null,
      details.availabilityType ?? null,
      details.quantityInStock ?? null,
      details.maxProduceQuantity ?? null,
      details.productionLeadTime ?? null,
      details.specsMatchRfq ?? null,
      details.differencesFromRfq ?? null,
      details.materialOffered ?? null,
      details.dimensions ?? null,
      JSON.stringify(details.certificationsHeld || []),
      details.paymentTerms ?? null,
      details.deliveryTerms ?? null,
      details.warrantyReturnPolicy ?? null,
      details.exclusivityConfidentiality ?? null,
      details.additionalNotes ?? null,
    ]
  );
  return result.rows[0];
};

const replaceRequestAttachments = async (client, requestId, attachments = []) => {
  const executor = run(client);
  await executor.query('DELETE FROM deal_request_attachments WHERE request_id = $1', [requestId]);

  if (!attachments.length) return [];

  const rows = [];
  for (const attachment of attachments) {
    const result = await executor.query(
      `
        INSERT INTO deal_request_attachments (request_id, file_id, sort_order)
        VALUES ($1, $2, $3)
        RETURNING id, request_id, file_id, sort_order, created_at
      `,
      [requestId, attachment.fileId, attachment.sortOrder ?? 0]
    );
    rows.push(result.rows[0]);
  }

  return rows;
};

const getSupplyDetailsByRequestIds = async (requestIds = []) => {
  if (!requestIds.length) return [];
  const result = await pool.query(
    `
      SELECT *
      FROM deal_request_supply_details
      WHERE request_id = ANY($1::int[])
    `,
    [requestIds]
  );
  return result.rows;
};

const getDemandDetailsByRequestIds = async (requestIds = []) => {
  if (!requestIds.length) return [];
  const result = await pool.query(
    `
      SELECT *
      FROM deal_request_demand_details
      WHERE request_id = ANY($1::int[])
    `,
    [requestIds]
  );
  return result.rows;
};

const getAttachmentsByRequestIds = async (requestIds = []) => {
  if (!requestIds.length) return [];
  const result = await pool.query(
    `
      SELECT id, request_id, file_id, sort_order, created_at
      FROM deal_request_attachments
      WHERE request_id = ANY($1::int[])
      ORDER BY sort_order ASC, id ASC
    `,
    [requestIds]
  );
  return result.rows;
};

module.exports = {
  upsertSupplyDetails,
  upsertDemandDetails,
  replaceRequestAttachments,
  getSupplyDetailsByRequestIds,
  getDemandDetailsByRequestIds,
  getAttachmentsByRequestIds,
};
