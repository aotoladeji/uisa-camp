const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

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

function extractFromText(text) {
  const extracted = emptyExtracted();

  // Extract transaction reference/ID (various patterns)
  const refPatterns = [
    /(?:transaction|trans|ref|reference|trx)[\s:]*([A-Z0-9]{8,})/i,
    /(?:session\s*id|session)[\s:]*([A-Z0-9]{8,})/i,
    /\b([A-Z]{2,}\d{6,})\b/,
  ];
  for (const pattern of refPatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.transaction_ref = match[1].trim();
      break;
    }
  }

  // Extract amount (NGN/Naira patterns)
  const amountPatterns = [
    /(?:amount|amt|total|paid)[\s:]*(?:NGN|₦|N)?\s*([\d,]+\.?\d*)/i,
    /(?:NGN|₦|N)\s*([\d,]+\.?\d*)/,
    /\b([\d,]+\.00)\b/,
  ];
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      // Validate amount is reasonable (between 100k and 300k)
      if (amount >= 100000 && amount <= 300000) {
        extracted.amount_paid = amount;
        break;
      }
    }
  }

  // Extract date (various formats)
  const datePatterns = [
    /(?:date|on)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.payment_date = match[1].trim();
      break;
    }
  }

  // Extract account number
  const accountPatterns = [
    /(?:account|acc|a\/c)[\s:]*(\d{10})/i,
    /\b(1805832892)\b/,
    /\b(\d{10})\b/,
  ];
  for (const pattern of accountPatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.account_number = match[1].trim();
      break;
    }
  }

  const bankMatch = text.match(/(?:bank|paid\s+to\s+bank)[\s:]*([A-Za-z][A-Za-z\s.&-]{2,40})/i)
    || text.match(/\b(Access\s+Bank|GTBank|First\s+Bank|UBA|Zenith\s+Bank|Fidelity\s+Bank|FCMB|Sterling\s+Bank|Union\s+Bank|Wema\s+Bank|Opay|Palmpay)\b/i);
  if (bankMatch) {
    extracted.bank_name = bankMatch[1].trim().replace(/\s{2,}/g, ' ');
  }

  const accountNameMatch = text.match(/(?:account\s*name|acct\s*name|beneficiary|recipient|payee)[\s:]*([A-Za-z][A-Za-z\s.'-]{3,80})/i);
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

async function ocrPdfPage(imagePath, pageIndex) {
  const pageImagePath = `${imagePath}.page-${pageIndex + 1}.jpg`;
  try {
    await sharp(imagePath, { density: 300, page: pageIndex })
      .flatten({ background: '#ffffff' })
      .greyscale()
      .normalize()
      .sharpen()
      .jpeg({ quality: 90 })
      .toFile(pageImagePath);

    const ocrResult = await Tesseract.recognize(pageImagePath, 'eng', {
      logger: m => console.log(m)
    });
    return ocrResult.data?.text || '';
  } finally {
    if (fs.existsSync(pageImagePath)) fs.unlinkSync(pageImagePath);
  }
}

/**
 * Extract payment details from receipt image using OCR
 * @param {string} imagePath - Path to the receipt image
 * @returns {Promise<Object>} Extracted payment details
 */
async function extractPaymentDetails(imagePath) {
  try {
    const ext = path.extname(imagePath).toLowerCase();
    let text = '';
    let extracted = emptyExtracted();

    if (ext === '.pdf') {
      const fileBuffer = fs.readFileSync(imagePath);
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text || '';

      extracted = extractFromText(text);

      // Fallback for scanned/image-only PDFs: render first pages to images and OCR them.
      if (!hasUsefulExtraction(extracted)) {
        console.log('PDF text extraction was insufficient; running OCR fallback on PDF pages.');
        for (const pageIndex of [0, 1]) {
          try {
            const pageText = await ocrPdfPage(imagePath, pageIndex);
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
      // Preprocess image for better OCR accuracy
      const processedPath = imagePath + '.processed.jpg';
      try {
        await sharp(imagePath)
          .greyscale()
          .normalize()
          .sharpen()
          .jpeg({ quality: 90 })
          .toFile(processedPath);

        // Perform OCR
        const ocrResult = await Tesseract.recognize(processedPath, 'eng', {
          logger: m => console.log(m)
        });
        text = ocrResult.data?.text || '';
        extracted = extractFromText(text);
      } finally {
        if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
      }
    }

    console.log('OCR Text:', text);

    console.log('Extracted payment details:', extracted);
    return extracted;

  } catch (error) {
    console.error('OCR extraction error:', error);
    return {
      ...emptyExtracted(),
      error: error.message
    };
  }
}

module.exports = { extractPaymentDetails };
