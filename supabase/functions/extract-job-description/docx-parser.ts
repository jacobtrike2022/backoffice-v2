/**
 * Extract text from DOCX file
 * Uses mammoth library for DOCX parsing
 */
export async function extractTextFromDOCX(fileData: Uint8Array): Promise<string> {
  try {
    // Import mammoth dynamically
    const mammoth = await import("npm:mammoth@1.8.0");
    
    // Convert DOCX to plain text
    const result = await mammoth.extractRawText({ 
      buffer: fileData 
    });
    
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
}

