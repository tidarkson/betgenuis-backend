import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Football Intelligence Backend",
  description: "API and backend services for Football Intelligence",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}