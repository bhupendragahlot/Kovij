import { useState } from "react";
import { motion } from "framer-motion";
import { FaExpandAlt } from "react-icons/fa";

function Gallery() {
  const [selectedImage, setSelectedImage] = useState(null);

  const images = [
    {
      src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1974&auto=format&fit=crop",
      alt: "Gym equipment zone",
      label: "Strength Floor",
    },
    {
      src: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=1974&auto=format&fit=crop",
      alt: "Weight training setup",
      label: "Iron Arena",
    },
    {
      src: "https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?q=80&w=1974&auto=format&fit=crop",
      alt: "Cardio and conditioning",
      label: "Cardio Ops",
    },
    {
      src: "https://images.unsplash.com/photo-1571019613914-85f342c1d4b7?q=80&w=1974&auto=format&fit=crop",
      alt: "Group class session",
      label: "Group Intensity",
    },
    {
      src: "https://images.unsplash.com/photo-1581122584612-713f89daa8eb?q=80&w=1974&auto=format&fit=crop",
      alt: "Personal training session",
      label: "Elite Coaching",
    },
    {
      src: "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=2070&auto=format&fit=crop",
      alt: "Mobility and stretching space",
      label: "Recovery Bay",
    },
  ];

  const openModal = (image) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  return (
    <section id="gallery" className="bg-[#0f0f0f] px-4 py-20 text-[#e5e2e1] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <h2 className="mb-4 font-['Lexend'] text-4xl font-black uppercase md:text-5xl">OUR GALLERY</h2>
          <p className="mx-auto max-w-3xl text-[#ab8985]">
            A visual walkthrough of Kovij Fitness Zone. Equipment, coaching spaces, and performance-focused environments.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, delay: index * 0.07 }}
              viewport={{ once: true }}
              className="group relative cursor-pointer overflow-hidden border border-[#393939] bg-[#1c1b1b]"
              onClick={() => openModal(image)}
            >
              <img
                src={image.src || "/placeholder.svg"}
                alt={image.alt}
                className="h-72 w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#f27a00]">Kovij Zone</span>
                  <span className="font-['Lexend'] text-lg font-bold uppercase text-white">{image.label}</span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center border border-[#d32f2f] bg-[#131313]/80 text-[#d32f2f] transition group-hover:bg-[#d32f2f] group-hover:text-white">
                  <FaExpandAlt className="text-xs" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={closeModal}>
          <div className="relative w-full max-w-5xl border border-[#393939] bg-[#131313] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center bg-[#d32f2f] text-2xl text-white"
              onClick={closeModal}
            >
              &times;
            </button>
            <img
              src={selectedImage.src || "/placeholder.svg"}
              alt={selectedImage.alt}
              className="max-h-[80vh] w-full object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default Gallery;
