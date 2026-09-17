import "./globals.css";

export const metadata = {
  title: "Backlog Board",
  description: "Shared backlog and coordination board",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
