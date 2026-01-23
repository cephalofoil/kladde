import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: <span className="font-heading text-lg">Kladde Docs</span>,
  project: {
    link: "https://github.com/cephalofoil/kladde",
  },
  docsRepositoryBase: "https://github.com/cephalofoil/kladde/tree/master/docs",
  footer: {
    text: "Kladde Documentation",
  },
  editLink: {
    text: "Edit this page on GitHub",
  },
};

export default config;
