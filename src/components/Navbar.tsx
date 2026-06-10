import Link from "next/link";

const NAV_ITEMS = [
  { href: "#", label: "Dashboard" },
  { href: "#", label: "Files & Records" },
  { href: "#", label: "CRA Accounting" },
  { href: "#", label: "Companies" },
] as const;

export default function Navbar() {
  return (
    <header className="border-b border-gray-800 bg-gray-950/60 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="#" className="text-lg font-semibold text-gray-100">
            Alberius Operations Hub
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.href === "#" ? "page" : undefined}
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="text-sm text-gray-400">Current Period: January 1 – Present</div>
      </div>
    </header>
  );
}
