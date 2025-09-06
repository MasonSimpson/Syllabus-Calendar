import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Syllabus → Calendar",
  description: "Created by Mason Simpson",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className = "centered">
        {children}
      </body>
    </html>
  );
}
