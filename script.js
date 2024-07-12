document.getElementById('fileInput').addEventListener('change', handleFile, false);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) {
    alert('No file selected.');
    return;
  }

  const fileType = file.type;
  if (fileType === 'application/zip') {
    processZip(file);
  } else {
    alert('Please upload a valid ZIP file.');
  }
}

async function processZip(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const files = zip.file(/\.html$/);

    if (files.length > 0) {
      const firstHtmlFile = files[0];
      const htmlContent = await firstHtmlFile.async('text');
      applyStylesAndConvertToPdf(htmlContent);
    } else {
      alert('No HTML file found in the ZIP.');
    }
  } catch (error) {
    console.error("Error processing ZIP file:", error);
    alert('An error occurred while processing the ZIP file.');
  }
}

function applyStylesAndConvertToPdf(htmlContent) {
  try {
    // Strip out all <img> tags
    const cleanedHtmlContent = htmlContent.replace(/<img[^>]*>/g, '');

    // Create a temporary element to extract the title
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanedHtmlContent;
    const h1 = tempDiv.querySelector('h1');
    const title = h1 ? h1.textContent.trim() : 'output';

    displayPdf(cleanedHtmlContent, title);
  } catch (error) {
    console.error("Error applying styles and converting to PDF:", error);
    alert('An error occurred while applying styles and converting to PDF.');
  }
}

function displayPdf(htmlContent, title) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write('<html><head><link rel="stylesheet" href="agendas.css"></head><body>' + htmlContent + '</body></html>');
  doc.close();

  const options = {
    margin: 1,
    filename: `${title}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  iframe.onload = () => {
    try {
      if (typeof window.html2pdf === 'function') {
        window.html2pdf().from(iframe.contentWindow.document.body).set(options).save().then(() => {
          document.body.removeChild(iframe);
        }).catch((error) => {
          console.error("Error generating PDF:", error);
          alert('An error occurred while generating the PDF.');
        });
      } else {
        throw new Error('html2pdf function not available');
      }
    } catch (error) {
      console.error("Error: html2pdf function not available", error);
      alert('An error occurred: html2pdf function not available.');
    }
  };
}
