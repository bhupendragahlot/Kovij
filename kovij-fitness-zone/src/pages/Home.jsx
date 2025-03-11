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
      <Hero />
      <Services />
      <Gallery />
      <Trainers />
      <Timing />
      <Pricing />
      <Contact />
    </main>
  )
}

export default Home
