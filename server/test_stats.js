const pool = require('./db/pool');
async function test() {
  try {
    const res = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN UPPER(TRIM(status))='PENDING' THEN 1 END) AS pending,
        COUNT(CASE WHEN UPPER(TRIM(status))='PAYMENT SUBMITTED' THEN 1 END) AS payment_submitted,
        COUNT(CASE WHEN is_payment_verified = 1 THEN 1 END) AS payment_verified,
        COUNT(CASE WHEN is_medical_cleared = 1 THEN 1 END) AS medical_cleared,
        COUNT(CASE WHEN is_admitted = 1 THEN 1 END) AS admitted,
        COUNT(CASE WHEN UPPER(TRIM(status))='REJECTED' THEN 1 END) AS rejected
      FROM applicants`);
    console.log('Counts:', JSON.stringify(res));

    const [sportRows] = await pool.query(`
      SELECT sport_selection, COUNT(*) AS count FROM applicants GROUP BY sport_selection`);
    console.log('Sports:', JSON.stringify(sportRows));

    const [catRows] = await pool.query(`
      SELECT age_category, COUNT(*) AS count
      FROM applicants
      WHERE age_category IS NOT NULL AND age_category != ''
      GROUP BY age_category`);
    console.log('Categories:', JSON.stringify(catRows));

    const [revRows] = await pool.query(`
      SELECT COALESCE(SUM(amount_paid),0) AS total_revenue,
             COUNT(*) AS total_payments
      FROM payments WHERE UPPER(TRIM(verification_status)) = 'VERIFIED'`);
    console.log('Revenue:', JSON.stringify(revRows));
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}
test();
