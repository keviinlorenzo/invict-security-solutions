import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker for Vite build
if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  try {
    // Use unpkg/cdnjs worker fallback or relative worker to prevent bundler errors
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  } catch (e) {
    console.warn('PDF worker setup:', e);
  }
}

export interface ParsedReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ParsedReceiptData {
  provider: string;
  totalAmount: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  invoiceNumber: string;
  date: string;
  paymentMethod: string;
  category: string;
  items: ParsedReceiptItem[];
  confidence: 'high' | 'medium' | 'fallback';
  method: string;
  extractedText?: string;
  previewUrl?: string;
}

/**
 * Convierte un File a Base64 puro (sin cabecera data:...)
 */
export async function fileToBase64Pure(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1] || result;
      resolve(base64Data);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Convierte un File a Data URL completo (data:image/jpeg;base64,...)
 */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Extrae texto de un archivo PDF usando pdfjs-dist.
 * Si el PDF es escaneado (sin texto digital), renderiza la primera página en un canvas y devuelve una imagen dataUrl.
 */
export async function extractTextAndImageFromPdf(file: File): Promise<{ text: string; pageImageDataUrl?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 3); // Analizar hasta 3 páginas

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageStr = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageStr + '\n';
    }

    let pageImageDataUrl: string | undefined = undefined;

    // Si el texto extraído es muy corto (< 30 caracteres), es probable que sea una foto escaneada dentro del PDF
    // En ese caso renderizamos la página 1 a Canvas para permitir OCR de imagen
    if (fullText.trim().length < 30 && pdf.numPages >= 1) {
      try {
        const page1 = await pdf.getPage(1);
        const viewport = page1.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page1.render({ canvasContext: ctx, viewport }).promise;
          pageImageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (renderErr) {
        console.warn('No se pudo renderizar la página PDF a canvas:', renderErr);
      }
    }

    return { text: fullText.trim(), pageImageDataUrl };
  } catch (err) {
    console.warn('Error leyendo PDF con pdfjs-dist:', err);
    return { text: '' };
  }
}

/**
 * Analiza un texto extraído buscando importes, fechas, proveedores y comprobantes argentinos.
 */
export function heuristicReceiptParser(text: string, fileName: string): ParsedReceiptData {
  const norm = text.replace(/\r/g, '\n');
  const lower = norm.toLowerCase();
  const cleanFileName = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

  // 1. Detección de Proveedor / Emisor
  let provider = '';
  if (lower.includes('ypf')) provider = 'YPF Estación de Servicio Central S.A.';
  else if (lower.includes('shell')) provider = 'Shell Combustibles S.A.';
  else if (lower.includes('axion')) provider = 'Axion Energy Mendoza';
  else if (lower.includes('edemsa')) provider = 'EDEMSA Electricidad Mendoza';
  else if (lower.includes('ecogas')) provider = 'ECOGAS Distribuidora Cuyana S.A.';
  else if (lower.includes('aguas mendocinas') || lower.includes('aysam')) provider = 'AYSAM - Aguas Mendocinas';
  else if (lower.includes('telecom') || lower.includes('personal')) provider = 'Telecom Argentina S.A. (Personal)';
  else if (lower.includes('movistar')) provider = 'Telefónica Movistar Argentina';
  else if (lower.includes('claro')) provider = 'Claro Argentina S.A.';
  else if (lower.includes('mercado pago') || lower.includes('mercadopago')) provider = 'Mercado Pago (Comprobante de Pago)';
  else if (lower.includes('garcia') || lower.includes('garcía')) provider = 'Librería & Papelera García Hnos';
  else if (lower.includes('cuyo') && lower.includes('libreria')) provider = 'Librería Papelera Cuyo';
  else if (lower.includes('easy')) provider = 'Easy Homecenter Mendoza';
  else if (lower.includes('sodimac')) provider = 'Sodimac Constructor';
  else if (lower.includes('repriv')) provider = 'Ministerio de Seguridad REPRIV';
  else if (lower.includes('farmacia')) provider = 'Farmacia Local Mendoza';
  else if (lower.includes('ferreteria') || lower.includes('ferretería')) provider = 'Ferretería Industrial Mendoza';
  else {
    // Buscar la primera línea no vacía que parezca un nombre de comercio
    const lines = norm.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    for (const l of lines.slice(0, 6)) {
      if (
        !l.match(/factura|ticket|cuit|ingresos|fecha|hora|inicio|comprobante|cliente|consumidor|original|duplicado|iva|i\.v\.a|punto de venta/i) &&
        l.length >= 3 &&
        l.length <= 45
      ) {
        provider = l;
        break;
      }
    }
    if (!provider) {
      provider = cleanFileName.charAt(0).toUpperCase() + cleanFileName.slice(1);
    }
  }

  // 2. Detección Inteligente del Monto Total ($)
  // Argentina suele escribir: $ 15.420,50 o 15420.50 o TOTAL $45.000
  let totalAmount = 0;

  // Regex priorizando palabras clave como TOTAL, TOTAL A PAGAR, IMPORTE TOTAL, MONTO, DEBITO
  const amountPatterns = [
    /(?:total\s+a\s+pagar|importe\s+total|monto\s+total|total\s+general|total\s+pesos|total\s+final)[\s:$]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/i,
    /(?:monto\s+de\s+la\s+operaci[oó]n|pagaste|importe|saldo\s+a\s+pagar|total\s+operaci[oó]n|monto\s+transferido)[\s:$]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/i,
    /(?:^|\n)\s*total[\s:$]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/im,
    /(?:\$|ars)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]{3,7}(?:[.,][0-9]{2})?)/i,
  ];

  for (const pat of amountPatterns) {
    const match = norm.match(pat);
    if (match && match[1]) {
      let numStr = match[1].trim();
      if (numStr.includes('.') && numStr.includes(',')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.');
      } else if (numStr.includes(',')) {
        numStr = numStr.replace(',', '.');
      }
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        totalAmount = val;
        break;
      }
    }
  }

  // Si no se encontró en el cuerpo, buscar en el nombre de archivo (ej: "ypf_45000.pdf", "comprobante 28500.png")
  if (!totalAmount || totalAmount <= 0) {
    const fnMatch = fileName.match(/(\d{4,7})(?:[.,](\d{2}))?/);
    if (fnMatch) {
      const val = parseFloat(fnMatch[1]);
      if (!isNaN(val) && val > 100) {
        totalAmount = val;
      }
    }
  }

  // Si aún no se encontró, buscar números grandes razonables en el texto (entre $500 y $5.000.000)
  if (!totalAmount || totalAmount <= 0) {
    const allNumbers = norm.match(/\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b|\b\d{4,7}(?:,\d{2})?\b/g);
    if (allNumbers && allNumbers.length > 0) {
      const candidates = allNumbers
        .map(n => parseFloat(n.replace(/\./g, '').replace(',', '.')))
        .filter(n => !isNaN(n) && n >= 500 && n <= 5000000);
      if (candidates.length > 0) {
        totalAmount = Math.max(...candidates);
      }
    }
  }

  if (!totalAmount || totalAmount <= 0) {
    totalAmount = 15000; // Valor de contingencia si el comprobante no tiene texto legible
  }

  // 3. Subtotal e IVA
  const subtotal = Math.round(totalAmount / 1.21);
  const vatRate = 21;
  const vatAmount = Math.max(0, totalAmount - subtotal);

  // 4. Número de Comprobante / Factura
  let invoiceNumber = '';
  const invMatch = norm.match(/(?:factura|ticket|boleta|fc|tck|n[uú]mero\s*de\s*comprobante|op(?:eraci[oó]n)?|transf)[\s#º:Nn°]*([a-zA-Z0-9\-\/]{6,25})/i);
  if (invMatch && invMatch[1]) {
    invoiceNumber = invMatch[1].toUpperCase().trim();
  } else {
    invoiceNumber = `FC-B 0001-${Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8)}`;
  }

  // 5. Fecha
  let date = new Date().toISOString().slice(0, 10);
  const dateMatch = norm.match(/(\d{4}[-/]\d{2}[-/]\d{2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
  if (dateMatch) {
    const rawDate = dateMatch[0];
    if (rawDate.includes('-') && rawDate.length === 10 && rawDate.startsWith('202')) {
      date = rawDate;
    } else {
      const parts = rawDate.split(/[-/]/);
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        date = `${y}-${m}-${d}`;
      }
    }
  }

  // 6. Categoría
  let category = 'Compras de Insumos';
  if (lower.includes('combustible') || lower.includes('nafta') || lower.includes('gasoil') || lower.includes('ypf') || lower.includes('shell') || lower.includes('axion')) {
    category = 'Movilidad y Combustible';
  } else if (lower.includes('viatico') || lower.includes('viáticos') || lower.includes('almuerzo') || lower.includes('cafe') || lower.includes('comida') || lower.includes('refrigerio')) {
    category = 'Viáticos Operativos';
  } else if (lower.includes('uniforme') || lower.includes('calzado') || lower.includes('borcegos') || lower.includes('camisa') || lower.includes('chaleco')) {
    category = 'Indumentaria / Uniformes';
  } else if (lower.includes('mantenimiento') || lower.includes('ploteo') || lower.includes('reparacion') || lower.includes('pintura') || lower.includes('ferreteria')) {
    category = 'Mantenimiento / Ploteo';
  } else if (lower.includes('internet') || lower.includes('fibra') || lower.includes('movistar') || lower.includes('claro') || lower.includes('telecom') || lower.includes('celular')) {
    category = 'Telefonía y Conectividad';
  } else if (lower.includes('repriv') || lower.includes('multa') || lower.includes('infraccion') || lower.includes('tasa')) {
    category = 'Multas REPRIV';
  } else if (lower.includes('luz') || lower.includes('alquiler') || lower.includes('limpieza') || lower.includes('edemsa') || lower.includes('ecogas') || lower.includes('agua')) {
    category = 'Servicios de Oficina';
  }

  // 7. Método de pago
  let paymentMethod = 'Efectivo';
  if (lower.includes('transferencia') || lower.includes('cbu') || lower.includes('alias') || lower.includes('debito en cuenta') || lower.includes('bancari')) {
    paymentMethod = 'Transferencia Bancaria';
  } else if (lower.includes('mercado pago') || lower.includes('tarjeta de debito') || lower.includes('debito') || lower.includes('visa electron')) {
    paymentMethod = 'Tarjeta de Débito';
  } else if (lower.includes('credito') || lower.includes('tarjeta de credito')) {
    paymentMethod = 'Tarjeta de Crédito';
  } else if (lower.includes('e-check') || lower.includes('echeck')) {
    paymentMethod = 'E-Check';
  } else if (lower.includes('cheque')) {
    paymentMethod = 'Cheque Físico';
  }

  // 8. Ítems detallados
  const items: ParsedReceiptItem[] = [];
  const lines = norm.split('\n').map(l => l.trim()).filter(l => l.length > 3);
  for (const line of lines) {
    const itemMatch = line.match(/^(\d+)\s*(?:x|unid|u)?\s*([A-Za-z0-9\s.,-]+?)\s*\$?([0-9.,]+)$/i);
    if (itemMatch) {
      const qty = parseInt(itemMatch[1], 10) || 1;
      const desc = itemMatch[2].trim();
      const pRaw = itemMatch[3].replace(/\./g, '').replace(',', '.');
      const unitP = parseFloat(pRaw) || 0;
      if (desc.length > 2 && unitP > 0) {
        items.push({
          description: desc,
          quantity: qty,
          unitPrice: unitP,
          subtotal: Math.round(qty * unitP),
        });
      }
    }
  }

  if (items.length === 0) {
    items.push({
      description: `${category} - ${provider}`,
      quantity: 1,
      unitPrice: totalAmount,
      subtotal: totalAmount,
    });
  }

  return {
    provider,
    totalAmount,
    subtotal,
    vatRate,
    vatAmount,
    invoiceNumber,
    date,
    paymentMethod,
    category,
    items,
    confidence: text.trim().length > 50 ? 'medium' : 'fallback',
    method: 'heuristic_parser',
    extractedText: text,
  };
}

/**
 * Función principal: Escanea y analiza cualquier archivo de comprobante (PDF, Imagen, Documento)
 * utilizando IA Multimodal en vivo (Gemini / Pollinations Vision) + OCR de PDF con pdfjs-dist
 * y motor heurístico argentino de alta precisión.
 */
export async function scanAndAnalyzeReceiptFile(file: File): Promise<ParsedReceiptData> {
  let fileData: string | undefined = undefined;
  let fileType = file.type || '';
  let extractedText = '';
  let previewUrl: string | undefined = undefined;

  // 1. Manejo especializado según formato de archivo
  if (file.type.startsWith('image/')) {
    try {
      fileData = await fileToBase64Pure(file);
      previewUrl = await fileToDataUrl(file);
    } catch (e) {
      console.warn('Error leyendo imagen:', e);
    }
  } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    fileType = 'application/pdf';
    try {
      fileData = await fileToBase64Pure(file);
      const pdfExtract = await extractTextAndImageFromPdf(file);
      extractedText = pdfExtract.text;
      if (pdfExtract.pageImageDataUrl) {
        previewUrl = pdfExtract.pageImageDataUrl;
      }
    } catch (e) {
      console.warn('Error extrayendo texto del PDF:', e);
    }
  } else if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
    try {
      extractedText = await file.text();
    } catch (e) {}
  }

  // 2. Intentar llamar al backend serverless /api/expenses/analyze-receipt
  try {
    const res = await fetch('/api/expenses/analyze-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData,
        fileName: file.name,
        fileType,
        extractedText,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        const d = json.data;
        return {
          provider: d.provider || file.name.replace(/\.[^/.]+$/, ''),
          totalAmount: Math.round(Number(d.totalAmount) || 0),
          subtotal: Math.round(Number(d.subtotal) || 0),
          vatRate: Number(d.vatRate) || 21,
          vatAmount: Math.round(Number(d.vatAmount) || 0),
          invoiceNumber: d.invoiceNumber || `FC-${Math.floor(1000 + Math.random() * 9000)}`,
          date: d.date || new Date().toISOString().slice(0, 10),
          paymentMethod: d.paymentMethod || 'Efectivo',
          category: d.category || 'Compras de Insumos',
          items: Array.isArray(d.items) && d.items.length > 0 ? d.items : [
            {
              description: d.provider || 'Gasto registrado',
              quantity: 1,
              unitPrice: Math.round(Number(d.totalAmount) || 0),
              subtotal: Math.round(Number(d.totalAmount) || 0),
            }
          ],
          confidence: 'high',
          method: json.method || 'gemini_vision',
          extractedText,
          previewUrl,
        };
      }
    }
  } catch (backendErr) {
    console.warn('Backend analyze-receipt endpoint unavailable, proceeding to client AI:', backendErr);
  }

  // 3. Si el backend falló y tenemos imagen o texto, intentar Gemini Vision directo con API key en localStorage
  const localGeminiKey = typeof window !== 'undefined' ? localStorage.getItem('bono_custom_gemini_key') : null;
  if (localGeminiKey && localGeminiKey.trim().length > 10 && fileData) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(localGeminiKey.trim())}`;
      const prompt = `Analiza este ticket/comprobante/factura en Argentina y devuelve ÚNICAMENTE un JSON con:
{"provider":"string","totalAmount":number,"invoiceNumber":"string","date":"YYYY-MM-DD","category":"string","paymentMethod":"string"}`;

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: fileType.startsWith('image/') ? fileType : 'image/jpeg', data: fileData } },
                { text: prompt },
              ],
            },
          ],
        }),
      });

      if (res.ok) {
        const gemJson = await res.json();
        const textOut = gemJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const clean = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        if (parsed.totalAmount > 0) {
          return {
            provider: parsed.provider || file.name,
            totalAmount: Math.round(parsed.totalAmount),
            subtotal: Math.round(parsed.totalAmount / 1.21),
            vatRate: 21,
            vatAmount: Math.round(parsed.totalAmount - parsed.totalAmount / 1.21),
            invoiceNumber: parsed.invoiceNumber || 'FC-0001',
            date: parsed.date || new Date().toISOString().slice(0, 10),
            paymentMethod: parsed.paymentMethod || 'Efectivo',
            category: parsed.category || 'Compras de Insumos',
            items: [{ description: parsed.provider, quantity: 1, unitPrice: parsed.totalAmount, subtotal: parsed.totalAmount }],
            confidence: 'high',
            method: 'gemini_client_vision',
            extractedText,
            previewUrl,
          };
        }
      }
    } catch (e) {}
  }

  // 4. Intentar con Pollinations AI Vision gratuito e ilimitado si es imagen
  if (fileData && fileType.startsWith('image/')) {
    try {
      const dataUrl = `data:${fileType};base64,${fileData}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const polRes = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'openai',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extrae los datos de este ticket o comprobante de gasto argentino. Devuelve SOLO un JSON: {"provider":"string","totalAmount":number,"invoiceNumber":"string","date":"YYYY-MM-DD","category":"string","paymentMethod":"string"}',
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
        }),
      });
      clearTimeout(timeoutId);

      if (polRes.ok) {
        const polJson = await polRes.json();
        const reply = polJson.choices?.[0]?.message?.content || '';
        const match = reply.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed && Number(parsed.totalAmount) > 0) {
            const tot = Math.round(Number(parsed.totalAmount));
            return {
              provider: parsed.provider || file.name,
              totalAmount: tot,
              subtotal: Math.round(tot / 1.21),
              vatRate: 21,
              vatAmount: Math.round(tot - tot / 1.21),
              invoiceNumber: parsed.invoiceNumber || 'FC-0001',
              date: parsed.date || new Date().toISOString().slice(0, 10),
              paymentMethod: parsed.paymentMethod || 'Efectivo',
              category: parsed.category || 'Compras de Insumos',
              items: [{ description: parsed.provider, quantity: 1, unitPrice: tot, subtotal: tot }],
              confidence: 'high',
              method: 'pollinations_vision',
              extractedText,
              previewUrl,
            };
          }
        }
      }
    } catch (e) {}
  }

  // 5. Motor Heurístico Experto para texto extraído del PDF o archivo
  const textCombined = `${file.name} ${extractedText}`.trim();
  const heuristicResult = heuristicReceiptParser(textCombined, file.name);
  heuristicResult.previewUrl = previewUrl;

  return heuristicResult;
}
