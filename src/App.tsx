import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowDown, CheckCircle2, Users, Target, Zap, Menu, X, ChevronDown, Play, Pause, Volume2, VolumeX, Copy, Check } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ContactAndAssetsPage from './pages/ContactAndAssetsPage';
import gsap from 'gsap';
import Markdown from 'react-markdown';

function Splash({ onComplete }: { onComplete: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleEnter = () => {
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  return (
    <motion.div
      initial={{ y: 0 }}
      exit={{ y: '-100%', transition: { duration: 1.2, ease: [0.85, 0, 0.15, 1] } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
    >
      <motion.div 
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
        className="flex flex-col items-center justify-center w-full px-4"
      >
        <h1 className="font-display text-[7vw] md:text-[4.5vw] leading-none text-black tracking-[0.1em] text-center uppercase flex flex-row items-center justify-center">
          <span className="font-light">You need.</span>
          <span className="font-bold ml-2 md:ml-3">We build.</span>
        </h1>
        
        <button
          onClick={handleEnter}
          className="mt-4 md:mt-5 text-[10px] md:text-[11px] font-sans tracking-[0.3em] uppercase text-gray-400 hover:text-black transition-colors duration-500 cursor-pointer"
        >
          Enter
        </button>
      </motion.div>
    </motion.div>
  );
}

function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = useLocation();
  const isDarkPage = location.pathname.includes('/family-day');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const solutions = [
    '企业家庭日/开放日',
    '客户答谢&精品沙龙',
    '年会活动与企业文化',
    '商业美陈与展览',
    '视频与数字资产',
    '学术与专业论坛',
    '其他'
  ];

  const navBgClass = isScrolled 
    ? (isDarkPage ? 'bg-black/95 backdrop-blur-md py-4 shadow-sm border-b border-white/10' : 'bg-white/95 backdrop-blur-md py-4 shadow-sm') 
    : 'bg-transparent py-6';

  const textColorClass = (isDarkPage && !isScrolled) || (isDarkPage && isScrolled) ? 'text-white' : 'text-black';
  const hoverColorClass = isDarkPage ? 'hover:text-gray-300' : 'hover:text-gray-500';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${navBgClass}`}>
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 flex items-center justify-between">
        
        {/* LOGO Area */}
        <Link to="/" className="relative z-50 flex items-center">
          <img loading="lazy" src="/logo.png" alt="NEED" className="h-8 md:h-10 w-auto object-contain" onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }} />
          <span className={`hidden font-display font-black text-2xl tracking-widest uppercase ${isDarkPage ? 'text-white' : 'text-[#2c1d1b]'}`}>
            NEED<span className="text-[#f58232]">.</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className={`hidden lg:flex items-center gap-8 ${textColorClass}`}>
          <Link to="/#who-we-are" className={`text-sm font-medium transition-colors ${hoverColorClass}`}>我们是谁</Link>
          
          {/* Dropdown */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveDropdown('solutions')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <Link to="/solutions" className={`text-sm font-medium flex items-center gap-1 transition-colors py-2 ${hoverColorClass}`}>
              场景解决方案 <ChevronDown className="w-4 h-4" />
            </Link>
            <AnimatePresence>
              {activeDropdown === 'solutions' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 bg-white shadow-xl shadow-black/5 border border-gray-100 py-4 min-w-[240px] rounded-xl"
                >
                  {solutions.map((item, idx) => (
                    <Link key={idx} to="/solutions" className="block px-6 py-2.5 text-sm text-gray-600 hover:text-black hover:bg-gray-50 transition-colors">
                      {item}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link to="/#how-to-choose" className={`text-sm font-medium transition-colors ${hoverColorClass}`}>怎么选活动公司</Link>
          <Link to="/#two-choose-one" className={`text-sm font-medium transition-colors ${hoverColorClass}`}>二选一怎么选</Link>
          <Link to="/#methods" className={`text-sm font-medium transition-colors ${hoverColorClass}`}>方法与判断</Link>
          <Link to="/#cases" className={`text-sm font-medium transition-colors ${hoverColorClass}`}>案例拆解</Link>
        </nav>

        {/* Contact Button & Mobile Toggle */}
        <div className="flex items-center gap-4 relative z-50">
          <Link to="/contact" className={`hidden md:block px-6 py-2.5 text-sm font-medium rounded-full transition-colors ${isDarkPage ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>
            联系我们
          </Link>
          <button className={`lg:hidden ${textColorClass}`} onClick={() => setIsMobileOpen(!isMobileOpen)}>
            {isMobileOpen ? <X className="w-6 h-6 text-black" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: '100vh' }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed inset-0 bg-white z-40 lg:hidden pt-24 px-6 overflow-y-auto"
          >
            <div className="flex flex-col gap-6 pb-24 text-black">
              <Link to="/#who-we-are" onClick={() => setIsMobileOpen(false)} className="text-2xl font-bold">我们是谁</Link>
              
              <div className="flex flex-col gap-4">
                <Link to="/solutions" onClick={() => setIsMobileOpen(false)} className="text-2xl font-bold">场景解决方案</Link>
                <div className="flex flex-col gap-3 pl-4 border-l-2 border-gray-100">
                  {solutions.map((item, idx) => (
                    <Link key={idx} to="/solutions" onClick={() => setIsMobileOpen(false)} className="text-lg text-gray-600">
                      {item}
                    </Link>
                  ))}
                </div>
              </div>

              <Link to="/#how-to-choose" onClick={() => setIsMobileOpen(false)} className="text-2xl font-bold">怎么选活动公司</Link>
              <Link to="/#two-choose-one" onClick={() => setIsMobileOpen(false)} className="text-2xl font-bold">二选一怎么选</Link>
              <Link to="/#methods" onClick={() => setIsMobileOpen(false)} className="text-2xl font-bold">方法与判断</Link>
              <Link to="/#cases" onClick={() => setIsMobileOpen(false)} className="text-2xl font-bold">案例拆解</Link>
              <Link to="/contact" onClick={() => setIsMobileOpen(false)} className="text-2xl font-bold mt-8">联系我们</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(0.45);
  const [isMuted, setIsMuted] = useState(true); // Start muted to allow autoplay

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const textY = useTransform(scrollYProgress, [0, 0.3], ["0vh", "-60vh"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  const videoY = useTransform(scrollYProgress, [0, 0.3, 0.8], ["45vh", "0vh", "0vh"]);
  const videoWidth = useTransform(scrollYProgress, [0, 0.3, 0.8], ["60vw", "90vw", "100vw"]);
  const videoHeight = useTransform(scrollYProgress, [0, 0.3, 0.8], ["35vh", "80vh", "100vh"]);
  const videoRadius = useTransform(scrollYProgress, [0, 0.3, 0.8], ["24px", "24px", "0px"]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      if (!newMutedState && volume === 0) {
        setVolume(0.45);
        videoRef.current.volume = 0.45;
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      } else if (newVolume === 0 && !isMuted) {
        setIsMuted(true);
        videoRef.current.muted = true;
      }
    }
  };

  return (
    <div id="hero" ref={containerRef} className="h-[300vh] relative bg-white" style={{ position: 'relative' }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        
        <motion.div 
          style={{ opacity: textOpacity, y: textY }}
          className="absolute inset-0 flex flex-col items-center justify-center px-4 z-10"
        >
          <h2 className="font-display text-[16vw] md:text-[11vw] leading-[0.85] font-black text-black tracking-tighter text-center uppercase">
            尼德公关
          </h2>
          <p className="mt-8 md:mt-10 text-lg md:text-2xl font-medium text-gray-800 max-w-2xl mx-auto text-center">
            不是做一场热闹的活动，而是把需求判断清楚、把结果稳稳落地
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-10 md:mt-12">
            <Link to="/#how-to-choose" className="px-8 py-4 rounded-full bg-[#ccff00] text-black text-sm tracking-widest font-bold hover:bg-[#b3e600] transition-colors duration-300 cursor-pointer">
              怎么选活动公司
            </Link>
            <Link to="/#cases" className="px-8 py-4 rounded-full border border-black text-sm tracking-widest uppercase font-medium hover:bg-black hover:text-white transition-colors duration-300 cursor-pointer">
              查看场景方案
            </Link>
          </div>
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <motion.div 
            style={{ 
              y: videoY,
              width: videoWidth, 
              height: videoHeight, 
              borderRadius: videoRadius,
            }}
            className="relative overflow-hidden shadow-2xl bg-gray-200 pointer-events-auto group"
          >
            <video 
              ref={videoRef}
              autoPlay 
              muted={isMuted}
              loop 
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              src="/hero-video.mp4"
            />
            
            {/* Video Controls - Minimalist Transparent Module (Always visible) */}
            <div className="absolute bottom-6 md:bottom-10 left-6 md:left-10 z-50">
              <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 shadow-lg text-white">
                <button 
                  onClick={togglePlay}
                  className="hover:text-[#ccff00] transition-colors"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                
                <div className="w-px h-4 bg-white/30 mx-2" />
                
                <button 
                  onClick={toggleMute}
                  className="hover:text-[#ccff00] transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={isMuted ? 0 : volume} 
                  onChange={handleVolumeChange}
                  className="w-20 md:w-24 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-[#ccff00] transition-all"
                />
              </div>
            </div>

            {/* Scroll Down Arrow (Fades in as you scroll down) */}
            <motion.div 
              style={{ opacity: useTransform(scrollYProgress, [0.7, 0.8], [0, 1]) }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white flex flex-col items-center pointer-events-none"
            >
              <ArrowDown className="w-8 h-8 animate-bounce" />
            </motion.div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}

function WhoWeAreSection() {
  return (
    <section id="who-we-are" className="min-h-screen bg-white flex items-center justify-center py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h3 className="text-2xl md:text-4xl font-bold text-gray-400 mb-8 md:mb-12">我们是谁：</h3>
          <p className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight text-gray-900">
            用创意、诚意和落地，把重要的事做成客户想要的样子；<br className="hidden md:block" />
            <span className="text-gray-400">NEED，认真对待客户的每一次 NEED</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function PlaceholderSection({ id, title, subtitle, dark = false, linkTo, linkText }: { id: string, title: string, subtitle?: string, dark?: boolean, linkTo?: string, linkText?: string }) {
  return (
    <section id={id} className={`min-h-[70vh] flex items-center justify-center py-24 px-6 md:px-12 lg:px-24 ${dark ? 'bg-black text-white' : 'bg-[#f4f4f4] text-black'}`}>
      <div className="max-w-5xl mx-auto w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <h3 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">{title}</h3>
          {subtitle && <p className="text-xl md:text-2xl text-gray-500 max-w-4xl mx-auto">{subtitle}</p>}
          
          {linkTo && linkText && (
            <Link to={linkTo} className={`mt-10 inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-lg transition-colors ${dark ? 'bg-[#ccff00] text-black hover:bg-[#b3e600]' : 'bg-black text-white hover:bg-gray-800'}`}>
              {linkText}
            </Link>
          )}

          {!linkTo && <div className="mt-12 w-16 h-1 bg-[#ccff00] mx-auto" />}
        </motion.div>
      </div>
    </section>
  );
}

function CasesTrailSection() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const poolRefs = useRef<(HTMLImageElement | null)[]>([]);
  const lastPos = useRef({ x: 0, y: 0 });
  const poolIndex = useRef(0);
  const imageIndex = useRef(0);

  const images = [
    "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1505236858219-8359eb29e325?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=800&auto=format&fit=crop",
  ];

  useEffect(() => {
    // Preload images to browser cache to prevent network stutter during animation
    images.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    const section = sectionRef.current;
    if (!section) return;

    // Native event listener for maximum frequency and zero React overhead
    const handleMove = (clientX: number, clientY: number) => {
      const rect = section.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const dist = Math.hypot(x - lastPos.current.x, y - lastPos.current.y);

      // Distance threshold
      if (dist > 45) {
        lastPos.current = { x, y };

        const img = poolRefs.current[poolIndex.current];
        if (!img) return;

        // Cycle through the fixed pool of 40 DOM nodes (increased for longer lingering animations)
        poolIndex.current = (poolIndex.current + 1) % 40;
        
        const src = images[imageIndex.current % images.length];
        imageIndex.current += 1;
        
        const rotate = Math.random() * 20 - 10;

        img.src = src;

        // GSAP Animation for extreme smoothness
        // Kill any ongoing animation on this specific image
        gsap.killTweensOf(img);
        
        // Instantly set starting position using hardware-accelerated transforms
        gsap.set(img, {
          x: x,
          y: y,
          xPercent: -50,
          yPercent: -50,
          scale: 0.75, // Start larger so the gentle fade-in is clearly visible
          rotation: rotate,
          opacity: 0,
          zIndex: imageIndex.current
        });

        // 1. Slow, gentle fade-in effect (as requested)
        gsap.to(img, {
          opacity: 1,
          duration: 1.2,
          ease: "expo.out",
        });

        // 2. Scale and appear effect (slightly delayed so fade-in happens first)
        gsap.to(img, {
          scale: 1,
          duration: 1.2,
          ease: "expo.out",
          delay: 0.1
        });

        // 3. Animate out: Fade to a ghostly presence and shrink
        gsap.to(img, {
          opacity: 0.1, // Fade to a subtle ghostly presence instead of 0
          scale: 0.6,   // Shrink further to push them into the background
          duration: 1.5, // Slightly longer duration for a smoother transition to the ghost state
          ease: "power2.inOut",
          delay: 0.9 // Linger for a moment before fading
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY);

    // Use passive listeners to avoid blocking scrolling
    section.addEventListener('mousemove', onMouseMove, { passive: true });
    section.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      section.removeEventListener('mousemove', onMouseMove);
      section.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return (
    <section
      id="cases-trail"
      ref={sectionRef}
      className="relative min-h-[100vh] bg-[#0a0a0a] overflow-hidden cursor-pointer flex flex-col items-center justify-center py-32"
      onClick={() => navigate('/solutions')}
    >
      {/* Object Pool: Pre-rendered DOM nodes to avoid GC pauses and reflows */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {Array.from({ length: 40 }).map((_, i) => (
          <img
            key={i}
            loading="lazy"
            ref={el => { poolRefs.current[i] = el; }}
            className="absolute top-0 left-0 w-48 md:w-80 h-auto object-cover opacity-0 shadow-2xl rounded-sm"
            // Force hardware acceleration and composite layer creation
            style={{ willChange: 'transform, opacity' }}
            alt=""
          />
        ))}
      </div>

      {/* Static Text Layer - High-End Editorial Layout */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-7xl mx-auto pointer-events-none mix-blend-difference text-white px-6 h-full py-20">
        <div className="w-full flex flex-col justify-center gap-2 md:gap-6">
          
          {/* Top Left: 创意 */}
          <div className="w-full flex justify-start md:pl-12">
            <h2 className="text-[20vw] md:text-[13rem] font-black tracking-tight leading-[0.85]">
              创意
            </h2>
          </div>

          {/* Center: 案例 + English Accents */}
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6 md:gap-16 my-4 md:my-0">
            <span className="hidden md:block text-xs md:text-sm tracking-[0.3em] uppercase font-medium max-w-[200px] text-right opacity-80 leading-relaxed">
              FROM CREATIVE IDEAS<br/>TO REAL CASES
            </span>
            <h2 className="text-[20vw] md:text-[13rem] font-black tracking-tight leading-[0.85]">
              案例
            </h2>
            <span className="hidden md:block text-xs md:text-sm tracking-[0.3em] uppercase font-medium max-w-[200px] text-left opacity-80 leading-relaxed">
              BUILT TO WORK<br/>ON SITE
            </span>
          </div>

          {/* Bottom Right: 现场 */}
          <div className="w-full flex justify-end md:pr-12">
            <h2 className="text-[20vw] md:text-[13rem] font-black tracking-tight leading-[0.85]">
              现场
            </h2>
          </div>

        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 text-xs tracking-widest uppercase md:hidden pointer-events-none">
        Tap anywhere to view solutions
      </div>
    </section>
  );
}

function CTASection() {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText('needpr@163.com');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <section id="contact" className="min-h-screen bg-white flex items-center justify-center py-24 px-6 md:px-12 lg:px-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px] bg-[#ccff00]/20 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-5xl mx-auto w-full text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-gray-900 mb-12 leading-tight">
            联系我们，<br />先把你的需求判断清楚<span className="text-[#ccff00]">.</span>
          </h2>
          
          <Link
            to="/contact"
            className="mb-16 bg-black text-[#ccff00] text-xl md:text-3xl font-bold px-12 py-6 rounded-full inline-flex items-center gap-4 hover:bg-gray-900 transition-colors cursor-pointer shadow-xl hover:shadow-2xl"
          >
            获取专业建议
            <Zap className="w-6 h-6 md:w-8 md:h-8" />
          </Link>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 w-full">
            {/* QA Cards */}
            <div className="bg-white/60 backdrop-blur-3xl p-8 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col items-center hover:shadow-2xl transition-all hover:-translate-y-1">
              <img 
                loading="lazy"
                src={`/qr-wechat.png`}
                alt="NEED 尼德公关 微信" 
                className="w-48 h-48 md:w-full md:h-auto md:aspect-square object-contain bg-white rounded-2xl mb-6 shadow-sm border border-gray-50" 
              />
              <span className="font-bold text-gray-900 text-lg">主理人微信</span>
              <span className="text-gray-500 text-sm mt-1">需详聊项目扫描这里</span>
            </div>
            <div className="bg-white/60 backdrop-blur-3xl p-8 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col items-center hover:shadow-2xl transition-all hover:-translate-y-1">
              <img 
                loading="lazy"
                src={`/qr-xhs-main.png`}
                alt="NEED 尼德公关 小红书" 
                className="w-48 h-48 md:w-full md:h-auto md:aspect-square object-contain bg-white rounded-2xl mb-6 shadow-sm border border-gray-50" 
              />
              <span className="font-bold text-gray-900 text-lg">主号 小红书</span>
              <span className="text-gray-500 text-sm mt-1">NEED尼德公关</span>
            </div>
            <div className="bg-white/60 backdrop-blur-3xl p-8 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col items-center hover:shadow-2xl transition-all hover:-translate-y-1">
              <img 
                loading="lazy"
                src={`/qr-xhs-sub.png`}
                alt="然汽造 小红书子账号" 
                className="w-48 h-48 md:w-full md:h-auto md:aspect-square object-contain bg-white rounded-2xl mb-6 shadow-sm border border-gray-50" 
              />
              <span className="font-bold text-gray-900 text-lg">子号 小红书</span>
              <span className="text-gray-500 text-sm mt-1">然汽造</span>
            </div>

            {/* Info Cards */}
            <div 
              className="md:col-span-1 bg-gray-900 text-white p-6 lg:p-8 rounded-[2rem] shadow-xl flex flex-col justify-center hover:-translate-y-1 transition-all relative group cursor-pointer"
              onClick={handleCopy}
            >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#ccff00] text-sm font-bold tracking-widest uppercase text-left">Email Us</span>
                  <button className="text-gray-400 group-hover:text-white transition-colors shrink-0 bg-white/10 p-2 rounded-xl border border-white/5 group-hover:border-white/20">
                    {isCopied ? <Check className="w-4 h-4 text-[#ccff00]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <a href="mailto:needpr@163.com" onClick={e => e.stopPropagation()} className="text-[1.3rem] lg:text-2xl font-black hover:text-[#ccff00] transition-colors break-words text-left">
                  needpr@163.com
                </a>
            </div>
            <div className="md:col-span-2 bg-gray-50 p-8 rounded-[2rem] shadow-xl border border-gray-200 flex flex-col justify-center hover:-translate-y-1 transition-all text-left">
                <span className="text-gray-400 text-sm font-bold tracking-widest uppercase mb-3">Visit Us</span>
                <span className="text-xl lg:text-2xl font-bold text-gray-900 leading-snug">天津市东丽区英诺美迪产业园1号楼2F</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// --- Home Page Sections ---

function MethodsSection() {
  return (
    <section id="methods" className="py-24 px-6 md:px-12 lg:px-24 bg-[#f4f4f5] text-black">
      <div className="max-w-7xl mx-auto w-full">
        <header className="mb-16 md:mb-24 text-center md:text-left">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-6">
            方法与判断<span className="text-[#ccff00]">.</span>
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl leading-relaxed mx-auto md:mx-0">
            怎么选活动公司？在预算与体验中如何取舍？不是只看案例好不好看，而是看对方能不能听懂核心需求、判断清重点，并把项目稳稳落下来。
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {articlesData.map((article) => (
            <Link 
              key={article.id} 
              to={`/how-to-choose/${article.id}`}
              className="group block bg-white p-8 md:p-12 hover:bg-black hover:text-white transition-all duration-500 rounded-2xl md:rounded-3xl shadow-sm hover:shadow-2xl"
            >
              <div className="text-gray-300 font-mono text-xl mb-6 group-hover:text-white/30 transition-colors">
                {article.id}
              </div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-[#ccff00] transition-colors line-clamp-2 md:line-clamp-none">
                {article.title}
              </h3>
              <p className="text-gray-600 group-hover:text-gray-400 transition-colors line-clamp-2 md:line-clamp-3">
                {article.excerpt}
              </p>
              <div className="mt-8 flex items-center text-sm font-bold uppercase tracking-wider text-black group-hover:text-white transition-colors">
                阅读全文 <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:text-[#ccff00] transition-transform" />
              </div>
            </Link>
          ))}
        </div>
        
        <div className="mt-16 flex justify-center">
            <Link to="/how-to-choose" className="inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-lg bg-black text-[#ccff00] hover:bg-gray-800 transition-colors">
                查看更多方法与判断摘要
            </Link>
        </div>
      </div>
    </section>
  );
}

function CasesPreviewSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -window.innerWidth * 0.8, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: window.innerWidth * 0.8, behavior: 'smooth' });
    }
  };

  return (
    <section id="cases" className="min-h-screen bg-black text-white pt-24 pb-32">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <header className="mb-12 md:mb-20 relative flex flex-col md:flex-row md:items-end justify-between gap-8 text-center md:text-left">
          <div className="relative z-10 w-full">
            <div className="absolute -top-10 -left-10 w-48 h-48 md:w-64 md:h-64 bg-[#ccff00] rounded-full mix-blend-screen filter blur-[100px] opacity-20 pointer-events-none" />
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-8 relative z-10">
              案例拆解<span className="text-[#ccff00]">.</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl leading-relaxed font-light relative z-10 mx-auto md:mx-0">
              不同活动场景，对应不同业务目标。我们提供针对性的标准动作与关键判断，帮你在预算内拿到最确定的结果。
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 z-10 shrink-0">
            <button 
              onClick={scrollLeft}
              className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ArrowRight className="w-6 h-6 rotate-180" />
            </button>
            <button 
              onClick={scrollRight}
              className="w-14 h-14 rounded-full bg-[#ccff00] text-black flex items-center justify-center hover:bg-[#b3e600] transition-colors"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-12 [&::-webkit-scrollbar]:hidden" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          {[...caseStudiesData, { ...caseStudiesData[0], id: 'hyundai-family-day-2' }, { ...caseStudiesData[0], id: 'hyundai-family-day-3' }].map((caseStudy) => (
            <Link 
              key={caseStudy.id} 
              to={`/cases/${caseStudy.id}`}
              className="group relative overflow-hidden bg-white/5 rounded-3xl transition-all duration-500 hover:bg-[#ccff00] hover:shadow-[0_0_40px_rgba(204,255,0,0.15)] hover:-translate-y-1 border border-white/10 hover:border-transparent flex flex-col md:flex-row min-w-[85vw] md:min-w-[800px] lg:min-w-[1000px] snap-center shrink-0"
            >
              <div className="w-full md:w-2/5 aspect-[4/3] md:aspect-auto md:min-h-full overflow-hidden relative">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10 mix-blend-overlay" />
                <img loading="lazy" src={caseStudy.coverImg} alt={caseStudy.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="p-8 md:p-12 lg:p-16 flex-1 flex items-center">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {caseStudy.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-white/10 text-xs font-bold uppercase tracking-wider rounded-full text-white/80 group-hover:bg-black/10 group-hover:text-black transition-colors">{tag}</span>
                        ))}
                    </div>
                    <h3 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-6 text-white group-hover:text-black transition-colors leading-tight">
                    {caseStudy.title}
                    </h3>
                    <p className="text-gray-400 group-hover:text-black/80 transition-colors leading-relaxed text-lg mb-10 max-w-2xl">
                    {caseStudy.excerpt}
                    </p>
                    <div className="flex items-center text-sm font-bold uppercase tracking-wider text-white group-hover:text-black transition-colors">
                    进入深度拆解 <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:text-[#ccff00] transition-transform" />
                    </div>
                  </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowToChoosePreviewSection() {
  return (
    <section id="how-to-choose" className="py-24 px-6 md:px-12 lg:px-24 bg-white text-black relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#ccff00]/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center gap-16 relative z-10">
        <div className="flex-1 text-center lg:text-left">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 relative inline-block">
            怎么选活动公司<span className="text-[#ccff00] absolute -right-6 bottom-0">.</span>
          </h2>
          <p className="text-xl text-gray-500 mb-10 leading-relaxed max-w-2xl mx-auto lg:mx-0">
            不是只看案例好不好看，而是看对方能不能听懂需求、判断清重点，并把项目稳稳落下来。<br className="hidden md:block"/>
            寻找那个在目标、限制条件和推进方式上与你最契合的团队。
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <Link to="/how-to-choose" className="group inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-lg bg-black text-[#ccff00] hover:bg-gray-900 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
              查看完整指南
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[{title: "理解需求", desc: "先听懂要求比先出方案更重要"}, {title: "判断力", desc: "在复杂条件下做出正确取舍"}, {title: "看案例", desc: "不仅看好不好看，更看适不适合"}, {title: "执行力", desc: "创意决定起点，执行决定重点"}].map((card, i) => (
            <div key={i} className="bg-gray-50 p-8 rounded-3xl hover:bg-[#ccff00] transition-colors group cursor-default">
              <div className="text-4xl font-black text-gray-200 mb-4 group-hover:text-black/20 transition-colors">0{i+1}</div>
              <h4 className="text-xl font-bold mb-2 text-gray-900">{card.title}</h4>
              <p className="text-sm text-gray-500 group-hover:text-gray-700">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChooseBetweenTwoPreviewSection() {
  return (
    <section id="two-choose-one" className="py-24 px-6 md:px-12 lg:px-24 bg-black text-white relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] pointer-events-none translate-y-1/2 -translate-x-1/2" />
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row-reverse items-center gap-16 relative z-10">
        <div className="flex-1 text-center lg:text-left">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 relative text-white">
            二选一怎么选<span className="text-[#ccff00]">.</span>
          </h2>
          <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto lg:mx-0">
            预算差不多、案例都不错的时候，真正难选的不是谁会说，而是谁更适合你的项目。<br className="hidden md:block"/>
            当硬实力趋同，软性维度的匹配才是最后的那根筹码。
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <Link to="/choose-between-two" className="group inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-lg bg-[#ccff00] text-black hover:bg-[#b3e600] transition-all shadow-lg hover:shadow-[0_0_20px_rgba(204,255,0,0.4)] hover:-translate-y-1">
              查看完整指南
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
        <div className="flex-1 w-full space-y-4">
          {[
            { tag: "案例 vs 需求", title: "大厂光环和懂你痛点之间，哪个更具性价比？" },
            { tag: "创意 vs 执行", title: "创意决定你能飞多高，执行决定你能否安全着陆。" },
            { tag: "底价 vs 溢价", title: "价格战背后暗流涌动，对比总价不如对比水分。" },
            { tag: "实力相当", title: "团队化学反应与危机管理基因，往往是致胜关键。" }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-6 bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
              <span className="bg-[#ccff00]/10 text-[#ccff00] px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap">{item.tag}</span>
              <p className="text-gray-300 font-medium">{item.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Home() {
  return (
    <main>
      <HeroSection />
      <WhoWeAreSection />
      <CasesTrailSection />
      <HowToChoosePreviewSection />
      <ChooseBetweenTwoPreviewSection />
      <MethodsSection />
      <CasesPreviewSection />
      <CTASection />
    </main>
  );
}

export const caseStudiesData = [
  {
    id: 'hyundai-family-day',
    title: '制造研发中心的家庭日，不只是让孩子玩一天',
    subtitle: '现代汽车研发中心 | 制造研发类 | 家庭日开放日',
    excerpt: '从荣誉致敬、亲子互动到开放日动线，NEED 为现代汽车研发中心打造了一场围绕“家庭”与“感恩”的企业家庭日活动。',
    coverImg: '/03-主题主视觉-花Young亲子家年华.jpg',
    tags: ['家庭日', '制造研发'],
    content: `从荣誉致敬、亲子互动到开放日动线，NEED 为现代汽车研发中心打造了一场围绕“家庭”与“感恩”的企业家庭日活动。

![全场俯拍](/01-全场俯拍-场地利用.jpg)
*图 1｜全场俯拍：研发中心园区草坪被划分为多个活动区域，形成从进入、停留、互动到领取礼品的完整开放日动线。*

### 项目背景：制造研发型企业的家庭日，要解决的不只是“热闹”

对于制造研发类企业来说，家庭日不只是一次员工活动。它更像是一次“打开园区”的机会：让员工家属走进平时不容易进入的工作场景，看见员工工作的地方，也看见企业对长期陪伴的感谢。

这次现代汽车研发中心家庭日开放日，活动围绕“家庭”与“感恩”两个核心展开。NEED 负责全场活动策划与落地执行，将研发中心园区里的草坪、道路、建筑前场和户外空间，转化成一条完整的家庭日体验动线。

![入口欢迎](/02-入口欢迎-开放日第一印象.jpg)
*图 2｜入口欢迎：建筑、入口装置和导视信息同时出现，能让客户一眼看出这是企业园区开放日，而不是普通亲子游园。*

### 不是把项目摆满，而是先把场地用起来

这类企业园区活动，最容易出现的问题是：有场地，但没有被真正组织起来。如果只是摆几个摊位、放几个游乐设施，现场看起来也会热闹，但参与者容易分散，家长不知道往哪走，孩子只集中在一两个项目上，企业想传递的内容也容易被游乐氛围冲淡。

所以这个项目的第一层设计，不是先想“做什么装置”，而是先判断现场空间关系：入口和品牌欢迎、草坪互动、拍照打卡、导视、礼品领取和餐饮补给需要被组织到同一条体验路径里。

![空间分区](/04-空间分区-场地容量.jpg)
*图 3｜空间分区：从俯视角度可以看到，活动不是单点布置，而是围绕园区空间形成了多个可参与、可停留的区域。*

### 用轻松的亲子视觉，软化研发中心的工业感

现代汽车研发中心本身带有很强的制造业、研发型企业气质。建筑线条理性、空间开阔，适合正式办公与技术研发，但如果直接用原场地做家庭日，容易显得“硬”。

因此现场视觉采用了更明亮、更轻松的亲子化表达。“花 Young 亲子家年华”的主题视觉，把花朵、卡通人物、汽车元素和家庭互动融合在一起，让原本偏理性的研发园区变成更适合家属和孩子进入的活动场景。

![主题主视觉](/03-主题主视觉-花Young亲子家年华.jpg)
*图 4｜主题主视觉：明亮的主题视觉和花朵、汽车元素结合，既保留品牌关联，也降低企业园区的距离感。*

![亲子打卡](/05-亲子打卡-主题场景.jpg)
*图 5｜亲子打卡：主题装置适合拍照传播，同时没有过度依赖人物正脸，适合官网公开页使用。*

### 家庭日的关键，是让大人和孩子都能参与

很多家庭日容易变成“孩子玩，大人等”。这次活动的设计重点，是让不同年龄、不同参与状态的人都能找到自己的位置。

孩子可以参与大型游艺、草坪游戏和手作体验；家长可以陪同拍照、完成亲子互动、参与轻量游戏；员工可以带家属参观园区、领取礼品、参与话题传播；企业则可以在这个过程中完成一次温和的品牌沟通和员工关系表达。

![互动游艺](/06-互动游艺-低门槛参与.jpg)
*图 6｜互动游艺：低门槛游艺项目让现场参与不集中在单一区域，家长和孩子都容易进入。*

![手作体验](/07-手作体验-家庭共创.jpg)
*图 7｜手作体验：手作区把亲子互动从单纯游乐延展到共同完成、共同纪念的体验。*

### 把“感恩”做成家属也能看见的表达

这个项目里，“感恩”不是一句口号。现代汽车研发中心特别为入职 10 周年、11 周年、12 周年的员工设置荣誉致敬仪式，通过名单公示、专属表彰和礼赠安排，感谢员工长期同路而行。

这个环节的意义在于，它不是只发生在企业内部会议室里，而是被放到家庭日开放日的整体场景中。家属来到现场，不只看到游戏和拍照，也能看到企业对员工长期付出的认可。

![员工荣誉](/08-员工荣誉-感恩表达.jpg)
*图 8｜员工荣誉：荣誉致敬和礼赠区域让员工长期陪伴被看见，也让家属感受到企业对员工价值的认可。*

### 礼品、餐饮和休息区，是家庭日体验里的基本功

家庭日的现场体验，往往不是由某一个大装置决定的，而是由很多细节共同决定的。有没有地方坐？孩子玩累了有没有补给？礼品领取是否有秩序？餐饮区域是否容易找到？活动节点之间是否有足够的停留空间？这些都会直接影响家属对活动的感受。

这次活动中，餐饮、礼品、小卖部、休息区都被纳入整体场景设计，而不是临时附加。复古小卖部、礼品领取处、主题餐饮摊位和草坪休息区，让现场服务变得更自然。

![餐饮补给](/09-餐饮补给-服务区.jpg)
*图 9｜餐饮补给：餐饮和休息服务被纳入整体规划，让活动不只是舞台和游戏。*

![礼品小卖部](/10-礼品小卖部-场景化服务.jpg)
*图 10｜礼品小卖部：把领取、停留和拍照结合起来，减少普通发放区的事务感。*

### NEED 的处理方式：不是简单搭建，而是综合现场组织

这个项目真正考验的，不只是设计画面好不好看，而是综合活动能力。它需要同时处理场地规划、主题视觉、亲子互动、员工荣誉、礼品餐饮、动线秩序、拍照传播、现场执行和隐私保护。

尤其是涉及孩子参与的家庭日，现场既要热闹，也要有边界。哪些画面适合传播，哪些照片不适合公开；哪些区域适合聚集，哪些区域需要分散人流；哪些项目适合孩子玩，哪些项目需要家长共同参与，这些都不是单纯设计问题，而是活动公司对现场的判断问题。

NEED 在这个项目中提供的是从策划到落地的全场服务：让一个研发中心的开放日，不只是被布置出来，而是被组织成一次可参与、可停留、可传播、也有企业温度的家庭日体验。`
  }
];

export const articlesData = [
  {
    id: '01',
    title: '真正靠谱的活动执行，不是现场救火能力，而是前面少埋雷',
    excerpt: '很多人把现场救火能力当成活动执行的核心能力，但对企业活动来说，真正靠谱的执行，是前面少埋雷、流程更顺、风险更早被看见。',
    content: `# 真正靠谱的活动执行，不是现场救火能力，而是前面少埋雷

很多人评价活动执行时，最常说的一句话是：

“他们现场反应很快，救火能力很强。”

这句话不能说错。  
活动现场确实会有变化，也确实需要应变能力。  
但如果把“救火能力强”当成执行靠谱的核心标准，其实很容易看偏。

因为对企业活动来说，真正值得信任的执行，不是出了问题以后补得多漂亮，  
而是很多问题一开始就没有被埋进去。

## 先说结论

真正靠谱的活动执行，不是靠现场硬扛出来的，  
而是靠前面的判断、流程、分工、节点和风险控制，一步一步做出来的。

现场当然重要，  
但现场稳不稳，往往在活动开始前就已经决定了一大半。

## 为什么“救火能力强”不等于执行靠谱

现场能救火，说明这个团队确实有经验。  
但如果一个项目总是需要靠大量救火才能撑过去，  
那更大的问题其实在前面：

- 前期判断不够清楚
- 流程没有理顺
- 节点没有卡好
- 风险没有提前看见
- 配合要求没有讲明白

也就是说，  
现场的问题，很多时候不是现场才出现的，  
而是前面早就埋下了。

所以真正成熟的执行团队，  
不是把“救火”当本事，  
而是尽量让火少一点。

## 活动执行真正该看什么

### 1. 看流程是不是提前想清楚
执行不是到了现场才开始，  
而是在流程、节奏、分工、时间安排里，提前把大部分问题消化掉。

### 2. 看关键节点有没有卡住
很多现场问题，不是大错，  
而是一个小节点没卡住，后面一路被带偏。  
真正靠谱的执行，会在前面就把关键节点盯住。

### 3. 看风险是不是提前被看见
场地、天气、物料、来宾、时间、人员、动线……  
这些都可能影响活动结果。  
越靠谱的团队，越不会等问题来了才反应。

### 4. 看沟通和分工是不是清楚
很多所谓“现场混乱”，其实不是现场能力不够，  
而是前面没有把分工、衔接和责任讲明白。

## 为什么企业活动尤其不能靠“救火”撑

对很多企业活动来说，现场并不是一个适合反复试错的地方。

因为它可能涉及：

- 重要来宾
- 客户关系
- 内部高层
- 关键节点表达
- 公开场合
- 复杂协同

这些项目，一旦现场靠大量救火撑着走，  
最后即使表面看起来完成了，内部感受也常常不会太好。

企业客户真正需要的，不只是“出事后能补”，  
而是“尽量别出那么多事”。

## NEED 怎么看“执行靠谱”

NEED 更在意的，不是现场有多忙，  
而是项目有没有越来越稳。

所以我们通常会把执行这件事往前看：

- 需求有没有理顺
- 流程有没有做实
- 重点有没有看清
- 风险有没有提前提醒
- 配合方式有没有讲明白
- 节点有没有提前卡住

这些事情做好了，  
现场自然会更稳。

而一个执行靠谱的团队，  
真正给客户的感受，通常不是“哇，他们现场好会救火”，  
而是“这个项目推进得很顺，没让我一直担心”。

## 一个很现实的判断方法

如果你想判断一个团队执行是否靠谱，  
可以先看这几个问题：

1. 它讲执行时，是不是只讲资源，不讲流程  
2. 它有没有把关键节点说清楚  
3. 它有没有主动提醒你潜在风险  
4. 它有没有让你感觉沟通越来越清楚  
5. 它是不是在前面就把很多容易出问题的地方先处理掉了

如果这些都做到了，  
那它大概率比“现场会救火”更值得信任。

## 结尾

真正靠谱的活动执行，  
不是活动当天看起来多能扛，  
而是前面有没有把该想的都想在前面，把该管的都管在前面。

对企业活动来说，  
少埋雷，比会救火更重要。  
因为项目真正需要的，不是惊险地完成，  
而是稳稳地做成。

`
  },
  {
    id: '02',
    title: '为什么有些方案看起来很好，现场却不成立',
    excerpt: '很多活动方案在提案里很好看，到了现场却不成立。NEED 从时间、场地、流程、执行条件和判断误差五个角度，解释其中原因。',
    content: `# 为什么有些方案看起来很好，现场却不成立

很多活动方案，第一次看时都很动人。

画面漂亮，概念完整，动线清楚，节点丰富，  
提案里每一页都像在告诉你：这场活动会很出彩。

但真到了现场，情况却未必一样。  
有些方案最后并没有被做成；  
有些看起来能成立，落地时却处处打折；  
还有一些方案，最终变成了“现场勉强有个样子，但远不如提案时成立”。

这不是因为创意本身错了，  
而是因为很多方案，在形成的时候就没有真正接受现实条件的检验。

## 先说结论

方案看起来好，不等于它真的成立。  
一场活动要成立，至少同时满足三件事：

1. 目标判断是清楚的  
2. 现实条件是支持的  
3. 执行路径是走得通的  

只满足“看起来好”，远远不够。

## 为什么提案里的“成立”，和现场里的“成立”不是一回事

提案成立，更多是一种概念上的成立。  
它回答的是：

- 逻辑顺不顺
- 画面漂不漂亮
- 内容有没有完整表达
- 想法有没有吸引力

而现场成立，回答的是另外一些问题：

- 场地能不能支撑
- 时间够不够
- 预算撑不撑得住
- 协同链路顺不顺
- 节奏会不会乱
- 风险会不会过高

如果方案只在第一层成立，  
但第二层没被认真判断，  
那它大概率会在落地时出问题。

## 最常见的五种“不成立”

### 1. 时间不成立
方案节奏很好看，但真实推进时间不够。  
提案里能排出来，不代表现场来得及完成。

### 2. 场地不成立
画面效果在脑子里很好，  
但空间尺寸、动线、视线、承重、供电、噪音等条件一放进来，就变了。

### 3. 预算不成立
方案要成立，需要很多看不见的支撑成本。  
如果预算只够“做个样子”，那结果通常也只能停在样子上。

### 4. 执行链路不成立
方案本身没问题，但配合方太多、节点太细、逻辑太复杂，  
最后任何一个环节没接住，整体就容易失衡。

### 5. 风险控制不成立
方案为了效果推得太满，  
但没有给变化、调整和突发状况留出空间。  
这种方案，现场很容易靠救火撑着走。

## 为什么很多团队容易忽略这个问题

因为“看起来成立”往往更容易展示。  
它好说，也好看。  
但“能不能真正成立”需要更扎实的判断，  
它不一定华丽，却更难。

对活动策划执行来说，真正有价值的，不只是会出想法，  
而是会判断：

- 这个想法适不适合这次项目
- 它需要什么条件支撑
- 哪些地方值得坚持
- 哪些地方应该调整
- 它最后能不能稳稳落地

## NEED 怎么看“成立”这件事

NEED 更在意的是：  
方案不是为了“讲出来”才成立，  
而是为了“做出来”也成立。

所以我们会更重视那些看起来不那么显眼、  
但会直接影响结果的判断：

- 时间够不够
- 场地合不合适
- 节奏会不会乱
- 执行链路撑不撑得住
- 风险值不值得承担

很多时候，把这些问题提前想清楚，  
比多加一个亮点更重要。

## 一个很实用的判断方法

如果你拿到一份看起来很好的方案，  
可以先问这几个问题：

1. 这个方案最依赖什么条件成立  
2. 如果预算或时间收紧，它最先会掉哪部分  
3. 场地和动线真的支持它吗  
4. 执行链路有多复杂  
5. 如果现场临时变化，这个方案还能不能稳住

这几个问题问完，  
你会更容易判断它到底是“真的成立”，  
还是只是“提案里成立”。

## 结尾

一份方案真正好，不是因为它看起来多完整，  
而是因为它在现场也站得住。

对企业活动来说，  
真正值得信任的，不是提案里最热闹的那套说法，  
而是最后能被顺利做成、而且做对的那套方案。

`
  },
  {
    id: '03',
    title: '为什么一场活动开始前，先把目标判断清楚更重要',
    excerpt: '很多活动的问题，不是执行不努力，而是一开始目标没判断清楚。NEED 从企业活动策划与执行的角度，解释为什么目标判断是方案成立的第一步。',
    content: `# 为什么一场活动开始前，先把目标判断清楚更重要

很多人一提到活动，最先想到的是主题、舞台、流程、节目、氛围。  
但对企业客户来说，一场活动真正的起点，往往不是这些，而是更前面的一个问题：

**这场活动，到底要解决什么。**

这个问题听起来很基础，却恰恰是很多项目最容易出偏的地方。  
因为一旦目标没想清楚，后面的方案再热闹，也可能越做越偏；  
预算花了不少，现场也办出来了，但最后回头看，发现真正重要的东西并没有被完成。

对 NEED 来说，活动开始前最值得先做的，不是赶紧堆想法，而是先把目标判断清楚。

## 先说结论

一场活动开始前，先把目标判断清楚，不是为了把项目讲得更复杂，  
而是为了让后面的创意、预算、流程和执行，都有明确方向。

因为活动不是为了“办一下”，  
而是为了在某个重要节点，完成一次真实的表达、沟通、连接或推动。

## 为什么很多活动最后做偏了

很多项目最后的问题，并不出在执行不努力，  
而是出在一开始默认了一个模糊目标。

比如：

- 想做得热闹一点
- 想做得高级一点
- 想做得有氛围一点
- 想让大家满意一点

这些都不是错，但它们都不是清晰目标。  
因为它们没有告诉你：**这场活动真正优先要完成什么。**

对企业活动来说，目标通常会落在这些方向里：

- 内部激励
- 企业文化表达
- 品牌形象呈现
- 客户关系维护
- 阶段成果展示
- 参与感和体验感建立
- 某个关键节点的正式表达

如果这些目标没有先理清，  
后面的方案就很容易陷入“什么都想要，最后什么都不够到位”。

## 为什么目标会直接影响后面的所有判断

### 1. 它决定方案往哪个方向做

同样叫“年会”，  
有的年会重点在内部氛围和凝聚力；  
有的重点在对外形象和品牌表达；  
有的重点在节奏和体面；  
有的重点在有限预算内做出参与感。

目标不同，做法就不该一样。

### 2. 它决定钱该花在哪里

如果重点是内部激励，  
预算可能更该放在参与感、体验感和内容节奏上。

如果重点是品牌表达，  
预算可能更该放在视觉呈现、核心环节和信息传递上。

目标没清楚，预算就容易花散。  
钱一散，结果就弱。

### 3. 它决定流程和执行的重心

有的活动更看重“顺”，  
有的更看重“亮”，  
有的更看重“稳”，  
有的更看重“准”。

目标不同，流程设计和现场重点也会完全不同。

## 企业活动里，最常见的目标误区

### 误区一：把“热闹”当成目标
热闹最多只能算一种表象，  
不是一个真实的项目目标。

### 误区二：什么都想做
既想有品牌感，又想很轻松；  
既想表达很多内容，又想节奏很快；  
既想场面大，又想预算很省。  
如果没有优先级，最后往往容易两头不到岸。

### 误区三：只说形式，不说目的
说想做沙龙、做晚宴、做家庭日，这些只是形式。  
真正重要的是：为什么要用这个形式，它要完成什么。

## NEED 怎么看“目标判断”这件事

NEED 一直更重视项目开始前的目标判断。  
因为我们发现，很多后期看起来复杂的问题，  
其实都能追溯到前面一个没说清楚的目标。

所以在真正进入方案之前，我们更习惯先问这些问题：

- 这场活动为什么做
- 这次最重要想达成什么
- 哪些是必须完成的
- 哪些只是加分项
- 哪些现实条件会影响判断

把这些问题先看清楚，  
后面的创意才不会飘，预算才不会散，执行也更容易稳。

## 什么时候更需要把目标讲清楚

下面这些情况里，目标判断尤其重要：

- 项目预算有限
- 项目时间紧
- 内部协同复杂
- 多方都有意见
- 活动承担重要节点表达
- 项目不能出错
- 既想要效果，也想要效率

这种时候，目标越清楚，后面越省力。

## 结尾

一场活动是不是做对了，  
很多时候不是活动当天才决定的，  
而是在开始之前，目标有没有被判断清楚。

对企业客户来说，  
把目标先看清楚，不是多走一步，  
而是少走很多弯路。

`
  },
  {
    id: '04',
    title: '为什么预算判断，比一味堆创意更重要',
    excerpt: '很多活动不是没有创意，而是预算花错了地方。NEED 从企业活动策划与执行的角度，解释为什么预算判断比一味堆创意更重要。',
    content: `# 为什么预算判断，比一味堆创意更重要

很多人一聊活动，最容易被“创意”吸引。  
创意当然重要，它能决定一场活动是不是有亮点、有没有表达、能不能被记住。

但对企业活动来说，真正经常把项目拉开的，未必是创意本身，  
而是更前面的一件事：

**预算判断。**

因为很多活动的问题，不是没有想法，  
而是钱花错了地方。  
该花的地方没花够，不该堆的地方堆太多，  
最后结果往往是：看起来做了很多，但真正影响结果的部分没有被做好。

对 NEED 来说，预算判断不是“保守”，  
而是一场活动能不能成立的现实基础。

## 先说结论

对企业活动策划与执行来说，预算不是越高越好，  
也不是越省越好。  
真正重要的是：**预算有没有花在关键处。**

比起一味堆创意，更值得先判断的是：

- 这次活动最重要的结果是什么
- 哪些部分真的影响结果
- 哪些部分只是看起来很满
- 钱应该往哪里集中，项目才更成立

## 为什么很多项目不是输在创意，而是输在预算判断

创意本身并不难堆。  
难的是判断：哪些创意值得做，哪些只适合看，哪些虽然好看，但对这次项目并不重要。

预算判断做得不对，最容易出现三种情况：

### 1. 钱花散了
每个部分都想做一点，  
结果每个部分都不够有力。

### 2. 钱花偏了
把大量预算放在“看起来有存在感”的东西上，  
却忽略了真正会影响项目体验和结果的部分。

### 3. 钱花得没有优先级
什么都想保留，什么都不舍得收，  
最后预算不断被拉扯，项目反而越来越弱。

## 预算判断真正影响的是什么

### 1. 影响项目重点能不能立住
每场活动都应该有重点。  
预算的本质，不只是控制成本，  
而是帮助重点更清楚地被做出来。

### 2. 影响现场是不是稳
很多人把预算理解成“做多少效果”，  
但对活动项目来说，预算同样影响流程、执行、人手、物料细节和风险控制。  
这些东西不显眼，却直接影响现场稳不稳。

### 3. 影响客户最后觉得值不值
企业客户很少单纯因为“便宜”而满意，  
也很少因为“花得多”就觉得值。  
真正会让人觉得值的，是预算花得清楚、结果做得到位。

## 为什么一味堆创意，反而容易出问题

创意如果没有预算判断，最容易变成两种状态：

一种是“看起来很好”，但最后撑不住；  
一种是“做得很多”，但重点不明。

创意应该服务目标，  
预算应该服务结果。  
如果创意脱离预算判断，很容易只剩下提案上的热闹。

所以真正成熟的项目，不是想法越多越好，  
而是想法和预算要一起判断。

## 企业活动里，哪些地方最值得优先花预算

不同项目会有不同答案，  
但通常更值得优先考虑的是这些部分：

- 真正承担表达任务的核心环节
- 会直接影响体验和节奏的关键部分
- 会影响现场稳定性的执行和统筹
- 会影响整体感受的核心视觉或空间节点
- 会直接影响参与感和完成度的体验设计

相比之下，一些“表面上很热闹，但对结果帮助不大”的部分，  
往往更值得收。

## NEED 怎么看预算判断

NEED 一直更在意预算效率。  
不是为了把预算压到最低，  
而是希望在现实边界内，把有限的钱花在真正影响结果的位置上。

对我们来说，预算判断不是“省”，  
而是“准”。

准了，活动才更容易成立；  
不准，预算再多也可能做散。

所以我们在推进项目时，通常更习惯先问：

- 这次活动的重点是什么
- 钱最该往哪里集中
- 哪些地方值得做，哪些可以收
- 哪些投入会真正拉开结果差异

## 一个更现实的判断方法

如果你现在正在看预算，  
可以先问这四个问题：

1. 这笔钱花出去，最后会直接影响什么结果  
2. 如果这部分不做，会不会真的影响项目成立  
3. 这个投入是在加强重点，还是只是在增加热闹  
4. 预算是不是已经集中到最重要的位置上了

这四个问题一旦问清，  
很多“要不要做”的纠结就会简单很多。

## 结尾

创意当然重要。  
但对企业活动来说，比创意更先决定项目质量的，  
往往是预算判断。

不是钱多就好，  
也不是省钱就对。  
真正重要的是：预算有没有被用在关键处，结果能不能被做出来。

`
  }
];

export const chooseBetweenTwoArticlesData = [
  {
    id: '01',
    title: '一家案例更大，一家更贴需求，该怎么选',
    excerpt: '',
    content: ``
  },
  {
    id: '02',
    title: '一家创意更强，一家执行更稳，怎么判断更适合你',
    excerpt: '',
    content: ``
  },
  {
    id: '03',
    title: '一家报价更高，一家报价更低，真正该比什么',
    excerpt: '',
    content: ``
  },
  {
    id: '04',
    title: '两家活动公司都不错，最后到底该怎么做决定',
    excerpt: '',
    content: ``
  }
];


function CaseStudyPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const caseStudy = caseStudiesData.find(c => c.id === id) || caseStudiesData[0];

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-32 pb-16 px-6 md:px-12 lg:px-24 max-w-4xl mx-auto">
        <Link to="/#cases" className="inline-flex items-center text-sm font-bold tracking-widest uppercase mb-12 hover:text-[#ccff00] transition-colors">
          <ArrowRight className="w-4 h-4 mr-2 rotate-180" /> 返回案例列表
        </Link>
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-gray-900 mb-6 leading-tight">
          {caseStudy.title}
        </h1>
        <p className="text-xl text-gray-500 mb-8 max-w-2xl">
          {caseStudy.subtitle}
        </p>
        <div className="flex flex-wrap gap-2 mb-12">
            {caseStudy.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-black/5 text-xs font-bold uppercase tracking-wider rounded-full text-black/60">{tag}</span>
            ))}
        </div>
      </div>

      <div className="w-full h-[50vh] md:h-[70vh] bg-gray-100 mb-16 md:mb-24">
        <img loading="lazy" src={caseStudy.coverImg} alt={caseStudy.title} className="w-full h-full object-cover" />
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 lg:px-24 pb-24">
        <div className="markdown-body prose prose-lg prose-headings:font-black prose-headings:tracking-tighter prose-gray max-w-none prose-img:rounded-2xl prose-img:shadow-xl prose-img:w-full prose-p:leading-relaxed prose-a:text-[#ccff00]">
          <Markdown>{caseStudy.content}</Markdown>
        </div>
      </div>

      <div className="bg-gray-50 py-24 px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-8">想要这样的活动效果？</h2>
        <Link 
          to="/contact"
          className="bg-black text-[#ccff00] px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-900 transition-colors inline-block"
        >
          立即沟通需求
        </Link>
      </div>

      <QRCodeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
function HowToChoosePage() {
  const { pathname } = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const sections = [
    {
      id: 'understand-needs',
      navTitle: '理解需求',
      title: '01｜先比谁更理解你的需求',
      subtitle: '不是谁案例更大，而是谁更听得懂你的项目。',
      content: [
        '企业活动策划与执行不是套模板。',
        '年会、客户答谢、企业家庭日这类项目，看起来都叫“活动”，但背后的目标、参与对象、预算边界、现场要求，往往完全不同。',
        '有的项目重点在内部氛围和企业文化；\n有的重点在客户关系和品牌表达；\n有的重点在参与感、秩序感和不同人群的体验平衡。',
        '如果一家公司没有真正听懂你的需求，后面的方案再热闹，也可能从第一步就偏了。\n真正值得比较的，是谁先在理解你的项目，而不是急着展示自己做过什么。'
      ],
      observe: [
        '第一次沟通时，对方是急着推销自己的案例，还是在仔细询问你的项目背景、目标和顾虑？',
        '对方有没有问到一些你没考虑到，但对项目很关键的细节？',
        '沟通结束后，你觉得对方是真的懂了你的难点，还是只是走个过场？'
      ]
    },
    {
      id: 'judgment',
      navTitle: '判断力',
      title: '02｜看对方有没有判断力',
      subtitle: '会做方案不难，难的是在复杂条件下做出正确取舍。',
      content: [
        '活动从来不是一个只要想法够多就能做好的事情。',
        '真正有价值的，是在有限时间、有限预算和真实执行条件里，知道什么该做，什么不该做，什么必须先做。',
        '判断力不是把所有可能性都摆给你，而是能在很多可能性里看出重点。',
        '它意味着对方能快速识别：这场活动最重要的目标是什么，最值得投入的环节在哪里，哪些看起来高级但其实没有必要，哪些东西理论上能做、现实里却风险很高。'
      ],
      observe: [
        '对方会不会给你取舍，而不只是给你选项？',
        '对方会不会提醒你风险，而不是只讲理想状态？',
        '对方会不会根据你的现实条件（预算、时间）调整方案，而不是硬套大动作？'
      ]
    },
    {
      id: 'case-studies',
      navTitle: '看案例',
      title: '03｜案例很好看，但适合你吗？',
      subtitle: '漂亮的案例能证明它做过，但不一定能证明它适合你的项目。',
      content: [
        '看活动公司时，案例通常是第一眼最容易让人产生判断的东西。',
        '但这容易产生误判：你被一个看起来很强的案例吸引了，但这个案例能成立的前提，和你的项目可能根本不一样。',
        '活动不是拼谁做过更大的项目，而是拼谁更适合你当前这一个项目。',
        '一个团队做过大项目，不等于它更适合所有项目。大体量案例和中等预算项目，所需要的判断方式并不一样。'
      ],
      observe: [
        '这个案例的项目背景和你的活动类型接近吗？',
        '这个案例成立的预算和时间条件，和你现在的情况差得远不远？',
        '对方有没有说清它在这个项目里的关键判断，而不只是展示成片？'
      ]
    },
    {
      id: 'execution',
      navTitle: '执行力',
      title: '04｜为什么很多活动输在执行？',
      subtitle: '很多项目看起来是现场出了问题，真正的原因往往在更前面。',
      content: [
        '活动行业里，创意很容易被看见，执行却常常只在出问题的时候被看见。',
        '一个创意在 PPT 上成立，不代表它在现场就一定成立。活动要面对真实的时间线、真实的人、真实的场地、真实的突发情况。',
        '很多活动的失败，不是临场不够努力，而是前面埋了太多雷：流程没理顺、职责没分清、关键节点没压实。',
        '真正靠谱的执行，不是忙，而是有序；不是只会调资源，而是能把流程、时间、人员和风险一起管起来。'
      ],
      observe: [
        '对方讲执行时，是不是只讲资源，不讲流程？',
        '对方会不会提前讲风险和配合方式？',
        '对方有没有把现场之外的事情（内部协同、供应商接口、时间推进等）也想清楚？'
      ]
    }
  ];

  return (
    <main className="bg-white min-h-screen pt-32 pb-24">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-24">
        {/* Header */}
        <div className="mb-16 md:mb-24">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-gray-900 mb-6">怎么选活动公司</h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl">
            不是只看案例好不好看，而是看对方能不能听懂需求、判断清重点，并把项目稳稳落下来。
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 relative">
          {/* Sticky Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="sticky top-32">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">核心判断点</h3>
              <nav className="flex flex-col gap-4">
                {sections.map((section) => (
                  <a 
                    key={section.id}
                    href={`#${section.id}`}
                    className="text-gray-600 hover:text-[#ccff00] hover:font-bold transition-all text-lg"
                  >
                    {section.navTitle}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Sections */}
          <div className="flex-1 max-w-4xl">
            {sections.map((section, index) => (
              <motion.section 
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="mb-24 scroll-mt-32"
              >
                <div className="mb-8">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-4">{section.title}</h2>
                  <p className="text-xl text-gray-500 font-medium">{section.subtitle}</p>
                </div>
                
                <div className="prose prose-lg text-gray-700 mb-10">
                  {section.content.map((paragraph, pIndex) => (
                    <p key={pIndex} className="whitespace-pre-line leading-relaxed">{paragraph}</p>
                  ))}
                </div>

                <div className="bg-gray-50 p-8 border-l-4 border-[#ccff00]">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#ccff00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    沟通时重点观察：
                  </h4>
                  <ul className="space-y-3">
                    {section.observe.map((item, iIndex) => (
                      <li key={iIndex} className="flex gap-3 text-gray-700">
                        <span className="text-[#ccff00] font-bold mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.section>
            ))}

            {/* Articles Section */}
            <section className="mt-32 pt-16 border-t border-gray-200">
              <h2 className="text-3xl font-black tracking-tight text-gray-900 mb-12">深度阅读</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {articlesData.map(article => (
                  <Link 
                    key={article.id} 
                    to={`/how-to-choose/${article.id}`}
                    className="group block bg-gray-50 p-8 hover:bg-black hover:text-white transition-colors duration-300"
                  >
                    <h3 className="text-xl font-bold mb-4 group-hover:text-[#ccff00] transition-colors">{article.title}</h3>
                    <p className="text-gray-600 group-hover:text-gray-400 transition-colors line-clamp-2">{article.excerpt}</p>
                    <div className="mt-6 flex items-center text-sm font-bold uppercase tracking-wider text-gray-900 group-hover:text-white">
                      阅读全文 <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="mt-32 bg-black text-white p-12 text-center">
              <h2 className="text-3xl font-black mb-6">需要专业的活动建议？</h2>
              <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
                如果您正在筹备重要项目，或者在几家供应商之间犹豫，欢迎联系我们。我们先帮您理清需求和重点。
              </p>
              <Link 
                to="/contact"
                className="bg-[#ccff00] text-black px-8 py-4 font-bold text-lg hover:bg-white transition-colors inline-block"
              >
                获取专业建议
              </Link>
            </section>
          </div>
        </div>
      </div>

      <QRCodeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </main>
  );
}

function ArticlePage() {
  const { articleId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const article = articlesData.find(a => a.id === articleId);

  if (!article) {
    return (
      <div className="min-h-screen pt-32 px-6 text-center flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">文章不存在</h1>
        <button onClick={() => navigate(-1)} className="text-[#ccff00] hover:underline">返回上一页</button>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen pt-32 pb-24">
      <article className="max-w-3xl mx-auto px-6 md:px-12">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-black mb-12 flex items-center gap-2 transition-colors font-medium">
          &larr; 返回上一页
        </button>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 mb-8 leading-tight">{article.title}</h1>
        <div className="w-16 h-1 bg-[#ccff00] mb-12" />
        <div className="prose prose-lg md:prose-xl text-gray-700 max-w-none leading-relaxed prose-h3:text-2xl prose-h3:font-bold prose-h3:text-gray-900 prose-h3:mt-12 prose-h3:mb-6">
          <Markdown>{article.content}</Markdown>
        </div>
        
        {/* CTA section in article */}
        <div className="mt-20 pt-12 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gray-50 p-8 md:p-10 rounded-2xl">
          <div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">需要更专业的判断？</h4>
            <p className="text-gray-500">联系我们，听听我们在类似项目上的踩坑经验与解决思路。</p>
          </div>
          <Link to="/contact" className="px-6 py-3 bg-black text-[#ccff00] font-bold rounded-full hover:bg-gray-800 transition-colors whitespace-nowrap inline-block text-center">
            联系我们探讨项目
          </Link>
        </div>
        
        <QRCodeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </article>
    </main>
  );
}

function ChooseBetweenTwoPage() {
  const { pathname } = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const sections = [
    {
      id: 'understand-needs',
      navTitle: '理解需求',
      title: '01｜先比谁更理解你的需求',
      subtitle: '不是谁案例更大，而是谁更听得懂你的项目。',
      content: [
        '企业活动策划与执行不是套模板。',
        '年会、客户答谢、企业家庭日这类项目，看起来都叫“活动”，但背后的目标、参与对象、预算边界、现场要求，往往完全不同。',
        '有的项目重点在内部氛围和企业文化；\n有的重点在客户关系和品牌表达；\n有的重点在参与感、秩序感和不同人群的体验平衡。',
        '如果一家公司没有真正听懂你的需求，后面的方案再热闹，也可能从第一步就偏了。\n真正值得比较的，是谁先在理解你的项目，而不是急着展示自己做过什么。'
      ],
      observe: [
        '对方有没有先问清活动目标、参与对象、时间节点和预算范围。',
        '有没有认真听你的顾虑，而不是很快把话题带回自己的案例。',
        '有没有先帮你理需求，而不是先给你堆想法。'
      ]
    },
    {
      id: 'judgment',
      navTitle: '判断力',
      title: '02｜再比谁的判断更清楚',
      subtitle: '什么都答应，不代表更强，反而可能代表没有判断。',
      content: [
        '真正靠谱的活动公司，不会把所有项目都往“越热闹越好”“越复杂越高级”上推。',
        '它更应该告诉你：什么值得做，什么没必要做，什么看起来好看，但落地风险高，什么更适合你现在这个项目阶段。',
        '尤其在二选一的时候，最怕的不是对方有观点，而是对方没有取舍。\n没有判断的团队，前期让你觉得轻松，后期往往让你更被动。',
        '对企业客户来说，判断力的价值在于：\n它能帮你少走弯路，少花冤枉钱，也少把压力留到最后一天。'
      ],
      observe: [
        '对方会不会告诉你优先级，而不是只给很多选项。',
        '会不会提前提醒风险，而不是只讲理想效果。',
        '会不会根据你的现实条件调整方案，而不是直接套过去做过的模式。'
      ]
    },
    {
      id: 'cases',
      navTitle: '看案例',
      title: '03｜再比案例背后的逻辑，而不是表面大小',
      subtitle: '案例当然重要，但比“做过多大”更重要的，是“做得对不对、适不适合你”。',
      content: [
        '很多企业在二选一时，最容易被大案例吸引。\n但案例大，不一定说明更适合你的项目；\n案例漂亮，也不一定说明执行一定靠谱。',
        '你真正要看的，是这个案例背后的逻辑：\n\n这个项目当时为什么做；\n客户最在意什么；\n有没有预算和时间限制；\n推进过程中难点在哪；\n最后是怎么做成的。',
        '对你有参考价值的，不是几张成片照片，而是背后的判断过程。\n因为真正决定合作体验的，往往不是图，而是这个团队怎么理解问题、怎么安排重点、怎么把复杂事情做顺。'
      ],
      observe: [
        '案例里有没有讲清项目背景和限制条件。',
        '有没有说明为什么这么做，而不是只放结果图。',
        '有没有让你看出这个团队是怎么把项目做成的。'
      ]
    },
    {
      id: 'execution',
      navTitle: '看执行',
      title: '04｜最后比执行是不是真的稳',
      subtitle: '提案可以包装，执行很难伪装。',
      content: [
        '活动最后拼的，是流程、协同、节点控制、供应商配合、风险提醒和现场把控。\n真正稳的执行，不是现场救火能力强，而是前面少埋雷。',
        '很多人会把“现场反应快”当成优点，\n但对企业项目来说，真正值得信任的，不是出了问题后补得好，而是很多问题一开始就没让它发生。',
        '所以二选一的时候，最后一定要回到一个现实问题：\n\n这个团队，是让项目越来越稳，还是把压力都留到活动当天。'
      ],
      observe: [
        '对方讲执行时，是不是只讲资源，不讲流程。',
        '有没有把关键节点、分工方式、风险点和配合要求说清楚。',
        '有没有让你感觉项目会更省心，而不是更悬。'
      ]
    }
  ];

  const scenarios = [
    {
      id: 'scenario-1',
      title: '一家案例更大，一家更贴需求，该怎么选',
      content: [
        '先看你的项目更需要什么。',
        '如果你的项目重点是：\n时间紧、配合复杂、需求边界清楚、希望推进更顺，\n那“更贴需求”通常比“案例更大”更重要。',
        '因为大案例说明它做过复杂项目，\n但贴需求，才说明它真的更适合你这一次。',
        '很多企业最后合作体验更好的，不一定是案例最大的那家，\n而是最懂自己项目重点的那家。'
      ]
    },
    {
      id: 'scenario-2',
      title: '一家报价更高，一家报价更低，真正该比什么',
      content: [
        '不要只比总价，要比钱花在什么地方。',
        '真正该看的，是：\n\n关键环节有没有覆盖；\n报价结构清不清楚；\n有没有后续追加风险；\n预算是不是花在真正影响结果的位置上。',
        '便宜，不一定划算；\n贵，也不一定更值。',
        '真正值得比较的，是谁更清楚地告诉你：\n这笔预算会换来什么，重点放在哪里，结果能不能成立。'
      ]
    },
    {
      id: 'scenario-3',
      title: '一家创意更强，一家执行更稳，怎么判断更适合你',
      content: [
        '先判断你的项目更怕什么。',
        '怕平庸，还是怕失控。\n如果你的项目是关键节点，需要场面感、记忆点和更强表达，那创意的权重会更高。\n如果你的项目更在意顺利推进、现场稳定、协同复杂度低，那执行稳定性通常更重要。',
        '对很多企业活动来说，创意是加分项，执行稳定性是底盘。\n没有底盘，再强的创意也很难真正成立。'
      ]
    },
    {
      id: 'scenario-4',
      title: '一家沟通更顺，一家履历更强，怎么决定',
      content: [
        '沟通顺，不是软指标，而是项目能不能顺利推进的基础条件。',
        '履历强当然重要，但如果沟通始终不在一个频道，\n需求容易被误解，推进容易反复，项目也会越来越累。',
        '尤其在企业活动项目里，沟通顺意味着：\n需求理解更准、配合效率更高、调整成本更低。',
        '所以二选一时，履历是参考，真实配合感同样重要。\n很多项目最后输的，不是能力，而是沟通不顺。'
      ]
    }
  ];

  const checklist = [
    '谁更理解这次活动真正想解决什么问题',
    '谁更能说清楚项目重点、边界和优先级',
    '谁的案例更有参考价值，而不是只看起来好看',
    '谁讲执行时更具体、更稳',
    '谁对风险提醒更到位',
    '谁的沟通方式更顺',
    '谁的报价结构更清楚',
    '谁更适合你这一次项目，而不是看起来更厉害'
  ];

  return (
    <main className="bg-white min-h-screen pt-24">
      {/* Banner */}
      <section className="bg-[#f4f4f4] py-20 px-6 md:px-12 lg:px-24 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-gray-900 mb-8">二选一怎么选</h1>
          <p className="text-xl md:text-2xl text-gray-600 leading-relaxed font-medium">
            当两家活动公司都看起来不错时，真正该比较的，不只是案例大小、报价高低和提案气势，而是谁更理解需求、判断更清楚、执行更稳。
          </p>
        </div>
      </section>

      {/* Sticky Nav */}
      <div className="sticky top-20 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 flex justify-between md:justify-start md:gap-12 overflow-x-auto hide-scrollbar">
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="py-4 text-sm font-bold text-gray-500 hover:text-black whitespace-nowrap transition-colors">
              {s.navTitle}
            </a>
          ))}
          <a href="#scenarios" className="py-4 text-sm font-bold text-gray-500 hover:text-black whitespace-nowrap transition-colors">常见情境</a>
          <a href="#checklist" className="py-4 text-sm font-bold text-gray-500 hover:text-black whitespace-nowrap transition-colors">比较框架</a>
        </div>
      </div>

      {/* Content */}
      <section className="py-16 px-6 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto">
          {/* Intro */}
          <div className="prose prose-lg md:prose-xl text-gray-700 mb-20 max-w-none">
            <p className="mb-6 whitespace-pre-line">
              很多企业第一次筛选活动公司，最容易卡在这一步：
              
              一家公司案例更大，看起来更有气势；
              另一家公司更懂你的需求，沟通也更顺。
              一家公司报价更高，感觉更“稳”；
              另一家公司报价更合适，但你又担心现场能不能撑住。
            </p>
            <p className="mb-6">真正让人难选的，从来不是“谁更会说”，而是“谁更适合这一次项目”。</p>
            <p className="mb-6 whitespace-pre-line">
              因为活动这件事，最后拼的不是谁把提案做得更满，也不是谁把案例讲得更漂亮。
              它更考验的是：需求有没有被真正听懂，方向有没有被判断清楚，方案能不能成立，现场能不能稳稳落下来。
            </p>
            <p className="font-bold text-black text-2xl mt-12">所以二选一时，比继续听更多话术更重要的，是先把比较标准定清楚。</p>
          </div>

          {/* Modules */}
          <div className="space-y-24">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-black inline-block relative">
                二选一，先比这四件事
                <div className="absolute -bottom-4 left-0 w-full h-1 bg-[#ccff00]"></div>
              </h2>
            </div>
            
            {sections.map((section) => (
              <div key={section.id} id={section.id} className="scroll-mt-32">
                <h3 className="text-3xl md:text-4xl font-black text-black mb-4">{section.title}</h3>
                <p className="text-xl font-bold text-gray-900 mb-8">{section.subtitle}</p>
                <div className="space-y-6 text-lg text-gray-700 leading-relaxed mb-10">
                  {section.content.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">{p}</p>
                  ))}
                </div>
                
                {/* Observe Box */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 md:p-10">
                  <h4 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#ccff00] rounded-full"></span>
                    这一部分你可以重点看
                  </h4>
                  <ul className="space-y-4">
                    {section.observe.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-lg font-medium text-gray-900">
                        <CheckCircle2 className="w-6 h-6 text-[#ccff00] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Transition Summary */}
          <div className="mt-24 pt-16 border-t border-gray-200 prose prose-lg md:prose-xl text-gray-700 max-w-none">
            <p className="mb-6 whitespace-pre-line">
              说到底，二选一不是选“谁更厉害”，
              而是选“谁更适合这一次”。
            </p>
            <p className="mb-6 whitespace-pre-line">
              案例大小、方案包装、报价高低都可以参考，
              但都不该成为唯一标准。
            </p>
            <p className="mb-6 whitespace-pre-line">
              真正值得比较的，是：
              
              谁更理解你的需求；
              谁的判断更清楚；
              谁的案例更有参考价值；
              谁的执行更稳。
            </p>
            <p className="font-bold text-black text-2xl">项目越重要，越不能只看表面。</p>
          </div>

          {/* Scenarios */}
          <div id="scenarios" className="mt-32 scroll-mt-32">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-black inline-block relative">
                最常见的四种二选一情境
                <div className="absolute -bottom-4 left-0 w-full h-1 bg-[#ccff00]"></div>
              </h2>
            </div>
            
            <div className="space-y-12">
              {scenarios.map((scenario, index) => (
                <div key={scenario.id} className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 hover:shadow-xl transition-shadow">
                  <h3 className="text-2xl md:text-3xl font-bold text-black mb-6">
                    <span className="text-gray-400 mr-4 font-black">情境 {['一', '二', '三', '四'][index]}</span>
                    <br className="md:hidden" />
                    {scenario.title}
                  </h3>
                  <div className="space-y-4 text-lg text-gray-700 leading-relaxed">
                    {scenario.content.map((p, i) => (
                      <p key={i} className="whitespace-pre-line">{p}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div id="checklist" className="mt-32 scroll-mt-32">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-black inline-block relative">
                拿不准时，可以先按这张表去比
                <div className="absolute -bottom-4 left-0 w-full h-1 bg-[#ccff00]"></div>
              </h2>
            </div>
            
            <div className="prose prose-lg md:prose-xl text-gray-700 max-w-none mb-10">
              <p>你不一定需要一开始就判断“谁更强”。<br/>更有用的做法，是先按下面这几个问题去比：</p>
            </div>
            
            <div className="bg-gray-900 text-white rounded-2xl p-8 md:p-12">
              <ul className="space-y-6">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-lg md:text-xl font-medium">
                    <div className="w-8 h-8 rounded-full bg-[#ccff00] text-black flex items-center justify-center shrink-0 font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <span className="pt-1">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-12 pt-8 border-t border-gray-800 text-center">
                <p className="text-2xl font-bold text-[#ccff00]">别急着问谁更强，先问谁更适合这一次。</p>
              </div>
            </div>
          </div>

          {/* Why NEED wrote this page */}
          <div className="mt-32 pt-16 border-t border-gray-200">
            <h2 className="text-3xl md:text-4xl font-black text-black mb-8">NEED 为什么把这页写出来</h2>
            <div className="prose prose-lg md:prose-xl text-gray-700 max-w-none space-y-6">
              <p>对企业客户来说，选活动公司往往不是没信息，而是信息太多、标准太乱。案例可以看，方案可以听，报价可以比，但如果比较标准本身错了，最后的选择也容易偏。</p>
              <p>NEED 更习惯先把需求理清，再判断方向，再推进落地。所以我们也愿意把这套比较逻辑公开写出来，方便客户在正式合作前，先把问题看清楚，少走弯路。</p>
              <p className="font-bold text-black">我们相信，真正值得被看见的，不只是做过什么，而是为什么这么做、怎么把它做成，以及最后的结果是不是到位。</p>
            </div>
          </div>
          
          {/* Articles Section */}
          <div className="mt-24 pt-16 border-t border-gray-200">
            <h3 className="text-2xl md:text-3xl font-black text-black mb-8">深度阅读</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {chooseBetweenTwoArticlesData.map(article => (
                <Link key={article.id} to={`/choose-between-two/${article.id}`} className="block p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100">
                  <h4 className="text-xl font-bold text-gray-900 mb-3">{article.title}</h4>
                  <p className="text-gray-500 line-clamp-2">{article.excerpt}</p>
                  <div className="mt-6 text-sm font-bold text-black flex items-center gap-2">
                    阅读全文 &rarr;
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-black text-white py-24 px-6 md:px-12 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black mb-8">如果你现在正卡在两家之间，可以先把差异点聊清楚</h2>
          <p className="text-xl text-gray-400 mb-12 leading-relaxed">
            如果你已经拿到两份方案、两份报价，或者正在两家团队之间犹豫，也可以先把你最拿不准的地方发过来。<br/>
            先把比较标准看清楚，再决定怎么选，通常比继续反复犹豫更有效。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/contact" className="w-full sm:w-auto px-8 py-4 bg-[#ccff00] text-black font-bold text-lg rounded-full hover:bg-[#b3e600] transition-colors inline-block text-center">
              先聊项目判断
            </Link>
            <Link to="/contact" className="w-full sm:w-auto px-8 py-4 bg-white/10 text-white font-bold text-lg rounded-full hover:bg-white/20 transition-colors backdrop-blur-sm inline-block text-center">
              发需求资料
            </Link>
          </div>
        </div>
      </section>

      <QRCodeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </main>
  );
}


function ChooseArticlePage() {
  const { articleId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const article = chooseBetweenTwoArticlesData.find(a => a.id === articleId);

  if (!article) {
    return (
      <div className="min-h-screen pt-32 px-6 text-center flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">文章不存在</h1>
        <button onClick={() => navigate(-1)} className="text-[#ccff00] hover:underline">返回上一页</button>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen pt-32 pb-24">
      <article className="max-w-3xl mx-auto px-6 md:px-12">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-black mb-12 flex items-center gap-2 transition-colors font-medium">
          &larr; 返回上一页
        </button>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 mb-8 leading-tight">{article.title}</h1>
        <div className="w-16 h-1 bg-[#ccff00] mb-12" />
        <div className="prose prose-lg md:prose-xl text-gray-700 max-w-none leading-relaxed prose-h3:text-2xl prose-h3:font-bold prose-h3:text-gray-900 prose-h3:mt-12 prose-h3:mb-6">
          <Markdown>{article.content}</Markdown>
        </div>
        
        {/* CTA section in article */}
        <div className="mt-20 pt-12 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gray-50 p-8 md:p-10 rounded-2xl">
          <div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">需要更专业的判断？</h4>
            <p className="text-gray-500">联系我们，听听我们在类似项目上的踩坑经验与解决思路。</p>
          </div>
          <Link to="/contact" className="px-6 py-3 bg-black text-[#ccff00] font-bold rounded-full hover:bg-gray-800 transition-colors whitespace-nowrap inline-block text-center">
            联系我们探讨项目
          </Link>
        </div>
        
        <QRCodeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </article>
    </main>
  );
}

function QRCodeModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      navigate('/contact');
      onClose();
    }
  }, [isOpen, navigate, onClose]);

  return null;
}




function SolutionsPage() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const solutionsList = [
    { title: '企业家庭日/开放日', desc: '传递企业温度，增强员工归属与家属认同', id: 'family-day' },
    { title: '客户答谢&精品沙龙', desc: '深度互动，建立高净值客户长期信任', id: 'salon' },
    { title: '年会活动与企业文化', desc: '不只是热闹，更是企业向心力的凝聚场', id: 'annual' },
    { title: '商业美陈与展览', desc: '空间即媒介，构建品牌核心视觉体验', id: 'exhibition' },
    { title: '视频与数字资产', desc: '长效复用，沉淀活动背后的核心价值', id: 'video' },
    { title: '学术与专业论坛', desc: '汇聚行业智慧，打造高规格思想交锋平台', id: 'forum' },
    { title: '其他', desc: '灵活定制，满足更多元、更复杂的特殊场景需求', id: 'other' },
  ];

  return (
    <div className="min-h-screen bg-white pt-32 pb-32">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <header className="mb-20 md:mb-28 relative">
          <div className="absolute -top-10 -left-10 w-48 h-48 bg-[#ccff00] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse pointer-events-none" />
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-black mb-8 relative z-10">
            场景方案<span className="text-[#ccff00]">.</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-500 max-w-3xl leading-relaxed font-light relative z-10">
            不同活动场景，对应不同业务目标。我们提供针对性的标准动作与关键判断，帮你在预算内拿到最确定的结果。
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {solutionsList.map((solution, idx) => (
            <Link 
              key={idx} 
              to={`/solutions/${solution.id}`}
              className={`group relative overflow-hidden bg-[#f4f4f5] rounded-3xl p-10 md:p-12 transition-all duration-500 hover:bg-[#ccff00] hover:shadow-2xl hover:-translate-y-1 flex flex-col justify-between min-h-[360px] ${idx === 0 || idx === 6 ? 'md:col-span-2 lg:col-span-2' : ''}`}
            >
              <div className="relative z-10">
                <div className="text-gray-400 font-mono text-xl mb-6 group-hover:text-black/50 transition-colors">
                  0{idx + 1}
                </div>
                <h3 className={`font-black tracking-tight mb-4 text-black transition-colors ${idx === 0 || idx === 6 ? 'text-4xl md:text-5xl lg:text-6xl max-w-2xl' : 'text-3xl'}`}>
                  {solution.title}
                </h3>
                <p className={`text-gray-600 group-hover:text-black/80 transition-colors leading-relaxed xl:pr-12 ${idx === 0 || idx === 6 ? 'text-xl max-w-xl lg:mt-6' : 'text-base lg:text-lg'}`}>
                  {solution.desc}
                </p>
              </div>
              
              <div className="relative z-10 mt-12 flex items-end justify-between">
                <span className="inline-block opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 delay-100 font-bold text-black border-b-2 border-transparent group-hover:border-black pb-1">
                  查看案例解析
                </span>
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center group-hover:bg-black group-hover:text-[#ccff00] transition-colors duration-300 shadow-sm shrink-0">
                  <ArrowRight className="w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Solutions Articles Data ---
export const solutionsData = [
  {
    id: 'family-day',
    title: '企业家庭日/开放日',
    subtitle: '传递企业温度，增强员工归属与家属认同',
    content: `### 核心价值
企业家庭日不仅是一场员工福利活动，更是企业文化软实力的具象化体现。通过邀请家属走进企业，打破工作与生活的边界，建立更深层次的情感链接。

### 痛点与挑战
* **众口难调**：参与者跨越不同年龄段（老人、员工、儿童），如何平衡不同人群的体验需求？
* **安全管控**：大量儿童与家属进入办公或活动区域，现场安全与动线规划是极大的考验。
* **文化传递**：如何不生硬地说教，让家属自发感受到企业的价值观与发展愿景？

### NEED 的解决方案
1. **模块化人群动线设计**
   针对不同人群设定专属体验区（例如：能量释放区-儿童游乐；手作体验区-老人/亲子；科技展示区-家属游览）。通过护照打卡机制，引导人群有序流动，避免局部拥堵。
2. **极度细致的安全与保障**
   从医疗点设置、儿童防波及保护、特殊餐饮安排（低敏、软食），到多层级的安保人员分布，提供不仅无忧，而且有温度的现场保障。
3. **润物无声的文化植入**
   将企业里程碑、核心产品线转化为互动闯关游戏或现场装置艺术，让家属在“玩”的过程中，产生对员工工作的理解与自豪。`
  },
  {
    id: 'salon',
    title: '客户答谢&精品沙龙',
    subtitle: '深度互动，建立高净值客户长期信任',
    content: `### 核心价值
针对高净值客户或核心渠道商的答谢与沙龙，重点不在于规模，而在于“尊贵感”与“价值交流”。它是提升客户粘性、促成深度合作的关键触点。

### 痛点与挑战
* **同质化严重**：客户参加过无数精美晚宴，容易产生审美疲劳，难以留下深刻印象。
* **社交有效性**：如何打破破冰期的尴尬，促成宾客之间、宾客与企业高管之间的高质量交流？
* **细节容错率低**：任何一个服务细节的瑕疵，都会被无限放大，损害品牌高端形象。

### NEED 的解决方案
1. **非标体验的构建**
   摒弃传统的标准五星级酒店宴会厅，寻找具有稀缺性的非标场地（如私人美术馆、历史建筑、隐秘的自然酒庄），从邀请函的材质到入场方式，制造不可复制的专属感。
2. **情绪价值与高质社交**
   以特定主题（如艺术品鉴、闭门行业前瞻、定制晚宴）为核心，设置破冰环节与座位艺术。我们关注每一位VIP的个性化喜好，从伴手礼到座次卡，体现极致用心。
3. **隐形服务体系**
   服务人员与流程进度高度配合，做到“需要时就在身边，不需要时隐形”的高级服务边界感，确保整场沙龙的松弛感与私密性。`
  },
  {
    id: 'annual',
    title: '年会活动与企业文化',
    subtitle: '不只是热闹，更是企业向心力的凝聚场',
    content: `### 核心价值
年会是企业一年一度最重要的内部盛会，它承载着总结过往、表彰先进、提振士气以及宣贯新年战略的复合功能。

### 痛点与挑战
* **流程冗长乏味**：长篇幅的领导讲话和千篇一律的表彰，导致员工参与感低下。
* **众口难调的娱乐**：简单的抽奖和员工才艺表演往往缺乏创意，难以引起全员共鸣。
* **核心信息的传达**：如何通过一场晚会，把深奥的企业战略转化为大家听得懂、愿意听的语言？

### NEED 的解决方案
1. **叙事化的核心概念提取**
   根据企业面临的市场环境与内部现状，提取一个核心关键词作为贯穿全场的“主题骨架”。所有的舞美、串词、节目都在讲述这同一个故事。
2. **高燃情绪流设计**
   用做演唱会的思维做年会。精准控制现场情绪曲线，从开场的震撼、表彰的感动，到战略发布的高潮、大合唱的共鸣，让员工沉浸体验。
3. **去中心化与全员共创**
   打破台上台下的绝对界限。利用数字互动、弹幕上墙、悬念式抽奖以及高管打破常规的反串表现，让员工从“观众”变为实实在在的“参与者”。`
  },
  {
    id: 'exhibition',
    title: '商业美陈与展览',
    subtitle: '空间即媒介，构建品牌核心视觉体验',
    content: `### 核心价值
在碎片化时代，线下的真实空间体验是最具冲击力的品牌沟通语言。美陈与展览不仅是吸引流量的工具，更是品牌质感的外延。

### 痛点与挑战
* **重投入轻产出**：好看却不带量，消费者拍完照就走，没有形成品牌认知和转化动作。
* **材质与工艺落差**：设计图唯美，落地却因为材质缩水、施工粗糙显得廉价。
* **生命周期短**：布展成本高昂，但展出时间短或复用率低，导致ROI极低。

### NEED 的解决方案
1. **视觉穿透与互动转化**
   不只做静态展示，更关注动线设计与受众交互。将品牌卖点隐藏在有趣的互动装置、打卡机制中，缩短从“路人”到“粉丝”的距离。
2. **材质级的一比一还原**
   从策划阶段就深入对接工艺与材质，严格把控灯光色温、烤漆工艺、特殊材质的表现力，确保渲染图的100%无损落地。
3. **模块化与可持续思考**
   在搭建之初就考虑构件的拆解与多场景复用。通过模块化的特装设计，降低企业在不同城市的巡展成本。`
  },
  {
    id: 'video',
    title: '视频与数字资产',
    subtitle: '长效复用，沉淀活动背后的核心价值',
    content: `### 核心价值
一场百万级的活动，如果不通过影像记录，它的影响力将随着离场而消散。视频与数字资产是企业传播的长尾引擎。

### 痛点与挑战
* **千篇一律的快剪**：总是大同小异的握手、举杯、全景收尾，没有观点和记忆点。
* **拍摄抓不到核心**：摄影师不了解企业战略，错过极其重要的历史瞬间和高管神态。
* **分发效率低**：长视频无法适应短视频时代的传播需求。

### NEED 的解决方案
1. **带着剧本去现场**
   我们在活动筹备期就已经策划好视频的大纲。明确需要采集的核心观点、情绪镜头与特写，将不可复制的感动瞬间精准捕获。
2. **故事化剪辑**
   抛弃“流水账式”记录。以企业精神或特定主题为核心，为影像注入灵魂。无论是品牌微电影、After Movie还是高管访谈，都如同院线级短片一样具有感染力。
3. **多模态内容交付**
   针对不同的传播分发渠道，提供从90秒快闪版、15秒朋友圈传播短片，到现场精修图片九宫格的全套数字内容资产箱。`
  },
  {
    id: 'forum',
    title: '学术与专业论坛',
    subtitle: '汇聚行业智慧，打造高规格思想交锋平台',
    content: `### 核心价值
无论是医学峰会、科技论坛还是行业趋势发布，高规格的专业论坛是奠定企业行业话语权、展现专业深度的绝对核心现场。

### 痛点与挑战
* **学术内容的干瘪与沉闷**：漫长的PPT演讲容易让听众疲劳，信息的传递效率断崖式下跌。
* **嘉宾接待的微小纰漏**：顶级专家时间稀缺、要求严苛。接送机、酒店入住、上台前准备等环节一旦疏忽，极易造成不满。
* **版权与保密风险**：未公开学术成果的防泄密、直播的安全性保障挑战大。

### NEED 的解决方案
1. **VIP极致尊享前置服务**
   从接到名单那一刻起，建立1对1嘉宾服务小组。将讲者从繁琐的差旅行程、打车报销、PPT格式切换中完全解放出来，确保以最佳状态走上舞台。
2. **知识可视化的降维传达**
   利用高级别屏显系统、三维动效或裸眼3D技术，协助讲者将枯燥的专业术语转化为生动直观的视觉语言。
3. **毫秒级控场与安全隔离**
   建立极度严谨的流程控制（Run-down）。包括专线网络保障、闭门会区域管控、定向防摄屏机制等，护航知识的前沿交流。`
  },
  {
    id: 'other',
    title: '其他特殊场景需求',
    subtitle: '灵活定制，满足更多元、更复杂的特殊场景需求',
    content: `### 突破常规，拥抱未知

企业的需求永远是在不断进化和变体中的。不论是出海峰会、大型厂矿奠基、极寒环境下的产品测试发布，还是与品牌调性深度绑定的跨界大秀。

### 我们为什么能做？
* **超越经验的底层逻辑**：所有的复杂项目，最终都可以拆解为资源统筹、空间美学、流程控制与风险规避四大底层模块。我们拥有强大的模块组装能力。
* **对确定性的极致追求**：我们在未知环境中最擅长做的一件事，就是列出所有“可能搞砸”的清单，然后逐一准备预案。
* **全球化与跨界供应商生态**：无论是调动国外的制作团队，还是跨界整合先锋艺术家资源，我们都有能力将其无缝接入你的项目体系。

无论你的需求多么“奇葩”或困难，随时抛给我们，我们帮你拆解第一步该怎么走。`
  }
];

const projectsData = [
  {
    id: "festo-2025",
    title: "费斯托 2025 家庭日",
    slogan: "费跃百年，趣超超越",
    shortIntro: "以“费跃百年，趣超超越”为核心，通过星球主题装置与数字化互动，传递百年企业温度，建立高净值客户长期信任。",
    gallery: [
      "photo.jpg", "photo-2.jpg", "photo-3.jpg", 
      "photo-4.jpg", "photo-5.jpg", "photo-6.jpg", "photo-7.jpg"
    ]
  },
  {
    // 这是预留的第二个案例框架，请在 UI 渲染时一并处理以展示多案例排版效果
    id: "case-template-02",
    title: "NEED 预留演示案例 02",
    slogan: "科技与人文的数字碰撞",
    shortIntro: "这是一个预留的案例展示位。后续将通过后台直接推流替换。核心展示多项目在同一页面的视觉节奏感。",
    gallery: [
      "placeholder-1.jpg", "placeholder-2.jpg", "placeholder-3.jpg", "placeholder-4.jpg"
    ]
  }
];

function FamilyDayPage() {
  const { pathname } = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
       <div className="pt-32 px-6 md:px-12 lg:px-24 border-b border-white/5 pb-10">
          <button onClick={() => window.history.back()} className="inline-flex items-center text-sm font-bold tracking-widest uppercase text-gray-500 hover:text-[#ccff00] transition-colors w-fit group">
            <ArrowRight className="w-4 h-4 mr-3 rotate-180 group-hover:-translate-x-1 transition-transform" /> 返回上一页
          </button>
       </div>
       
       <div className="max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-32 flex flex-col">
          {projectsData.map((project, index) => (
             <section key={project.id} className="mb-[120px] last:mb-0 relative">
                {/* 文本区 */}
                <div className="mb-12 max-w-4xl">
                   <h2 className="text-sm font-mono tracking-widest text-[#ccff00] mb-4 uppercase flex items-center gap-4">
                     <span className="w-8 h-[1px] bg-[#ccff00]/50" />
                     {project.slogan}
                   </h2>
                   <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-br from-white via-gray-100 to-gray-600">
                     {project.title}
                   </h1>
                   <p className="text-xl text-gray-400 font-light leading-relaxed line-clamp-3">
                     {project.shortIntro}
                   </p>
                </div>

                {/* 图片区 */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6">
                  {project.gallery.map((img, i) => {
                    let colSpanClass = "col-span-1 md:col-span-2";
                    let aspectClass = "aspect-[4/3]";
                    
                    if (i === 0) {
                      colSpanClass = "col-span-1 md:col-span-6";
                      aspectClass = "aspect-[21/9] md:aspect-[21/8]";
                    } else if (i === 1 || i === 2) {
                      colSpanClass = "col-span-1 md:col-span-3";
                      aspectClass = "aspect-[4/3] md:aspect-[16/10]";
                    } else if (i >= 3 && i <= 5) {
                      colSpanClass = "col-span-1 md:col-span-2";
                      aspectClass = "aspect-[4/3]";
                    }

                    return (
                      <div key={i} className={`${colSpanClass} overflow-hidden rounded-3xl group border border-white/5 bg-white/5 relative ${aspectClass}`}>
                         <div className="absolute inset-0 border border-[#ccff00]/0 group-hover:border-[#ccff00]/30 transition-colors z-20 rounded-3xl pointer-events-none" />
                         <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10 duration-700 pointer-events-none" />
                         <img loading="lazy" src={img.startsWith('image_') ? `/${img}` : `https://images.unsplash.com/photo-${1500000000000 + i}?q=80&w=800&auto=format&fit=crop`} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.02]" alt={project.title} />
                      </div>
                    );
                  })}
                </div>
                
                {/* 分割线 */}
                {index < projectsData.length - 1 && (
                  <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-[120px]" />
                )}
             </section>
          ))}
       </div>
       
       {/* CTA section in Family Day */}
       <div className="max-w-7xl mx-auto px-6 md:px-12 pb-32">
         <div className="border-t border-white/10 pt-12 flex flex-col sm:flex-row items-center justify-between gap-6 bg-white/5 p-8 md:p-10 rounded-2xl">
           <div>
             <h4 className="text-xl font-bold text-white mb-2">需要更详细的案例文件？</h4>
             <p className="text-gray-400">联系我们，获取本场景的过往完整案例及执行策略表。</p>
           </div>
           <Link to="/contact" className="px-6 py-3 bg-[#ccff00] text-black font-bold rounded-full hover:bg-white transition-colors whitespace-nowrap inline-block text-center">
             联系我们探讨项目
           </Link>
         </div>
       </div>
       
       <QRCodeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

function SolutionArticlePage() {
  const { articleId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (articleId === 'family-day') {
    return <FamilyDayPage />;
  }

  const article = solutionsData.find(a => a.id === articleId);

  if (!article) {
    return (
      <div className="min-h-screen pt-32 px-6 text-center flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">案例解析不存在</h1>
        <button onClick={() => navigate(-1)} className="text-[#ccff00] hover:underline">返回上一页</button>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen pt-32 pb-24">
      <article className="max-w-3xl mx-auto px-6 md:px-12">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-black mb-12 flex items-center gap-2 transition-colors font-medium">
          &larr; 返回上一页
        </button>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 mb-6 leading-tight">
          {article.title}
        </h1>
        <p className="text-xl text-gray-500 mb-8 font-medium">{article.subtitle}</p>
        <div className="w-16 h-1 bg-[#ccff00] mb-12" />
        <div className="prose prose-lg md:prose-xl text-gray-700 max-w-none leading-relaxed prose-h3:text-2xl prose-h3:font-bold prose-h3:text-gray-900 prose-h3:mt-12 prose-h3:mb-6 prose-li:marker:text-[#ccff00]">
          <Markdown>{article.content}</Markdown>
        </div>
        
        {/* CTA section in article */}
        <div className="mt-20 pt-12 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gray-50 p-8 md:p-10 rounded-2xl">
          <div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">需要更详细的案例文件？</h4>
            <p className="text-gray-500">联系我们，获取本场景的过往完整案例及执行策略表。</p>
          </div>
          <Link to="/contact" className="px-6 py-3 bg-black text-[#ccff00] font-bold rounded-full hover:bg-gray-800 transition-colors whitespace-nowrap inline-block text-center">
            联系我们探讨项目
          </Link>
        </div>
        
        <QRCodeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </article>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="min-h-screen bg-white text-black pt-32 px-6 flex items-center justify-center">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">页面不存在</h1>
        <p className="text-lg md:text-xl text-gray-500 mb-10">这可能是链接已调整，或页面正在整理中。</p>
        <Link to="/" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-black text-white font-bold hover:bg-gray-800 transition-colors">
          返回首页
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    if (splashVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [splashVisible]);

  return (
    <Router>
      <ScrollToHash />
      <div className="font-sans antialiased text-gray-900 bg-white min-h-screen flex flex-col">
        <AnimatePresence>
          {splashVisible && (
            <Splash onComplete={() => setSplashVisible(false)} />
          )}
        </AnimatePresence>

        {!splashVisible && <Navbar />}

        <Routes>
          <Route path="/contact" element={<ContactAndAssetsPage />} />
          <Route path="/solutions" element={<SolutionsPage />} />
          <Route path="/solutions/:articleId" element={<SolutionArticlePage />} />
          <Route path="/" element={<Home />} />
          <Route path="/how-to-choose" element={<HowToChoosePage />} />
          <Route path="/choose-between-two" element={<ChooseBetweenTwoPage />} />
          <Route path="/choose-between-two/:articleId" element={<ChooseArticlePage />} />
          <Route path="/how-to-choose/:articleId" element={<ArticlePage />} />
          <Route path="/cases/:id" element={<CaseStudyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </Router>
  );
}
