// Temporary file for the new PDF handler - to be integrated
export const handleDownloadPDF_NEW = async (selectedTrack: any, selectedTrackFacts: any[], processedContent: string, formatDate: (date: string) => string, toast: any) => {
  if (!selectedTrack) return;

  try {
    toast.success("Preparing PDF...");
    
    // Dynamic import of jsPDF
    const { default: jsPDF } = await import('jspdf');
    
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);
    const footerHeight = 40;
    let yPosition = margin;

    // Helper to check if we need a new page
    const checkPageBreak = (neededSpace: number) => {
      if (yPosition + neededSpace > pageHeight - footerHeight) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Add header with logo color bar
    doc.setFillColor(249, 115, 22); // Orange color
    doc.rect(0, 0, pageWidth, 12, 'F');
    
    yPosition += 30;

    // Title
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(selectedTrack.title, contentWidth);
    titleLines.forEach((line: string) => {
      doc.text(line, margin, yPosition);
      yPosition += 36;
    });
    yPosition += 5;

    // Metadata badge
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, yPosition, contentWidth, 30, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    
    const metadataText = `${selectedTrack.type ? selectedTrack.type.charAt(0).toUpperCase() + selectedTrack.type.slice(1) : 'Article'} • ${formatDate(selectedTrack.updated_at)}${selectedTrack.category?.name ? ' • ' + selectedTrack.category.name : ''}`;
    doc.text(metadataText, margin + 10, yPosition + 12);
    
    if (selectedTrack.created_by?.name) {
      doc.text(`Author: ${selectedTrack.created_by.name}`, margin + 10, yPosition + 24);
    }
    yPosition += 40;

    // Stats (without emojis)
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${selectedTrack.view_count || 0} views • ${selectedTrack.likes || 0} likes`, margin, yPosition);
    yPosition += 25;

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 25;

    // Description box
    if (selectedTrack.description) {
      checkPageBreak(60);
      
      const descLines = doc.splitTextToSize(selectedTrack.description, contentWidth - 30);
      const descHeight = descLines.length * 16 + 30;
      
      doc.setFillColor(254, 243, 199); // Light orange
      doc.setDrawColor(251, 191, 36); // Orange border
      doc.setLineWidth(2);
      doc.roundedRect(margin, yPosition, contentWidth, descHeight, 5, 5, 'FD');
      
      yPosition += 20;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 53, 15); // Dark orange text
      
      descLines.forEach((line: string) => {
        doc.text(line, margin + 15, yPosition);
        yPosition += 16;
      });
      
      yPosition += 20;
    }

    // Key Facts
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
        
        // Bullet point
        doc.setFillColor(34, 197, 94); // Green
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

    // Main Content
    if (processedContent && processedContent.trim()) {
      checkPageBreak(40);
      
      // Add content heading
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Content', margin, yPosition);
      yPosition += 25;
      
      // Parse HTML and extract text content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = processedContent;
      
      // Process each element
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
          } else if (tagName === 'strong' || tagName === 'b') {
            const text = element.textContent?.trim();
            if (text) {
              doc.setFont('helvetica', 'bold');
              doc.text(text, margin, yPosition);
            }
          } else if (tagName === 'em' || tagName === 'i') {
            const text = element.textContent?.trim();
            if (text) {
              doc.setFont('helvetica', 'italic');
              doc.text(text, margin, yPosition);
            }
          } else {
            // Process children for other elements
            element.childNodes.forEach(child => processNode(child));
          }
        }
      };
      
      tempDiv.childNodes.forEach(child => processNode(child));
    }

    // Add footer on each page
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);
      
      // Footer text
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

    // Save the PDF
    const fileName = `${selectedTrack.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
    
    toast.success("PDF downloaded successfully!");
  } catch (error) {
    console.error('PDF generation error:', error);
    toast.error("Failed to generate PDF. Please try again.");
  }
};
