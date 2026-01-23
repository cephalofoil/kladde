import type { ReactNode } from "react";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

const navbar = (
  <Navbar
    logo={<span className="font-heading text-lg">Kladde Docs</span>}
    projectLink="https://github.com/cephalofoil/kladde"
  />
);

const footer = (
  <Footer className="text-sm">
    Kladde Documentation
  </Footer>
);

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Layout navbar={navbar} footer={footer} pageMap={await getPageMap()}>
      {children}
    </Layout>
  );
}
