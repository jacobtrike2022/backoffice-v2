/**
 * Shared Knowledge Base PDF export — same output whether invoked from
 * in-app KB, public QR viewer, or content library editors.
 */
import * as factsCrud from '../crud/facts';

export function formatKbPdfDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export type KbPdfTocSection = { id: string; title: string; level: number };

/** Markdown → HTML (matches KnowledgeBaseRevamp behavior). */
export function convertMarkdownToHtmlForKbPdf(markdown: string): string {
  let html = markdown;
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(markdown);
  if (!hasHtmlTags) {
    html = html.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; max-width: 100%; overflow-x: hidden;"><code class="language-$1" style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word;">$2</code></pre>'
    );
    html = html.replace(
      /`([^`]+)`/g,
      '<code style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word;">$1</code>'
    );
    html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n/g, '<br/>');
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }
  }
  return html;
}

/** HTML body + TOC for KB article/story/video content (matches KnowledgeBaseRevamp). */
export function getProcessedContentAndTocForKb(selectedTrack: {
  content_text?: string;
  content?: string;
  transcript?: string;
  type?: string;
} | null): { processedContent: string; tocSections: KbPdfTocSection[] } {
  if (!selectedTrack) return { processedContent: '', tocSections: [] };

  const rawContent =
    selectedTrack.content_text ||
    selectedTrack.content ||
    (selectedTrack.type !== 'story' ? selectedTrack.transcript : null);

  if (!rawContent) return { processedContent: '', tocSections: [] };

  try {
    const htmlContent = convertMarkdownToHtmlForKbPdf(rawContent);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const headers = doc.querySelectorAll('h1, h2, h3');
    const sections: KbPdfTocSection[] = [];

    headers.forEach((header, index) => {
      const text = header.textContent || '';
      const id =
        text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `section-${index}`;

      header.id = id;
      sections.push({
        id,
        title: text,
        level: header.tagName === 'H1' ? 0 : header.tagName === 'H2' ? 1 : 2,
      });
    });

    return {
      processedContent: doc.body.innerHTML,
      tocSections: sections,
    };
  } catch (e) {
    console.error('Error parsing content for TOC', e);
    return { processedContent: rawContent, tocSections: [] };
  }
}

function getStoryImageSlidesForPdf(transcript: unknown): Array<{ url: string; name?: string; order: number }> {
  if (!transcript) return [];
  try {
    const data = typeof transcript === 'string' ? JSON.parse(transcript) : transcript;
    const slides = Array.isArray((data as { slides?: unknown })?.slides)
      ? (data as { slides: any[] }).slides
      : [];
    return slides
      .filter((s: { type?: string; url?: string }) => s?.type === 'image' && typeof s?.url === 'string' && s.url.trim())
      .map((s: { url: string; name?: string; order?: number }, i: number) => ({
        url: s.url.trim(),
        name: typeof s.name === 'string' ? s.name : undefined,
        order: typeof s.order === 'number' ? s.order : i,
      }))
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

async function fetchImageAsDataUrlForPdf(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    if (dataUrl.startsWith('data:image/png')) return { dataUrl, format: 'PNG' };
    if (dataUrl.startsWith('data:image/webp') || dataUrl.startsWith('data:image/gif')) {
      return await rasterDataUrlToJpegForPdf(dataUrl);
    }
    return { dataUrl, format: 'JPEG' };
  } catch {
    return null;
  }
}

function loadImageDimensionsFromDataUrl(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

async function rasterDataUrlToJpegForPdf(dataUrl: string): Promise<{ dataUrl: string; format: 'JPEG' } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), format: 'JPEG' };
  } catch {
    return null;
  }
}

export type KbPdfToast = {
  success: (msg: string) => void;
  error: (msg: string) => void;
};

/**
 * Generates and downloads the same PDF as the in-app Knowledge Base.
 */
export async function downloadKbTrackAsPdf(
  selectedTrack: any,
  options?: { toast?: KbPdfToast; factsOverride?: Array<{ title?: string; content?: string; fact?: string }> }
): Promise<void> {
  const toast = options?.toast;
  if (!selectedTrack) return;

  try {
    toast?.success('Preparing PDF...');

    const { default: jsPDF } = await import('jspdf');

    let selectedTrackFacts: any[] = [];
    if (options?.factsOverride && options.factsOverride.length > 0) {
      selectedTrackFacts = options.factsOverride.map((f) => {
        const text = f.content ?? f.fact ?? '';
        return {
          title: f.title,
          fact: text,
          content: text,
        };
      });
    } else {
      try {
        const dbFacts = await factsCrud.getFactsForTrack(selectedTrack.id);
        selectedTrackFacts = dbFacts.map((f: any) => ({
          title: f.title,
          fact: f.content,
          content: f.content,
          type: f.type,
          steps: f.steps || [],
          contexts: [f.context?.specificity || 'universal'],
        }));
      } catch {
        selectedTrackFacts = [];
      }
    }

    const { processedContent } = getProcessedContentAndTocForKb(selectedTrack);

    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;
    const footerHeight = 40;
    let yPosition = margin;

    const checkPageBreak = (neededSpace: number) => {
      if (yPosition + neededSpace > pageHeight - footerHeight) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, pageWidth, 12, 'F');

    yPosition += 30;

    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(selectedTrack.title, contentWidth);
    titleLines.forEach((line: string) => {
      doc.text(line, margin, yPosition);
      yPosition += 36;
    });
    yPosition += 5;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, yPosition, contentWidth, 30, 3, 3, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    const metadataText = `${selectedTrack.type ? selectedTrack.type.charAt(0).toUpperCase() + selectedTrack.type.slice(1) : 'Article'} • ${formatKbPdfDate(selectedTrack.updated_at)}${selectedTrack.category?.name ? ' • ' + selectedTrack.category.name : ''}`;
    doc.text(metadataText, margin + 10, yPosition + 12);

    if (selectedTrack.created_by?.name) {
      doc.text(`Author: ${selectedTrack.created_by.name}`, margin + 10, yPosition + 24);
    }
    yPosition += 40;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${selectedTrack.view_count || 0} views • ${selectedTrack.likes || 0} likes`, margin, yPosition);
    yPosition += 25;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 25;

    if (selectedTrack.description) {
      checkPageBreak(60);

      const descLines = doc.splitTextToSize(selectedTrack.description, contentWidth - 30);
      const descHeight = descLines.length * 16 + 30;

      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(251, 191, 36);
      doc.setLineWidth(2);
      doc.roundedRect(margin, yPosition, contentWidth, descHeight, 5, 5, 'FD');

      yPosition += 20;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 53, 15);

      descLines.forEach((line: string) => {
        doc.text(line, margin + 15, yPosition);
        yPosition += 16;
      });

      yPosition += 20;
    }

    if (selectedTrackFacts && selectedTrackFacts.length > 0) {
      checkPageBreak(40);
      yPosition += 10;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Key Facts', margin, yPosition);
      yPosition += 25;

      selectedTrackFacts.forEach((factObj: any) => {
        const obj = factObj.content || factObj.fact || factObj;
        checkPageBreak(30);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);

        doc.setFillColor(34, 197, 94);
        doc.circle(margin + 5, yPosition - 3, 3, 'F');

        const objLines = doc.splitTextToSize(obj, contentWidth - 25);
        objLines.forEach((line: string, lineIndex: number) => {
          doc.text(line, margin + 18, yPosition);
          if (lineIndex < objLines.length - 1) yPosition += 14;
        });

        yPosition += 20;
      });

      yPosition += 10;
    }

    if (selectedTrack.type === 'story' && selectedTrack.transcript) {
      const imageSlides = getStoryImageSlidesForPdf(selectedTrack.transcript);
      if (imageSlides.length > 0) {
        checkPageBreak(50);
        yPosition += 5;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Story slides', margin, yPosition);
        yPosition += 26;

        for (const slide of imageSlides) {
          try {
            const loaded = await fetchImageAsDataUrlForPdf(slide.url);
            if (!loaded) continue;

            const { w: iw, h: ih } = await loadImageDimensionsFromDataUrl(loaded.dataUrl);
            if (!iw || !ih) continue;

            const captionH = slide.name ? 20 : 0;
            const minSpace = captionH + 40;
            checkPageBreak(minSpace);

            let drawW = contentWidth;
            let drawH = (ih / iw) * drawW;
            const maxH = pageHeight - footerHeight - yPosition - captionH - margin;

            if (drawH > maxH && maxH > 40) {
              const scale = maxH / drawH;
              drawH *= scale;
              drawW *= scale;
            }

            if (yPosition + captionH + drawH > pageHeight - footerHeight) {
              doc.addPage();
              yPosition = margin;
            }

            if (slide.name) {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(71, 85, 105);
              doc.text(String(slide.name), margin, yPosition);
              yPosition += captionH;
            }

            doc.addImage(loaded.dataUrl, loaded.format, margin, yPosition, drawW, drawH);
            yPosition += drawH + 18;
          } catch {
            // skip slide
          }
        }

        yPosition += 8;
      }
    }

    if (processedContent && processedContent.trim()) {
      checkPageBreak(40);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Content', margin, yPosition);
      yPosition += 25;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = processedContent;

      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            const lines = doc.splitTextToSize(text, contentWidth);
            lines.forEach((line: string) => {
              checkPageBreak(16);
              doc.text(line, margin, yPosition);
              yPosition += 16;
            });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName.toLowerCase();

          if (tagName === 'h1') {
            checkPageBreak(40);
            yPosition += 15;
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            const text = element.textContent?.trim() || '';
            const lines = doc.splitTextToSize(text, contentWidth);
            lines.forEach((line: string) => {
              doc.text(line, margin, yPosition);
              yPosition += 24;
            });
            yPosition += 8;
          } else if (tagName === 'h2') {
            checkPageBreak(35);
            yPosition += 12;
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            const text = element.textContent?.trim() || '';
            const lines = doc.splitTextToSize(text, contentWidth);
            lines.forEach((line: string) => {
              doc.text(line, margin, yPosition);
              yPosition += 22;
            });
            yPosition += 6;
          } else if (tagName === 'h3') {
            checkPageBreak(30);
            yPosition += 10;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            const text = element.textContent?.trim() || '';
            const lines = doc.splitTextToSize(text, contentWidth);
            lines.forEach((line: string) => {
              doc.text(line, margin, yPosition);
              yPosition += 20;
            });
            yPosition += 5;
          } else if (tagName === 'p') {
            checkPageBreak(20);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            const text = element.textContent?.trim() || '';
            if (text) {
              const lines = doc.splitTextToSize(text, contentWidth);
              lines.forEach((line: string) => {
                checkPageBreak(16);
                doc.text(line, margin, yPosition);
                yPosition += 16;
              });
              yPosition += 8;
            }
          } else if (tagName === 'ul' || tagName === 'ol') {
            yPosition += 5;
            const items = element.querySelectorAll('li');
            items.forEach((li, index) => {
              checkPageBreak(20);
              doc.setFontSize(11);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(51, 65, 85);

              const bullet = tagName === 'ul' ? '•' : `${index + 1}.`;
              doc.text(bullet, margin + 5, yPosition);

              const text = li.textContent?.trim() || '';
              const lines = doc.splitTextToSize(text, contentWidth - 25);
              lines.forEach((line: string, lineIndex: number) => {
                doc.text(line, margin + 20, yPosition);
                if (lineIndex < lines.length - 1) {
                  yPosition += 14;
                  checkPageBreak(14);
                }
              });
              yPosition += 18;
            });
            yPosition += 5;
          } else {
            element.childNodes.forEach((child) => processNode(child));
          }
        }
      };

      tempDiv.childNodes.forEach((child) => processNode(child));
    }

    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');

      const pageText = `Page ${i} of ${totalPages}`;
      doc.text(pageText, pageWidth / 2, pageHeight - 20, { align: 'center' });

      doc.text(
        `Downloaded: ${new Date().toLocaleDateString()}`,
        pageWidth - margin,
        pageHeight - 20,
        { align: 'right' }
      );
    }

    const fileName = `${String(selectedTrack.title).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);

    toast?.success('PDF downloaded successfully!');
  } catch (error) {
    console.error('PDF generation error:', error);
    toast?.error('Failed to generate PDF. Please try again.');
  }
}
