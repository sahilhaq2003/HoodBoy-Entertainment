import { createWorker } from 'tesseract.js';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ReceiptScanResult = {
  reference: string;
  paymentDate: string;
  amount: number | null;
  confidence: number;
  text: string;
};

const compact = (value: string) => value.replace(/[|]/g, 'I').replace(/\s+/g, ' ').trim();

const referenceFromText = (text: string) => {
  const lines = text.split(/\r?\n/).map(compact).filter(Boolean);
  const labelled = /(?:transaction|transfer|payment|confirmation|reference|ref|trace|receipt|utr|rrn|authorization|auth)(?:\s*(?:no|number|id|code|#))?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/]{5,35})/i;
  for (const line of lines) {
    const match = line.match(labelled);
    const candidate = match?.[1]?.replace(/[^A-Z0-9\-/]/gi, '').toUpperCase();
    if (candidate && /\d/.test(candidate) && !/^(DATE|AMOUNT|TOTAL|ACCOUNT|NUMBER)$/i.test(candidate)) return candidate;
  }

  const excludedLine = /(account|amount|total|balance|date|time|phone|mobile|currency)/i;
  for (const line of lines) {
    if (excludedLine.test(line)) continue;
    const tokens = line.toUpperCase().match(/\b[A-Z0-9][A-Z0-9\-/]{7,27}\b/g) || [];
    const candidate = tokens.find(token => /\d/.test(token) && /[A-Z]/.test(token));
    if (candidate) return candidate;
  }
  return '';
};

const isoDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today || year < 2000) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const dateFromText = (text: string) => {
  const labelled = text.match(/(?:payment\s*date|transaction\s*date|transfer\s*date|date)\s*[:#\-]?\s*(\d{1,4}[\s./-]\d{1,2}[\s./-]\d{1,4})/i)?.[1];
  const raw = labelled || text.match(/\b(?:20\d{2}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]20\d{2})\b/)?.[0] || '';
  if (!raw) return '';
  const parts = raw.split(/[\s./-]+/).map(Number);
  if (parts[0] > 1900) return isoDate(parts[0], parts[1], parts[2]);
  return isoDate(parts[2], parts[1], parts[0]);
};

const amountFromText = (text: string) => {
  const match = text.match(/(?:amount\s*paid|paid\s*amount|transaction\s*amount|transfer\s*amount|grand\s*total|total\s*paid|amount|total)\s*[:#\-]?\s*(?:USD|LKR|GBP|EUR|\$|£|€|Rs\.?|LKR\.)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (!match?.[1]) return null;
  const amount = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const readPdf = async (file: File, progress: (value:number)=>void) => {
  const pdfDocument = await getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = Math.min(pdfDocument.numPages, 2);
  const extracted: string[] = [];
  for (let index = 1; index <= pages; index += 1) {
    const page = await pdfDocument.getPage(index);
    const content = await page.getTextContent();
    extracted.push(content.items.map(item => 'str' in item ? item.str : '').join(' '));
  }
  const embeddedText = extracted.join('\n').trim();
  if (embeddedText.length > 30) return { source: embeddedText, confidence: 99 };

  const page = await pdfDocument.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the PDF for scanning');
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  progress(25);
  return { source: canvas, confidence: 0 };
};

export const scanPaymentReceipt = async (file: File, onProgress: (value:number)=>void = () => {}) : Promise<ReceiptScanResult> => {
  onProgress(5);
  let source: File | HTMLCanvasElement = file;
  let text = '';
  let confidence = 0;

  if (file.type === 'application/pdf') {
    const pdf = await readPdf(file, onProgress);
    if (typeof pdf.source === 'string') {
      text = pdf.source;
      confidence = pdf.confidence;
    } else source = pdf.source;
  }

  if (!text) {
    const worker = await createWorker('eng', undefined, { logger: message => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') onProgress(25 + Math.round(message.progress * 70));
    }});
    try {
      const result = await worker.recognize(source);
      text = result.data.text || '';
      confidence = Math.round(Number(result.data.confidence || 0));
    } finally { await worker.terminate(); }
  }

  onProgress(100);
  return { reference: referenceFromText(text), paymentDate: dateFromText(text), amount: amountFromText(text), confidence, text };
};

export const _extractReceiptFields = (text: string) => ({ reference: referenceFromText(text), paymentDate: dateFromText(text), amount: amountFromText(text) });
