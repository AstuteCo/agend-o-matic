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
    const cssFile = await fetch('agendas.css').then(res => res.text());

    if (files.length > 0) {
      const firstHtmlFile = files[0];
      const htmlContent = await firstHtmlFile.async('text');
      await applyStylesAndConvertToSingleHtml(htmlContent, cssFile, zip);
    } else {
      alert('No HTML file found in the ZIP.');
    }
  } catch (error) {
    console.error("Error processing ZIP file:", error);
    alert('An error occurred while processing the ZIP file.');
  }
}

async function applyStylesAndConvertToSingleHtml(htmlContent, cssContent, zip) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const nativeStyles = doc.querySelector('style') ? doc.querySelector('style').outerHTML : '';
    const images = doc.querySelectorAll('img');
    const links = doc.querySelectorAll('a');

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
          const base64 = await convertBlobToBase64(blob);
          img.setAttribute('src', base64);
        } else {
          console.error(`Image file not found in ZIP: ${src}`);
        }
      }

      // Remove anchor tag if it wraps the image
      if (img.parentElement.tagName === 'A') {
        const parent = img.parentElement;
        parent.parentElement.insertBefore(img, parent);
        parent.parentElement.removeChild(parent);
      }
    });

    // Ensure all other anchor tags open in a new tab
    links.forEach((link) => {
      if (!link.querySelector('img')) {
        link.setAttribute('target', '_blank');
      }
    });

    await Promise.all(imagePromises);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = doc.body.innerHTML;
    const h1 = tempDiv.querySelector('h1');
    const title = h1 ? generateFileName(h1.textContent.trim()) : 'output';

    // Create the styled HTML with embedded images and inline CSS
    const styledHtml = `
      <html>
        <head>
          ${nativeStyles}
          <style>${cssContent}</style>
        </head>
        <body>
          ${tempDiv.innerHTML}
        </body>
      </html>
    `;

    console.log("Styled HTML content:", styledHtml);

    const blob = new Blob([styledHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

  } catch (error) {
    console.error("Error applying styles and converting to single HTML:", error);
    alert('An error occurred while applying styles and converting to single HTML.');
  }
}

function generateFileName(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

function convertBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
