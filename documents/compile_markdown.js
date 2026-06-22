const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function getBase64Image(filePath) {
    if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        return `data:image/png;base64,${fileBuffer.toString('base64')}`;
    }
    return '';
}

async function compile(mdPath, pdfPath, title, subtitle) {
    console.log(`Compiling ${mdPath} to ${pdfPath}...`);
    if (!fs.existsSync(mdPath)) {
        console.error(`File not found: ${mdPath}`);
        return;
    }
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const logoBase64 = getBase64Image('/workspaces/BISIG/image/logo.png');

    const titlePageHtml = `
      <div class="title-page">
        <img src="${logoBase64}" alt="BISIG Logo">
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
    `;

    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <!-- KaTeX Math Rendering -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
  <!-- Highlight.js Syntax Highlighting -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.8.0/build/styles/github.min.css">
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.8.0/build/highlight.min.js"></script>
  <!-- Mermaid.js Diagram Rendering -->
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      themeVariables: {
        primaryColor: '#f9f9f9',
        primaryTextColor: '#333333',
        primaryBorderColor: '#cccccc',
        lineColor: '#666666',
        secondaryColor: '#f5f5f5',
        tertiaryColor: '#ffffff'
      }
    });
    window.mermaid = mermaid;
  </script>
  <style>
    *:not(.katex):not(.katex *):not(pre):not(code):not(pre *) {
      font-family: Arial, sans-serif !important;
    }
    pre, code, pre * {
      font-family: 'Courier New', Courier, Monaco, Consolas, monospace !important;
    }
    body {
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      padding: 1.5cm;
      max-width: 900px;
      margin: 0 auto;
    }
    #app, #app *:not(.katex):not(.katex *):not(pre):not(code):not(pre *) {
      font-size: 11pt !important;
    }
    pre, code, pre * {
      font-size: 9.5pt !important;
    }
    .katex {
      font-size: 11pt !important;
    }
    .katex-html * {
      font-size: inherit !important;
    }
    a, a:hover, a:visited, a:active {
      color: inherit !important;
      text-decoration: none !important;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #111;
      font-weight: bold !important;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      break-after: avoid;
      border: none !important;
      border-bottom: none !important;
    }
    hr {
      display: block !important;
      visibility: hidden !important;
      border: none !important;
      height: 0 !important;
      margin: 2em 0 !important;
      page-break-after: always !important;
    }
    pre {
      background: #f4f4f9;
      border: none !important;
      border-radius: 4px;
      padding: 1em;
      overflow-x: auto;
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      word-break: break-word !important;
      break-inside: avoid;
    }
    code {
      background: #f4f4f9;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    pre code {
      background: none;
      padding: 0;
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
      break-inside: avoid;
    }
    th, td {
      border: none !important;
      padding: 0.8em;
      text-align: left;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold !important;
    }
    blockquote {
      border-left: none !important;
      background-color: #f9f9f9;
      margin: 1.5em 10px;
      padding: 0.5em 10px;
      color: #666;
    }
    .title-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      text-align: center;
      padding-top: 100px;
    }
    .title-page img {
      max-height: 180px;
      margin-bottom: 30px;
      align-self: center;
    }
    .title-page h1 {
      font-size: 2.5em !important;
      border: none !important;
      margin-bottom: 15px;
      font-weight: bold !important;
    }
    .title-page p {
      font-size: 1.2em !important;
      color: #666;
      max-width: 650px;
      line-height: 1.5;
    }
    .mermaid {
      margin: 2em 0;
      text-align: center;
      break-inside: avoid;
    }
    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
  ${titlePageHtml}
  <div id="app"></div>
  <script>
    const markdown = \`${mdContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    
    async function render() {
      const app = document.getElementById('app');
      console.log("Starting render. marked available:", !!window.marked, "hljs available:", !!window.hljs, "katex available:", !!window.renderMathInElement);
      let htmlContent = marked.parse(markdown);
      app.innerHTML = htmlContent;
      
      // Auto-render math expressions
      if (window.renderMathInElement) {
        try {
          window.renderMathInElement(app, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false}
            ],
            throwOnError: false
          });
          console.log("Math rendered successfully");
        } catch (err) {
          console.error("Math rendering error:", err);
        }
      }
      
      const preBlocks = app.querySelectorAll('pre');
      console.log("Found pre blocks count:", preBlocks.length);
      for (const pre of preBlocks) {
        const code = pre.querySelector('code.language-mermaid');
        if (code) {
          console.log("Found mermaid block");
          const div = document.createElement('div');
          div.className = 'mermaid';
          div.textContent = code.textContent;
          pre.replaceWith(div);
        } else {
          const codeEl = pre.querySelector('code');
          if (codeEl) {
            console.log("Found code block with classes:", codeEl.className);
            if (window.hljs) {
              try {
                window.hljs.highlightElement(codeEl);
                console.log("Successfully highlighted code block");
              } catch (err) {
                console.error("Highlighting error:", err);
              }
            } else {
              console.warn("hljs is NOT available on window");
            }
          }
        }
      }
      
      if (window.mermaid) {
        try {
          await window.mermaid.run();
          console.log("Mermaid ran successfully");
        } catch (e) {
          console.error("Mermaid run error:", e);
        }
      }
      window.isRenderComplete = true;
    }
    
    window.addEventListener('load', () => {
      if (window.marked) {
        render();
      } else {
        const checkInterval = setInterval(() => {
          if (window.marked) {
            clearInterval(checkInterval);
            render();
          }
        }, 100);
      }
    });
  </script>
</body>
</html>
    `;

    const tempHtmlPath = path.join(__dirname, 'temp.html');
    fs.writeFileSync(tempHtmlPath, htmlTemplate, 'utf8');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
    await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });

    await page.waitForFunction(() => window.isRenderComplete === true, { timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    await page.pdf({
        path: pdfPath,
        format: 'Letter',
        margin: {
            top: '2cm',
            bottom: '2cm',
            left: '2cm',
            right: '2cm'
        },
        printBackground: true
    });

    await browser.close();
    fs.unlinkSync(tempHtmlPath);
    console.log(`Successfully generated ${pdfPath}`);
}

(async () => {
    try {
        const docTitle = "BISIG";
        const docSub = "Bidirectional Interface for Sign Intelligence & Gestures: Bridging FSL and Spoken Language via Pose-Based Transformers";
        
        await compile(
            '/workspaces/BISIG/documents/BISIG_Technical_Documentation.md',
            '/workspaces/BISIG/documents/BISIG_Technical_Documentation.pdf',
            docTitle + " - TECHNICAL DOCUMENTATION",
            docSub
        );
        await compile(
            '/workspaces/BISIG/documents/BISIG_User_Manual.md',
            '/workspaces/BISIG/documents/BISIG_User_Manual.pdf',
            docTitle + " - USER MANUAL",
            docSub
        );
        await compile(
            '/workspaces/BISIG/documents/BISIG_Presentation.md',
            '/workspaces/BISIG/documents/BISIG_Presentation.pdf',
            docTitle + " - PRESENTATION DECK",
            docSub
        );
    } catch (err) {
        console.error("Compilation error:", err);
        process.exit(1);
    }
})();
