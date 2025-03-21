import { motion } from 'framer-motion'; // Import motion from framer-motion
import Hero from "../components/Hero"
import Services from "../components/Services"
import Gallery from "../components/Gallery"
import Trainers from "../components/Trainers"
import Timing from "../components/Timing"
import Pricing from "../components/Pricing"
import Contact from "../components/Contact"

function Home() {
  return (
    <main>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <Hero />
        <Services />
        <Gallery />
        <Trainers />
        <Timing />
        <Pricing />
        <Contact />
      </motion.div>
    </main>
  )
}

export default Home
