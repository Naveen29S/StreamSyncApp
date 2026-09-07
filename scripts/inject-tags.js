const fs = require('fs');
const path = require('path');

const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');

const tagsToInject = `
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

if (fs.existsSync(distIndexPath)) {
  let html = fs.readFileSync(distIndexPath, 'utf8');

  if (!html.includes('G-PVSVYJXVKB')) {
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${tagsToInject}`);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `${tagsToInject}\n  </head>`);
    } else {
      html = tagsToInject + '\n' + html;
    }
    fs.writeFileSync(distIndexPath, html, 'utf8');
    console.log('Successfully injected Google Analytics (gtag.js) & verification tags into dist/index.html');
  } else {
    console.log('Google Analytics tag already present in dist/index.html');
  }
} else {
  console.warn('dist/index.html not found, skipping injection.');
}
