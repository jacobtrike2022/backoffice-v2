/**
 * Extract text from PDF file
 * Uses pdf-parse library (Deno-compatible via npm:)
 */
export async function extractTextFromPDF(fileData: Uint8Array): Promise<string> {
  try {
    // Import pdf-parse dynamically (Deno npm: specifier)
    const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
    
    // Parse PDF
    const data = await pdfParse(fileData);
    
    // Return extracted text
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Clean and normalize extracted text
 */
export function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove page numbers and headers/footers
    .replace(/Page \d+ of \d+/gi, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove multiple consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

