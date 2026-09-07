import type { Metadata } from "next";

export { default } from "../shop/page";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};
