import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { animate, stagger } from "motion"
import { FaStar } from "react-icons/fa"
import { useTheme } from "../context/ThemeContext"

function Shop() {
  const [activeCategory, setActiveCategory] = useState("all")
  const { theme } = useTheme()
  const heroCopyRef = useRef(null)

  const categories = [
    { id: "all", name: "All Products" },
    { id: "protein", name: "Protein" },
    { id: "preworkout", name: "Pre-Workout" },
    { id: "vitamins", name: "Vitamins & Minerals" },
    { id: "accessories", name: "Accessories" },
  ]

  const products = [
    {
      id: 1,
      name: "Whey Protein Isolate",
      category: "protein",
      price: 2499,
      discountPrice: 1999,
      rating: 4.8,
      image: "https://imgs.search.brave.com/Ckjd05tsIs4QgvuMMRJkITTvdIiIqduxzY_6IRGEcQw/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9zaG9w/LmJvZHlidWlsZGlu/Zy5jb20vY2RuL3No/b3AvZmlsZXMva2Fn/ZWQtd2hleS1wcm90/ZWluLWlzb2xhdGUt/NDkxNDM2LmpwZz9j/cm9wPWNlbnRlciZo/ZWlnaHQ9MjA0OCZ2/PTE3MzAzNjcwMzIm/d2lkdGg9MjA0OA",
      badge: "Best Seller",
    },
    {
      id: 2,
      name: "Pre-Workout Energy Booster",
      category: "preworkout",
      price: 1899,
      discountPrice: 1499,
      rating: 4.5,
      image: "https://imgs.search.brave.com/6VVg1MNWl-0ErZ5rh3sc3xEAN12mQgU-gNgiHtwod9E/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9tLm1l/ZGlhLWFtYXpvbi5j/b20vaW1hZ2VzL0kv/ODF1cGlrSkppQ0wu/anBn",
      badge: "20% OFF",
    },
    {
      id: 3,
      name: "BCAA Amino Acids",
      category: "protein",
      price: 1299,
      discountPrice: 999,
      rating: 4.3,
      image: "/images/product-3.jpg",
      badge: "New",
    },
    {
      id: 4,
      name: "Multivitamin Complex",
      category: "vitamins",
      price: 899,
      discountPrice: 799,
      rating: 4.6,
      image: "/images/product-4.jpg",
    },
    {
      id: 5,
      name: "Creatine Monohydrate",
      category: "protein",
      price: 1199,
      discountPrice: 999,
      rating: 4.7,
      image: "/images/product-5.jpg",
      badge: "Popular",
    },
    {
      id: 6,
      name: "Gym Shaker Bottle",
      category: "accessories",
      price: 499,
      discountPrice: 399,
      rating: 4.4,
      image: "/images/product-6.jpg",
    },
    {
      id: 7,
      name: "Weight Lifting Gloves",
      category: "accessories",
      price: 799,
      discountPrice: 649,
      rating: 4.2,
      image: "https://imgs.search.brave.com/qZp0nYP-m3W-OGkn7ifJWUoLseBCTQhQoReuLJ54FDA/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly93d3cu/Z29yaWxsYXdlYXIu/Y29tL3Jlc2l6ZS85/OTgwMzkwOC13b21l/bnMtZml0bmVzcy1n/bG92ZXMtMjAtYmxh/Y2stZ3JheS0xXzM4/MjAwMTUwNTg5NDgu/anBnLzUwMC81MDAv/VHJ1ZS93b21lbi1z/LWZpdG5lc3MtZ2xv/dmVzLTIwLWJsYWNr/LWdyYXkuanBn",
    },
    {
      id: 8,
      name: "Vitamin D3 + K2",
      category: "vitamins",
      price: 699,
      discountPrice: 599,
      rating: 4.5,
      image: "https://imgs.search.brave.com/aEXrGmsMyDpJIZaGWAz2inMtkgz9e4cipQlSESQpvxg/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9tLm1l/ZGlhLWFtYXpvbi5j/b20vaW1hZ2VzL0kv/NDFIcUlLRjlHVEwu/anBn",
    },
  ]

  const filteredProducts =
    activeCategory === "all" ? products : products.filter((product) => product.category === activeCategory)

  const categoryPills = useMemo(
    () => [
      { id: "all", label: "ALL" },
      { id: "protein", label: "PROTEIN" },
      { id: "preworkout", label: "PRE-WORKOUT" },
      { id: "vitamins", label: "PERFORMANCE" },
      { id: "accessories", label: "GEAR" },
    ],
    []
  )

  useEffect(() => {
    const el = heroCopyRef.current
    if (!el) return

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) return

    const targets = el.querySelectorAll("[data-shop-reveal]")
    if (!targets.length) return

    const controls = animate(
      targets,
      { opacity: [0, 1], y: [10, 0], filter: ["blur(8px)", "blur(0px)"] },
      { duration: 0.5, delay: stagger(0.06), easing: "ease-out" }
    )

    return () => controls?.cancel?.()
  }, [])

  return (
    <main className={`${theme === "dark" ? "bg-[#131313] text-[#e5e2e1]" : "bg-gradient-to-b from-gray-100 to-white text-gray-900"} min-h-screen pt-14 sm:pt-16`}>
      {/* Hero */}
      <section className="relative h-[320px] overflow-hidden flex items-center sm:h-[400px]">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1974&auto=format&fit=crop"
            alt="Shop hero"
            className="fx-kenburns fx-gpu w-full h-full object-cover opacity-50 grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#131313] via-[#131313]/80 to-transparent" />
          <div className="grid-noise fx-noise-drift absolute inset-0 opacity-35" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
          <div ref={heroCopyRef} className="max-w-2xl border-l-4 border-[#d32f2f] pl-6">
            <h1 data-shop-reveal className="font-['Lexend'] text-3xl font-black uppercase text-white mb-3 sm:text-5xl sm:mb-4 md:text-6xl">
              EQUIP YOUR MISSION
            </h1>
            <p data-shop-reveal className="kv-body text-neutral-400 max-w-lg">
              Precision-engineered fuel for peak human performance. Every formula, every fiber, designed for the relentless.
            </p>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="sticky top-14 z-40 border-b border-neutral-800 bg-[#1c1b1b] sm:top-16">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 overflow-x-auto">
            {categoryPills.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActiveCategory(pill.id)}
                className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-colors ${
                  activeCategory === pill.id
                    ? "corner-cut-tr bg-[#d32f2f] text-white"
                    : "bg-[#2a2a2a] text-neutral-400 hover:text-white"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-neutral-500 text-[10px] font-bold uppercase tracking-widest">
            Sort: Popularity
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product, index) => (
            <motion.article
              key={product.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.35, delay: index * 0.03 }}
              className="fx-hoverlift fx-gpu bg-[#0e0e0e] border border-neutral-800 group hover:border-[#d32f2f]"
            >
              <div className="aspect-square relative bg-neutral-900 overflow-hidden">
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                />
                {product.badge && (
                  <div className="absolute top-3 left-3 bg-[#d32f2f] px-2 py-1 text-[10px] font-black uppercase tracking-tight text-white">
                    {product.badge}
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-2 gap-3">
                  <h3 className="font-['Lexend'] text-lg font-black uppercase tracking-tight">{product.name}</h3>
                  <span className="text-[#ffb3ac] font-black">₹{product.discountPrice}</span>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  <div className="flex text-[#f7be1d]">
                    {[...Array(5)].map((_, i) => (
                      <FaStar key={i} className={i < Math.floor(product.rating) ? "text-[#f7be1d]" : "text-neutral-700"} />
                    ))}
                  </div>
                  <span className="text-[10px] text-neutral-500 ml-1">({product.rating})</span>
                </div>

                <button className="fx-hoverlift fx-press w-full py-3 bg-neutral-800 hover:bg-[#d32f2f] text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                  View Details <span className="translate-y-[1px]">→</span>
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="fx-scan-sweep relative overflow-hidden bg-neutral-950 border-t-4 border-[#d32f2f] p-10 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute inset-0 opacity-10">
            <div className="grid-noise fx-noise-drift w-full h-full" />
          </div>
          {/* <div className="relative z-10 text-center md:text-left">
            <h2 className="font-['Lexend'] text-3xl md:text-4xl font-black uppercase mb-2 text-white">UNLEASH THE ALPHA</h2>
            <p className="text-neutral-400 text-xs uppercase tracking-widest max-w-md">
              Join our elite performance program for exclusive access to advanced nutrition protocols.
            </p>
          </div> */}
          <div className="relative z-10 flex gap-4">
            <button className="corner-cut-tr fx-hoverlift fx-press px-8 py-3 bg-[#d32f2f] text-white text-xs font-black uppercase tracking-widest">
              SUBSCRIBE NOW
            </button>
            <button className="corner-cut-bl fx-hoverlift fx-press px-8 py-3 border-2 border-[#f27a00] text-[#f27a00] text-xs font-black uppercase tracking-widest hover:bg-[#f27a00]/10 transition-colors">
              LEARN MORE
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Shop

