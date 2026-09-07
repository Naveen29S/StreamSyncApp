// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
export default function Root({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="google-site-verification" content="oaY7rCATj3dutsVQXqy0twqfVPPuNcZni0PUPe8v1QI" />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
html, body {
  height: 100%;
}
body {
  overflow: hidden;
  background-color: #fff;
}
#root {
  display: flex;
  height: 100%;
  flex: 1;
}
`;

