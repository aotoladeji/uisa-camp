require('dotenv').config();
const app = require('./app');

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 UISA Camp Server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Camp Fee: ₦${(parseFloat(process.env.CAMP_FEE)||230000).toLocaleString()}`);
  console.log(`   Early Bird Deadline: ${process.env.EARLY_BIRD_DEADLINE || '2026-07-03'}\n`);
});
