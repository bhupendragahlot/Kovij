import { useEffect, useState } from "react";
import { FaEnvelope, FaFacebook, FaInstagram, FaMapMarkerAlt, FaPhone, FaWhatsapp } from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";

function Footer() {
  const currentYear = new Date().getFullYear();
  const { theme } = useTheme();
  const [settings, setSettings] = useState(null);

  // Fetch settings from backend
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => setSettings(null));
  }, []);

  return (
    <footer className={theme === "dark" ? "bg-neutral-950 text-[#e5e2e1] border-t-4 border-red-600" : "bg-gray-100 text-gray-900"}>
      <div className="fx-scan-sweep relative mx-auto w-full max-w-7xl px-8 py-12">
        {theme === "dark" && <div className="pointer-events-none absolute inset-0 grid-noise fx-noise-drift opacity-[0.06]" />}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span
              className={`font-['Lexend'] text-xl font-black uppercase tracking-widest ${
                theme === "dark" ? "text-neutral-100" : "text-gray-900"
              }`}
            >
              KOVIJ FITNESS ZONE
            </span>
            <p className={`mt-4 max-w-xl text-sm ${theme === "dark" ? "text-neutral-500" : "text-gray-600"}`}>
              {settings?.heroDescription ||
                "Transforming lives through fitness. A performance-first facility built for disciplined athletes."}
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href={settings?.facebook || "https://facebook.com"}
                target="_blank"
                rel="noopener noreferrer"
                className={`fx-hoverlift fx-press flex h-10 w-10 items-center justify-center border transition-all hover:border-red-600 hover:text-red-600 ${
                  theme === "dark" ? "border-neutral-800 text-neutral-500" : "border-gray-300 text-gray-600"
                }`}
                aria-label="Facebook"
              >
                <FaFacebook className="text-sm" />
              </a>
              <a
                href={settings?.instagram || "https://instagram.com"}
                target="_blank"
                rel="noopener noreferrer"
                className={`fx-hoverlift fx-press flex h-10 w-10 items-center justify-center border transition-all hover:border-red-600 hover:text-red-600 ${
                  theme === "dark" ? "border-neutral-800 text-neutral-500" : "border-gray-300 text-gray-600"
                }`}
                aria-label="Instagram"
              >
                <FaInstagram className="text-sm" />
              </a>
              <a
                href={settings?.whatsapp ? `https://wa.me/${settings.whatsapp}` : "https://wa.me/+919057027053"}
                target="_blank"
                rel="noopener noreferrer"
                className={`fx-hoverlift fx-press flex h-10 w-10 items-center justify-center border transition-all hover:border-red-600 hover:text-red-600 ${
                  theme === "dark" ? "border-neutral-800 text-neutral-500" : "border-gray-300 text-gray-600"
                }`}
                aria-label="WhatsApp"
              >
                <FaWhatsapp className="text-sm" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h3
              className={`font-['Lexend'] text-sm font-black uppercase tracking-widest ${
                theme === "dark" ? "text-neutral-200" : "text-gray-900"
              }`}
            >
              Quick Links
            </h3>
            <div
              className={`mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs font-light uppercase tracking-widest ${
                theme === "dark" ? "text-neutral-500" : "text-gray-600"
              }`}
            >
              <a className={`fx-underline transition-colors ${theme === "dark" ? "hover:text-neutral-100" : "hover:text-gray-900"}`} href="#home">
                Home
              </a>
              <a className={`fx-underline transition-colors ${theme === "dark" ? "hover:text-neutral-100" : "hover:text-gray-900"}`} href="#services">
                Services
              </a>
              <a className={`fx-underline transition-colors ${theme === "dark" ? "hover:text-neutral-100" : "hover:text-gray-900"}`} href="#gallery">
                Gallery
              </a>
              <a className={`fx-underline transition-colors ${theme === "dark" ? "hover:text-neutral-100" : "hover:text-gray-900"}`} href="#trainers">
                Trainers
              </a>
              <a className={`fx-underline transition-colors ${theme === "dark" ? "hover:text-neutral-100" : "hover:text-gray-900"}`} href="#pricing">
                Pricing
              </a>
              <a className={`fx-underline transition-colors ${theme === "dark" ? "hover:text-neutral-100" : "hover:text-gray-900"}`} href="#contact">
                Contact
              </a>
              <a
                className={`fx-underline transition-colors ${theme === "dark" ? "hover:text-neutral-100" : "hover:text-gray-900"}`}
                href="/shop"
                target="_blank"
                rel="noopener noreferrer"
              >
                Shop
              </a>
              <span />
            </div>
          </div>

          <div className="lg:col-span-4">
            <h3
              className={`font-['Lexend'] text-sm font-black uppercase tracking-widest ${
                theme === "dark" ? "text-neutral-200" : "text-gray-900"
              }`}
            >
              Base
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <a
                href={settings?.mapEmbedUrl || "https://maps.app.goo.gl/v99oCZ1vtRpuXTB66"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-start gap-3 border p-3 transition-all hover:border-red-600/60 ${
                  theme === "dark"
                    ? "border-neutral-900 bg-neutral-950/60 text-neutral-400"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <FaMapMarkerAlt className="mt-0.5 text-red-600" />
                <span className="text-xs uppercase tracking-widest">{settings?.address || "Kota, Rajasthan"}</span>
              </a>
              <a
                href={`tel:${settings?.phone || "+919057027053"}`}
                className={`flex items-center gap-3 border p-3 transition-all hover:border-red-600/60 ${
                  theme === "dark"
                    ? "border-neutral-900 bg-neutral-950/60 text-neutral-400"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <FaPhone className="text-red-600" />
                <span className="text-xs uppercase tracking-widest">{settings?.phone || "+919057027053"}</span>
              </a>
              <a
                href={`mailto:${settings?.email || "info@kovijfitness.com"}`}
                className={`flex items-center gap-3 border p-3 transition-all hover:border-red-600/60 ${
                  theme === "dark"
                    ? "border-neutral-900 bg-neutral-950/60 text-neutral-400"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <FaEnvelope className="text-red-600" />
                <span className="text-xs uppercase tracking-widest">{settings?.email || "info@kovijfitness.com"}</span>
              </a>
            </div>
          </div>
        </div>

        <div className={`mt-12 border-t pt-8 text-center ${theme === "dark" ? "border-neutral-900" : "border-gray-300"}`}>
          <p className={`font-['Lexend'] text-xs font-light uppercase tracking-widest ${theme === "dark" ? "text-neutral-500" : "text-gray-600"}`}>
            © {currentYear} KOVIJ FITNESS ZONE. ENGINEERED FOR PERFORMANCE. Developed by{" "}
            <a
              href="mailto:bhupendragahlot11@gmail.com"
              className={`transition-colors ${theme === "dark" ? "hover:text-neutral-100" : "hover:text-gray-900"}`}
            >
              BhupendraGahlot
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
