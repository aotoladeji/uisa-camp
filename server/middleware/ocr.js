const fs = require('fs');
const path = require('path');
const os = require('os');

// Native modules (sharp, tesseract.js) are not available on Vercel serverless —
// load them lazily and fall back gracefully if they fail to load.
let sharp, Tesseract, pdfParse;
try { sharp = require('sharp'); } catch (_) { sharp = null; }
try { Tesseract = require('tesseract.js'); } catch (_) { Tesseract = null; }
try { pdfParse = require('pdf-parse'); } catch (_) { pdfParse = null; }

function emptyExtracted() {
  return {
    transaction_ref: null,
    amount_paid: null,
    payment_date: null,
    account_number: null,
    bank_name: null,
    account_name: null,
  };
}

function normalizeOcrText(raw) {
  return String(raw || '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeReference(ref) {
  if (!ref) return null;
  const cleaned = String(ref)
    .trim()
    .replace(/^[^A-Z0-9]+/i, '')
    .replace(/[^A-Z0-9/-]+$/i, '')
    .replace(/\s+/g, '');
  if (!cleaned) return null;
  // Avoid storing plain account numbers as transaction IDs.
  if (/^\d{10}$/.test(cleaned)) return null;
  return cleaned;
}

function extractAmount(text) {
  const candidates = [];
  // More inclusive regex for amounts, looking for digits after currency or keywords
  // Handles formats like "Amount: 230,000", "N230000", "NGN 230,000.00"
  const amountRegex = /(?:amount|amt|total|paid|debit|transfer|price|sum|value)\s*(?:is|:|-)?\s*(?:NGN|N|#|₦|NG)?\s*([\d]{1,3}(?:,[\d]{3})*(?:\.\d{1,2})?|[\d]{3,}(?:\.\d{1,2})?)/gi;
  const currencyPrefixRegex = /(?:NGN|N|#|₦|NG)\s*([\d]{1,3}(?:,[\d]{3})*(?:\.\d{1,2})?|[\d]{3,}(?:\.\d{1,2})?)/gi;
  // Look for any free-standing large number that looks like a fee
  const generalLargeNumberRegex = /\b([\d]{1,3}(?:,[\d]{3})+(?:\.\d{1,2})?|[\d]{5,}(?:\.\d{1,2})?)\b/g;

  const extractFromMatch = (match) => {
    if (!match || !match[1]) return;
    const raw = match[1].replace(/,/g, '').trim();
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 500 && parsed <= 10000000) {
      candidates.push(parsed);
    }
  };

  let m;
  while ((m = amountRegex.exec(text)) !== null) extractFromMatch(m);
  amountRegex.lastIndex = 0;

  while ((m = currencyPrefixRegex.exec(text)) !== null) extractFromMatch(m);
  currencyPrefixRegex.lastIndex = 0;

  while ((m = generalLargeNumberRegex.exec(text)) !== null) {
     const raw = m[1].replace(/,/g, '').trim();
     const parsed = Number.parseFloat(raw);
     if (Number.isFinite(parsed) && parsed >= 5000 && parsed <= 1000000) {
       candidates.push(parsed);
     }
  }
  generalLargeNumberRegex.lastIndex = 0;

  if (!candidates.length) return null;
  // Priority: 1. Values exactly matching camp fees, 2. Values in expected range, 3. Highest candidate
  const feeMatches = candidates.filter(v => v === 230000 || v === 180000 || v === 150000 || v === 250000);
  if (feeMatches.length) return feeMatches[0];
  
  const sensibleRange = candidates.filter(v => v >= 100000 && v <= 500000);
  if (sensibleRange.length) return Math.max(...sensibleRange);

  return Math.max(...candidates);
}

function extractFromText(text) {
  const extracted = emptyExtracted();
  const normalizedText = normalizeOcrText(text);

  // Extract transaction reference/ID (more patterns for Nigerian banks)
  const refPatterns = [
    /(?:transaction(?:\s*(?:id|ref(?:erence)?))?|trans|trx|ref(?:erence)?|session(?:\s*id)?|rrn|stan|retrieval\s*ref(?:erence)?|trace|trace\s*id|payment\s*ref)\s*(?:no|number|#|:|-|is)?\s*([A-Z0-9/_-]{6,40})/i,
    /(?:ref|session)\s*:\s*([A-Z0-9]{10,40})/i,
    /\b([A-Z]{2,}[0-9]{8,})\b/,
    /\b([0-9]{10,25})\b/, // Long numeric strings are often RRNs or Session IDs
  ];
  for (const pattern of refPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      const ref = sanitizeReference(match[1]);
      if (ref) {
        extracted.transaction_ref = ref;
        break;
      }
    }
  }

  // Extract amount
  extracted.amount_paid = extractAmount(normalizedText);

  // Extract date (various formats including full month names)
  const datePatterns = [
    /(?:date|on)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(?:time)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  ];
  for (const pattern of datePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      extracted.payment_date = match[1].trim();
      break;
    }
  }

  // Account Number (UISA targeted)
  if (normalizedText.includes('1805832892')) {
    extracted.account_number = '1805832892';
  } else {
    const accountPatterns = [
      /(?:account|acc|a\/c|acct)[\s:]*(\d{10})/i,
      /\b(\d{10})\b/,
    ];
    for (const pattern of accountPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        extracted.account_number = match[1].trim();
        break;
      }
    }
  }

  // Bank name
  const bankMatch = normalizedText.match(/(?:bank|paid\s+to|sender\s+bank|bank\s+name)[\s:]*([A-Za-z][A-Za-z\s.&-]{2,40})/i)
    || normalizedText.match(/\b(Access\s+Bank|GTBank|GTB|First\s+Bank|UBA|Zenith\s+Bank|Fidelity\s+Bank|FCMB|Sterling\s+Bank|Union\s+Bank|Wema\s+Bank|Opay|Palmpay|Kuda|Moniepoint|Stanbic|Heritage|Polaris)\b/i);
  if (bankMatch) {
    extracted.bank_name = bankMatch[1].trim().replace(/\s{2,}/g, ' ');
  }

  // Account Name
  const accountNameMatch = normalizedText.match(/(?:account\s*name|acct\s*name|beneficiary|recipient|payee|receiver|sender)[\s:]*([A-Za-z][A-Za-z\s.'-]{3,80})/i);
  if (accountNameMatch) {
    extracted.account_name = accountNameMatch[1].trim().replace(/\s{2,}/g, ' ');
  }

  return extracted;
}

function hasUsefulExtraction(extracted) {
  return Boolean(
    extracted.transaction_ref ||
    extracted.amount_paid ||
    extracted.payment_date ||
    extracted.account_number ||
    extracted.bank_name ||
    extracted.account_name
  );
}

function mergeMissingFields(primary, secondary) {
  const merged = { ...primary };
  for (const [key, value] of Object.entries(secondary || {})) {
    if ((merged[key] === null || merged[key] === undefined || merged[key] === '') && value) {
      merged[key] = value;
    }
  }
  return merged;
}

async function ocrPdfPage(imageOrPath, pageIndex) {
  const pageImagePath = path.join(os.tmpdir(), `temp-ocr-${Date.now()}-${pageIndex + 1}.jpg`);
  try {
    const input = Buffer.isBuffer(imageOrPath) ? imageOrPath : imageOrPath;
    await sharp(input, { density: 300, page: pageIndex })
      .flatten({ background: '#ffffff' })
      .greyscale()
      .normalize()
      .sharpen()
      .jpeg({ quality: 90 })
      .toFile(pageImagePath);

    const ocrResult = await Tesseract.recognize(pageImagePath, 'eng');
    return ocrResult.data?.text || '';
  } finally {
    if (fs.existsSync(pageImagePath)) fs.unlinkSync(pageImagePath);
  }
}

/**
 * Extract payment details from receipt image using OCR
 * @param {string|Buffer} imageInput - Path to the receipt image or its Buffer
 * @returns {Promise<Object>} Extracted payment details
 */
async function extractPaymentDetails(imageInput) {
  // Skip OCR entirely when native modules are unavailable
  if (!sharp || !Tesseract) {
    console.log('OCR skipped: native modules (sharp/tesseract) not available.');
    return emptyExtracted();
  }

  // imageInput can be a file path (string) or a file buffer
  if (!imageInput) {
    console.log('OCR skipped: No image input provided.');
    return emptyExtracted();
  }

  // If it's a string, it MUST be a valid existing file path
  if (typeof imageInput === 'string') {
    // If it's a "memory:" pseudo-path or doesn't exist, we can't use it as a path.
    // However, if we have a buffer, we should use that instead.
    if (imageInput.startsWith('memory') || !fs.existsSync(imageInput)) {
      console.log('OCR warning: imageInput string is not a valid physical file path.', imageInput);
      return emptyExtracted();
    }
  }

  try {
    let text = '';
    let extracted = emptyExtracted();

    // Determine if it's a PDF
    const isPdf = Buffer.isBuffer(imageInput) 
      ? imageInput.toString('ascii', 0, 4) === '%PDF'
      : (typeof imageInput === 'string' && path.extname(imageInput).toLowerCase() === '.pdf');

    if (isPdf) {
      const fileBuffer = Buffer.isBuffer(imageInput) ? imageInput : fs.readFileSync(imageInput);
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text || '';
      extracted = extractFromText(text);

      if (!hasUsefulExtraction(extracted)) {
        for (const pageIndex of [0, 1]) {
          try {
            const pageText = await ocrPdfPage(imageInput, pageIndex);
            if (!pageText.trim()) continue;
            const pageExtracted = extractFromText(pageText);
            extracted = mergeMissingFields(extracted, pageExtracted);
            if (hasUsefulExtraction(extracted)) break;
          } catch (pageErr) {
            console.warn(`Skipping PDF OCR fallback for page ${pageIndex + 1}:`, pageErr.message);
          }
        }
      }
    } else {
      // Image processing using sharp (works with both path and buffer)
      const processedPath = path.join(os.tmpdir(), `temp-ocr-${Date.now()}-${Math.floor(Math.random()*1000)}.processed.jpg`);
      try {
        await sharp(imageInput)
          .greyscale()
          .normalize()
          .sharpen()
          .jpeg({ quality: 90 })
          .toFile(processedPath);

        const ocrResult = await Tesseract.recognize(processedPath, 'eng');
        text = ocrResult.data?.text || '';
        console.log('--- OCR RAW TEXT START ---');
        console.log(text);
        console.log('--- OCR RAW TEXT END ---');
        extracted = extractFromText(text);
      } finally {
        if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
      }
    }

    console.log('Final Extracted OCR details:', extracted);
    return extracted;
  } catch (error) {
    console.error('OCR extraction error:', error);
    return {
      ...emptyExtracted(),
      error: error.message
    };
  }
}

module.exports = { 
  extractPaymentDetails,
  hasUsefulExtraction
};
