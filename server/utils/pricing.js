const DEFAULT_CAMP_FEE = parseFloat(process.env.CAMP_FEE) || 230000;
const DEFAULT_EARLY_BIRD_DEADLINE = process.env.EARLY_BIRD_DEADLINE || '2026-07-03';

const toNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(text);
};

const getPricingDefaults = () => ({
  camp_fee_amount: DEFAULT_CAMP_FEE,
  early_bird_enabled: true,
  early_bird_discount_pct: 10,
  early_bird_fee_amount: null,
  early_bird_deadline: DEFAULT_EARLY_BIRD_DEADLINE,
});

const getPricingConfig = async (pool, now = new Date()) => {
  const defaults = getPricingDefaults();
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (
      'camp_fee_amount',
      'early_bird_enabled',
      'early_bird_discount_pct',
      'early_bird_fee_amount',
      'early_bird_deadline'
    )`
  );

  const settings = { ...defaults };
  rows.forEach(({ setting_key, setting_value }) => {
    if (setting_key === 'camp_fee_amount') settings.camp_fee_amount = toNumber(setting_value, settings.camp_fee_amount);
    if (setting_key === 'early_bird_enabled') settings.early_bird_enabled = toBoolean(setting_value, settings.early_bird_enabled);
    if (setting_key === 'early_bird_discount_pct') settings.early_bird_discount_pct = toNumber(setting_value, settings.early_bird_discount_pct);
    if (setting_key === 'early_bird_fee_amount') settings.early_bird_fee_amount = toNumber(setting_value, null);
    if (setting_key === 'early_bird_deadline') settings.early_bird_deadline = setting_value || settings.early_bird_deadline;
  });

  const regularFee = Math.max(0, toNumber(settings.camp_fee_amount, DEFAULT_CAMP_FEE));
  const deadline = new Date(settings.early_bird_deadline || DEFAULT_EARLY_BIRD_DEADLINE);
  const earlyBirdActive = Boolean(settings.early_bird_enabled) && now <= deadline;
  const discountPct = Math.max(0, Math.min(100, toNumber(settings.early_bird_discount_pct, 10)));
  const fixedEarlyBirdFee = toNumber(settings.early_bird_fee_amount, null);
  const computedEarlyBirdFee = fixedEarlyBirdFee == null
    ? Math.round(regularFee * (1 - (discountPct / 100)))
    : Math.max(0, Math.round(fixedEarlyBirdFee));

  return {
    regular_fee: regularFee,
    early_bird_enabled: Boolean(settings.early_bird_enabled),
    early_bird_active: earlyBirdActive,
    early_bird_discount_pct: discountPct,
    early_bird_fee_amount: fixedEarlyBirdFee,
    computed_early_bird_fee: computedEarlyBirdFee,
    early_bird_deadline: settings.early_bird_deadline || DEFAULT_EARLY_BIRD_DEADLINE,
    fee_source: fixedEarlyBirdFee == null ? 'discount_pct' : 'fixed_amount',
  };
};

module.exports = {
  DEFAULT_CAMP_FEE,
  DEFAULT_EARLY_BIRD_DEADLINE,
  toNumber,
  toBoolean,
  getPricingDefaults,
  getPricingConfig,
};