import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

function Gallery() {
  const [selectedImage, setSelectedImage] = useState(null);
  const { theme } = useTheme();
  
  const images = [
    { src: "https://imgs.search.brave.com/yGNRxDhx_MMD11JPJ3yZitl4VJgvQaUvpqyoT0ai00Q/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvNTE1/MjM4Mjc0L3Bob3Rv/L21vZGVybi1hbmQt/YmlnLWd5bS5qcGc_/cz02MTJ4NjEyJnc9/MCZrPTIwJmM9RTBz/VExNQkY1elVYNTIw/NFNVd3dDTmYydmNS/b0FZcDVDUzYwYzJM/dlNLaz0", alt: "Gym equipment" },
    { src: "https://imgs.search.brave.com/nwzxLv61W94-EUkIL8JEIzPog8qVp5xTyTaqwSXWvIY/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly93d3cu/cHVyZWd5bS5jb20v/bWVkaWEvbzM0bW9v/c3EvaHlyb3gtc2xl/ZC1wdWxsLWd1aWRl/X2Jsb2doZWFkZXIt/bm8tdGl0bGUuanBn/P3F1YWxpdHk9ODA", alt: "Weight training area" },
    { src: "/images/gallery-3.jpg", alt: "Cardio zone" },
    { src: "/images/gallery-4.jpg", alt: "Group class" },
    { src: "/images/gallery-5.jpg", alt: "Personal training" },
    { src: "/images/gallery-6.jpg", alt: "Stretching area" }
  ];
  
  const openModal = (image) => {
    setSelectedImage(image);
  };
  
  const closeModal = () => {
    setSelectedImage(null);
  };

  return (
    <section id="gallery" className={`py-20 px-4 sm:px-6 lg:px-8 ${theme === 'dark' ? 'bg-gradient-to-b from-gray-900 to-black' : 'bg-gradient-to-b from-gray-100 to-white'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
              OUR GALLERY
            </span>
          </h2>
          <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} max-w-3xl mx-auto`}>
            Take a virtual tour of our state-of-the-art facilities and equipment.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="overflow-hidden rounded-lg cursor-pointer relative group"
              onClick={() => openModal(image)}
            >
              <img 
                src={image.src || "/placeholder.svg"} 
                alt={image.alt} 
                className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <span className="text-white text-lg font-bold">View Larger</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90" onClick={closeModal}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button 
              className="absolute top-4 right-4 text-white text-2xl z-10 bg-red-500 w-10 h-10 rounded-full flex items-center justify-center"
              onClick={closeModal}
            >
              &times;
            </button>
            <img 
              src={selectedImage.src || "/placeholder.svg"} 
              alt={selectedImage.alt} 
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default Gallery;
