/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind 4 moved the PostCSS plugin to its own package and now handles
    // vendor prefixing itself, so autoprefixer is no longer needed.
    '@tailwindcss/postcss': {},
  },
};

export default config;
