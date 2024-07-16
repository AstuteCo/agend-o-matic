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
      await applyStylesAndConvertToPdf(htmlContent, zip);
    } else {
      alert('No HTML file found in the ZIP.');
    }
  } catch (error) {
    console.error("Error processing ZIP file:", error);
    alert('An error occurred while processing the ZIP file.');
  }
}

async function applyStylesAndConvertToPdf(htmlContent, zip) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const images = doc.querySelectorAll('img');

    const imagePromises = Array.from(images).map(async (img) => {
      let src = img.getAttribute('src');
      if (src) {
        src = decodeURIComponent(src);
        console.log(`Looking for image: ${src}`);

        let imageFile;
        zip.forEach((relativePath, file) => {
          if (relativePath.endsWith(src)) {
            imageFile = file;
          }
        });

        if (imageFile) {
          console.log(`Found image file in ZIP: ${src}`);
          const blob = await imageFile.async('blob');
          const url = URL.createObjectURL(blob);
          img.setAttribute('src', url);
        } else {
          console.error(`Image file not found in ZIP: ${src}`);
        }
      }
    });

    await Promise.all(imagePromises);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = doc.body.innerHTML;
    const h1 = tempDiv.querySelector('h1');
    const title = h1 ? generateFileName(h1.textContent.trim()) : 'output';

    // Create the styled HTML with embedded images
    const styledHtml = `
      <html>
        <head>
          <link rel="stylesheet" href="agendas.css">
          <style>
            body { margin: 20px; }
            img { max-width: 100%; height: auto; }
            * { color: black; } /* Ensure all text is black */
          </style>
        </head>
        <body>
          ${tempDiv.innerHTML}
        </body>
      </html>
    `;

    console.log("Styled HTML content:", styledHtml);

    await displayPdf(styledHtml, title);
  } catch (error) {
    console.error("Error applying styles and converting to PDF:", error);
    alert('An error occurred while applying styles and converting to PDF.');
  }
}

function generateFileName(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

async function displayPdf(htmlContent, title) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.onload = async () => {
    console.log("Iframe loaded");
    const iframeBody = iframe.contentWindow.document.body;
    console.log("Iframe body content:", iframeBody.innerHTML);

    await waitForImagesToLoad(iframeBody);

    setTimeout(async () => {
      const options = {
        margin: 1,
        filename: `${title}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 1 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      try {
        if (typeof window.html2pdf === 'function') {
          await window.html2pdf().from(iframeBody).set(options).save();
          document.body.removeChild(iframe);
        } else {
          throw new Error('html2pdf function not available');
        }
      } catch (error) {
        console.error("Error: html2pdf function not available", error);
        alert('An error occurred: html2pdf function not available.');
      }
    }, 5000); // Extended delay to ensure all content is rendered
  };
}

function waitForImagesToLoad(container) {
  const images = container.querySelectorAll('img');
  const imageLoadPromises = Array.from(images).map((img) => {
    return new Promise((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.onload = resolve;
        img.onerror = resolve;
      }
    });
  });
  return Promise.all(imageLoadPromises);
}
