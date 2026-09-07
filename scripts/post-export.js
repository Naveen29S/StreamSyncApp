const fs = require('fs');
const path = require('path');

const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
const verificationTag = '<meta name="google-site-verification" content="oaY7rCATj3dutsVQXqy0twqfVPPuNcZni0PUPe8v1QI" />';

if (fs.existsSync(distIndexPath)) {
  let html = fs.readFileSync(distIndexPath, 'utf8');

  if (!html.includes('google-site-verification')) {
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n    ${verificationTag}`);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `    ${verificationTag}\n  </head>`);
    } else {
      html = verificationTag + '\n' + html;
    }
    fs.writeFileSync(distIndexPath, html, 'utf8');
    console.log('Successfully injected Google site verification tag into dist/index.html');
  } else {
    console.log('Google site verification tag already present in dist/index.html');
  }
} else {
  console.warn('dist/index.html not found, skipping injection.');
}
