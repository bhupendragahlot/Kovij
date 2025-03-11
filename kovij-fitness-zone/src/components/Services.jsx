import { motion } from 'framer-motion';
import { FaDumbbell, FaUsers, FaRunning, FaHeartbeat, FaAppleAlt, FaChalkboardTeacher } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';

function Services() {
  const { theme } = useTheme();
  
  const services = [
    {
      icon: <FaDumbbell className="text-4xl text-red-500" />,
      title: "Modern Equipment",
      description: "State-of-the-art fitness equipment for all your workout needs."
    },
    {
      icon: <FaUsers className="text-4xl text-red-500" />,
      title: "Group Classes",
      description: "Energetic group sessions including HIIT, Zumba, Yoga, and more."
    },
    {
      icon: <FaRunning className="text-4xl text-red-500" />,
      title: "Cardio Zone",
      description: "Dedicated cardio area with treadmills, ellipticals, and bikes."
    },
    {
      icon: <FaHeartbeat className="text-4xl text-red-500" />,
      title: "Health Monitoring",
      description: "Regular health assessments and progress tracking."
    },
    {
      icon: <FaAppleAlt className="text-4xl text-red-500" />,
      title: "Nutrition Guidance",
      description: "Expert advice on diet and nutrition for optimal results."
    },
    {
      icon: <FaChalkboardTeacher className="text-4xl text-red-500" />,
      title: "Personal Training",
      description: "One-on-one sessions with certified personal trainers."
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <section id="services" className={`py-20 px-4 sm:px-6 lg:px-8 ${theme === 'dark' ? 'bg-gradient-to-b from-black to-gray-900' : 'bg-gradient-to-b from-white to-gray-100'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
              OUR SERVICES
            </span>
          </h2>
          <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} max-w-3xl mx-auto`}>
            We offer a wide range of fitness services to help you achieve your goals, whether you're a beginner or an experienced athlete.
          </p>
        </div>

        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {services.map((service, index) => (
            <motion.div 
              key={index}
              className={`${theme === 'dark' 
                ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700 hover:border-red-500/50 group' 
                : 'bg-white/70 backdrop-blur-sm border-gray-200 hover:border-red-500/50 group shadow-sm'} 
                p-8 rounded-xl hover:bg-gray-800/80 transition-all duration-300 border`}
              variants={itemVariants}
            >
              <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
                {service.icon}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'} group-hover:text-red-400 transition-colors duration-300`}>
                {service.title}
              </h3>
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                {service.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default Services;
