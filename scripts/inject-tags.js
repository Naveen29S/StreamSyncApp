const fs = require('fs');
const path = require('path');

const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');

const tagsToInject = `
    <!-- Google Fonts: Bebas Neue & Quicksand -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-PVSVYJXVKB"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-PVSVYJXVKB');
    </script>
    <meta name="google-site-verification" content="oaY7rCATj3dutsVQXqy0twqfVPPuNcZni0PUPe8v1QI" />
`;

const footerToInject = `
    <!-- Crawlable Homepage Footer Links for Verification & Compliance -->
    <noscript>
      <footer style="padding: 24px; text-align: center; background: #9d50ff; color: #ffffff; font-family: sans-serif;">
        <p style="margin: 0 0 12px 0; font-weight: bold;">StreamSync</p>
        <p style="margin: 0 0 12px 0;">
          <a href="/privacy.html" style="color: #ffffff; margin: 0 12px; text-decoration: underline;">Privacy Policy</a>
          <a href="/terms.html" style="color: #ffffff; margin: 0 12px; text-decoration: underline;">Terms of Service</a>
          <a href="mailto:naveensujith31@gmail.com" style="color: #ffffff; margin: 0 12px; text-decoration: underline;">Contact Support</a>
        </p>
        <p style="margin: 0; font-size: 12px; opacity: 0.85;">© 2026 StreamSync. All rights reserved.</p>
      </footer>
    </noscript>
    <footer id="crawlers-fallback-footer" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;">
      <a href="/privacy.html">Privacy Policy</a>
      <a href="/terms.html">Terms of Service</a>
      <a href="mailto:naveensujith31@gmail.com">Contact Support</a>
    </footer>
`;

if (fs.existsSync(distIndexPath)) {
  let html = fs.readFileSync(distIndexPath, 'utf8');

  if (!html.includes('Bebas+Neue')) {
    const fontLink = `
    <!-- Google Fonts: Bebas Neue & Quicksand -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
`;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${fontLink}`);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `${fontLink}\n  </head>`);
    } else {
      html = fontLink + '\n' + html;
    }
  }

  if (!html.includes('G-PVSVYJXVKB')) {
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${tagsToInject}`);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `${tagsToInject}\n  </head>`);
    } else {
      html = tagsToInject + '\n' + html;
    }
  }

  if (!html.includes('crawlers-fallback-footer')) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${footerToInject}\n</body>`);
    } else {
      html = html + '\n' + footerToInject;
    }
  }

  fs.writeFileSync(distIndexPath, html, 'utf8');
  console.log('Successfully injected Google Analytics, verification tags & crawler fallback links into dist/index.html');
} else {
  console.warn('dist/index.html not found, skipping injection.');
}

