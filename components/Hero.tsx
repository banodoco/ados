'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { VideoModal } from '@/components/VideoModal'
import { InfoTooltip } from '@/components/InfoTooltip'
import { VibeToggle } from '@/components/VibeToggle'
import { motion, AnimatePresence } from 'framer-motion'
import { Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function Hero() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [vibe, setVibe] = useState<'chill' | 'epic'>('chill')
  const [isGlitching, setIsGlitching] = useState(false)
  const [rotationDirection, setRotationDirection] = useState<'left' | 'right'>('left')
  const videoRef = useRef<HTMLVideoElement>(null)
  const preloadVideoRef = useRef<HTMLVideoElement>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const [inviteName, setInviteName] = useState<string | null>(null)
  const [showInviteButton, setShowInviteButton] = useState(false)
  const [invalidInvite, setInvalidInvite] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Prefetch event page as soon as Hero loads for instant navigation
  useEffect(() => {
    router.prefetch('/events/ados-2025')
    router.prefetch('/events/ados-2025/apply')
  }, [router])

  // Handle loading state - wait for video to be ready
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800) // Minimum loading time for smooth experience

    return () => clearTimeout(timer)
  }, [])

  const handleVibeChange = (newVibe: 'chill' | 'epic') => {
    if (newVibe === vibe) return
    
    // Store current video time
    const currentTime = videoRef.current?.currentTime || 0
    
    // Set rotation direction: right for epic, left for chill
    setRotationDirection(newVibe === 'epic' ? 'right' : 'left')
    
    setIsGlitching(true)
    setTimeout(() => {
      setVibe(newVibe)
      // Restore video time after source change
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime
      }
    }, 400) // Change content mid-glitch
    setTimeout(() => {
      setIsGlitching(false)
    }, 800) // End glitch - longer to ensure completion
  }

  // Check if user is admin and application status, but after a short delay
  // to prioritize initial render and prefetching.
  useEffect(() => {
    const timer = setTimeout(() => {
      async function checkUserStatus() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          if (profile?.role === 'admin') {
            setIsAdmin(true)
          }

          // Check if user has applied to the main event (ados-2025)
          const { data: events } = await supabase
            .from('events')
            .select('id')
            .eq('slug', 'ados-2025')
            .single()

          if (events) {
            const { data: attendance } = await supabase
              .from('attendance')
              .select('status')
              .eq('user_id', user.id)
              .eq('event_id', events.id)
              .single()

            if (attendance) {
              setApplicationStatus(attendance.status)
            }
          }
        }
      }
      checkUserStatus()
    }, 1000) // 1-second delay

    return () => clearTimeout(timer)
  }, [supabase])

  // Fetch invite name from database, but after a short delay.
  useEffect(() => {
    const timer = setTimeout(() => {
      const inviteCode = searchParams.get('invite')
      if (inviteCode) {
        async function fetchInvite() {
          // Small delay to make the animation more noticeable is fine here
          await new Promise(resolve => setTimeout(resolve, 500))
          
          const { data, error } = await supabase
            .from('invites')
            .select('*')
            .eq('code', inviteCode)
            .single()
          
          if (!error && data) {
            // Check if invite has uses left
            if (data.used_count < data.max_uses) {
              setInviteName(data.name)
              // Persist to localStorage
              localStorage.setItem('invite_code', JSON.stringify({
                code: inviteCode,
                name: data.name
              }))
              // Delay showing the button change until after name animation completes
              setTimeout(() => {
                setShowInviteButton(true)
              }, 1200) // Wait for name animation to complete
            } else {
              // Invite is used up
              setInvalidInvite(true)
            }
          } else {
            // Invalid invite code
            setInvalidInvite(true)
          }
        }
        fetchInvite()
      }
    }, 1000) // 1-second delay

    return () => clearTimeout(timer)
  }, [searchParams, supabase])

  // Update video source when vibe changes
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current
      const currentTime = video.currentTime
      const wasPlaying = !video.paused
      
      video.poster = vibe === 'epic' ? '/epic-hero-poster.jpg' : '/chill-hero-poster.jpg'
      video.src = vibe === 'epic' ? '/epic-hero.mp4' : '/chill-hero.mp4'
      video.load()
      
      const handleCanPlay = () => {
        video.currentTime = currentTime
        if (wasPlaying) {
          video.play().catch(() => {})
        }
      }
      
      video.addEventListener('canplay', handleCanPlay, { once: true })
      
      // Update preload video to load the opposite video
      if (preloadVideoRef.current) {
        preloadVideoRef.current.src = vibe === 'epic' ? '/chill-hero.mp4' : '/epic-hero.mp4'
        preloadVideoRef.current.load()
      }
      
      return () => {
        video.removeEventListener('canplay', handleCanPlay)
      }
    }
  }, [vibe])

  const getCtaText = () => {
    return "Next event coming soon"
  }

  const content = {
    chill: {
      subtitle: 'A celebration of art and open source AI',
      date: 'Los Angeles | November 7th',
      cta: getCtaText(),
      watchTrailer: 'Watch the Trailer',
      whatIsIt: (<>This will be a day-long event with a day-time and evening portion:{'\n\n'}- Day-time: panels, roundtables, hangouts{'\n'}- Evening: show, drinks, frivolities{'\n\n'}Thanks to our friends at Asteria, we'll host at the legendary Mack Sennett studio.</>),
      whoIsItFor: (<>We hope to bring together a mix of people who are curious or passionate about art and open source models:{'\n\n'}- Artists: creators of art{'\n'}- Developers: people who build with open models{'\n'}- Interested parties: founders, executives, investors, etc.{'\n'}- Curious oddballs: undefinable</>),
      whyGather: (<>Open models are an essential weapon against the <strong>slop machine</strong> - they offer as much control as traditional mediums, unconstrained by invented limitations or constrained imaginations - but they require an ecosystem of effort and support to thrive.{'\n\n'}We gather to celebrate AI art and open models, hang out with fellow connoisseurs, and scheme on how to help the ecosystem and community succeed.</>),
    },
    epic: {
      subtitle: 'A SYMPOSIUM ON THE FUTURE OF CREATIVITY',
      date: 'The City of Angels | November 7th',
      cta: getCtaText(),
      watchTrailer: 'Feast your eyes',
      whatIsIt: (<>This will be a day-long event with a day-time and evening portion:{'\n\n'}- Day-time: panels, roundtables, hangouts - for hardcore enthusiasts{'\n'}- Evening: show, drinks, frivolities - for curious people{'\n\n'}Thanks to our friends at Asteria, we'll host at the legendary Mack Sennett studio.</>),
      whoIsItFor: (<>We hope to bring together a mix of people who are curious or passionate about art and open source models:{'\n\n'}- Artists: creators of art{'\n'}- Developers: people who build with open models{'\n'}- Interested parties: founders, executives, investors, etc.{'\n'}- Curious oddballs: undefinable</>),
      whyGather: (<>Open models are an essential weapon against the <strong>slop machine</strong> - they offer as much control as traditional mediums, unconstrained by invented limitations or constrained imaginations - but they require an ecosystem of effort and support to thrive.{'\n\n'}We gather to celebrate AI art and open models, hang out with fellow connoisseurs, and scheme on how to help the ecosystem and community succeed.</>),
    },
  }

  return (
    <>
      {/* Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black"
          >
            <motion.div
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {/* ADOS text */}
              <motion.h1 
                className="text-5xl md:text-7xl font-black uppercase text-white tracking-[0.5em]"
        animate={{ 
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
        style={{
                  textShadow: '0 0 40px rgba(255,255,255,0.2)',
                  marginRight: '-0.5em'
                }}
              >
                ADOS
              </motion.h1>
              
              {/* Loading bar */}
              <div className="w-32 h-0.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white/60"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className="relative h-[100dvh] overflow-hidden">
      {/* Cinema Background with Texture */}
          <motion.div
        className="absolute inset-0 transition-all duration-700"
            animate={{
          background: vibe === 'epic' 
            ? 'radial-gradient(ellipse at 70% 50%, #3d2817 0%, #1a0d08 40%, #0a0503 100%)'
            : 'radial-gradient(ellipse at 70% 50%, #1a1a2e 0%, #0f0f1a 40%, #050508 100%)'
            }}
      />
      
      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
            style={{ 
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
            }}
          />

      {/* Ambient wall lighting from screen */}
          <motion.div
        className="absolute inset-0 pointer-events-none"
            animate={{
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
            }}
            style={{ 
              background: vibe === 'epic' 
            ? 'radial-gradient(ellipse 1000px 800px at 70% 50%, rgba(217,119,6,0.15) 0%, transparent 50%)'
            : 'radial-gradient(ellipse 1000px 800px at 70% 50%, rgba(30,64,175,0.12) 0%, transparent 50%)'
        }}
      />
      
      {/* Floor reflection subtle effect */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 100%)',
        }}
      />
      
      {/* Subtle vignette for depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
            style={{
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 0%, transparent 60%, rgba(0,0,0,0.3) 100%)',
        }}
      />

      {/* Admin Button */}
      {isAdmin && (
        <Link href="/admin">
          <button className="absolute top-6 right-6 z-50 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white font-semibold transition-all">
            Admin
          </button>
        </Link>
      )}

      {/* Mobile: Full Screen Layout */}
      <div className="lg:hidden relative h-full flex items-center justify-center">
        {/* Mobile Background Video */}
        <video
        autoPlay
        loop
        muted
        playsInline
        poster={vibe === 'epic' ? '/epic-hero-poster.jpg' : '/chill-hero-poster.jpg'}
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src={vibe === 'epic' ? '/epic-hero.mp4' : '/chill-hero.mp4'} type="video/mp4" />
        </video>
        
        {/* Mobile Overlay */}
      <div className={`absolute inset-0 ${vibe === 'epic' ? 'bg-white/20' : 'bg-black/30'}`} />

        {/* Mobile Content */}
          <motion.div
          className="relative z-10 w-full flex flex-col justify-center items-center text-center px-6"
          animate={isGlitching ? {
            scale: [1, 0.95, 1.02, 1],
            rotateZ: rotationDirection === 'right' ? [0, -2, 2, 0] : [0, 2, -2, 0],
          } : {}}
            transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center w-full max-w-xl"
          >
            {inviteName && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  duration: 0.8, 
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.1
                }}
                className="mb-4 relative"
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className={`absolute bottom-0 left-0 h-[2px] ${
                    vibe === 'epic' ? 'bg-amber-500/50' : 'bg-white/30'
                  }`}
                />
                <p className={`text-sm font-light uppercase tracking-wider px-4 pb-2 ${
                  vibe === 'epic' ? 'text-amber-500/70' : 'text-white/70'
                }`}>
                  An Invitation To{' '}
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    className="font-semibold"
                  >
                    {inviteName}
                  </motion.span>
                </p>
              </motion.div>
            )}
            
            <h1 className={`text-5xl sm:text-6xl md:text-7xl font-black mb-6 uppercase transition-colors duration-300 ${
              vibe === 'epic' ? 'text-black' : 'text-white'
            }`}>
              <span className="inline-block tracking-[0.5em] -mr-[0.5em]">ADOS</span>
            </h1>
            
            <motion.p 
              key={`subtitle-mobile-${vibe}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-sm mb-3 font-light uppercase transition-colors duration-300 ${
                vibe === 'epic' ? 'text-black' : 'text-white'
              }`}
            >
              <span className="inline-block tracking-[0.2em] -mr-[0.2em]">{content[vibe].subtitle}</span>
            </motion.p>
            
            <motion.p
              key={`date-mobile-${vibe}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-xs mb-8 font-light uppercase transition-colors duration-300 ${
                vibe === 'epic' ? 'text-black/70' : 'text-white/70'
              }`}
            >
              <span className="inline-block tracking-[0.25em] -mr-[0.25em]">{content[vibe].date}</span>
            </motion.p>
            
            <div className="flex flex-col gap-5 items-center w-full">
              <Button 
                size="lg" 
                className={`min-w-[200px] cursor-default ${vibe === 'epic' ? 'hover:bg-yellow-50' : 'hover:bg-gray-800'}`} 
                isDark={vibe === 'epic'}
              >
                {content[vibe].cta}
              </Button>
              
              {/* Hide on desktop, show on mobile */}
              <button
                onClick={() => setIsModalOpen(true)}
                className={`lg:hidden flex items-center gap-2 transition-colors text-sm uppercase tracking-wide ${
                  vibe === 'epic' ? 'text-black hover:text-gray-700' : 'text-white hover:text-gray-300'
                }`}
              >
                <Play size={20} />
                <span>{content[vibe].watchTrailer}</span>
              </button>

              <div className="flex items-center gap-4 mt-2 flex-wrap justify-center">
                <InfoTooltip
                  trigger={vibe === 'epic' ? 'Purpose' : 'Why'}
                  content={content[vibe].whyGather}
                  isDark={vibe === 'epic'}
                  arrowPosition="left"
                />
                <span className={vibe === 'epic' ? 'text-black/40' : 'text-white/40'}>|</span>
                <InfoTooltip
                  trigger={vibe === 'epic' ? 'Vision' : 'What'}
                  content={content[vibe].whatIsIt}
                  isDark={vibe === 'epic'}
                  arrowPosition="center"
                />
                <span className={vibe === 'epic' ? 'text-black/40' : 'text-white/40'}>|</span>
                <InfoTooltip
                  trigger={vibe === 'epic' ? 'Group' : 'Who'}
                  content={content[vibe].whoIsItFor}
                  isDark={vibe === 'epic'}
                  arrowPosition="right"
                />
              </div>

              <div className="mt-2">
                <VibeToggle value={vibe} onChange={handleVibeChange} />
              </div>

              <motion.div 
                className="mt-6 flex flex-col items-center justify-center gap-3 -ml-[1px]"
                key={`cohosted-mobile-${vibe}`}
              >
                <motion.p 
                  className={`text-xs font-light uppercase tracking-wider transition-colors duration-300 ${
                    vibe === 'epic' ? 'text-black/50' : 'text-white/60'
                  }`}
                >
                Cohosted by
                </motion.p>
              <div className="flex items-center gap-3">
                <a href="https://www.asteriafilm.com" target="_blank" rel="noopener noreferrer" className="opacity-75 hover:opacity-100 transition-opacity">
                    {vibe === 'epic' ? (
                  <img 
                    src="/a.png" 
                    alt="Asteria" 
                        className="h-5 w-5 object-contain transition-all duration-300 brightness-[0.4] sepia saturate-[3] hue-rotate-[5deg]" 
                      />
                    ) : (
                  <img 
                    src="/a.png" 
                    alt="Asteria" 
                        className="h-5 w-5 object-contain transition-all duration-300 brightness-[2]" 
                      />
                    )}
                  </a>
                  <motion.span 
                    className={`text-base transition-colors duration-300 ${vibe === 'epic' ? 'text-black/40' : 'text-white/40'}`}
                  >×</motion.span>
                <a href="https://banodoco.ai/" target="_blank" rel="noopener noreferrer" className="opacity-75 hover:opacity-100 transition-opacity">
                    {vibe === 'epic' ? (
                  <img 
                    src="/b.png" 
                    alt="Banodoco" 
                        className="h-5 w-5 object-contain transition-all duration-300 brightness-[0.4] sepia saturate-[3] hue-rotate-[5deg]" 
                      />
                    ) : (
                  <img 
                    src="/b.png" 
                    alt="Banodoco" 
                        className="h-5 w-5 object-contain transition-all duration-300 brightness-[2]" 
                  />
                    )}
                </a>
              </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Desktop: Cinema Layout */}
      <div className="hidden lg:flex relative h-full flex-row items-center justify-center gap-12 px-12">
        
        {/* Left Content Area - 40% */}
      <motion.div 
          className="relative z-10 w-[40%] flex flex-col justify-center items-start text-left pl-16"
        animate={isGlitching ? {
          scale: [1, 0.95, 1.02, 1],
          rotateZ: rotationDirection === 'right' ? [0, -2, 2, 0] : [0, 2, -2, 0],
          filter: [
            'hue-rotate(0deg) brightness(1)',
            `hue-rotate(${rotationDirection === 'right' ? 180 : -180}deg) brightness(1.3)`,
            'hue-rotate(0deg) brightness(1)',
          ],
        } : {}}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
            className="flex flex-col items-center lg:items-start w-full max-w-xl"
        >
                {inviteName && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      duration: 0.8, 
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.1
                    }}
                    className="mb-4 relative"
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      className={`absolute bottom-0 left-0 h-[2px] ${
                    vibe === 'epic' ? 'bg-amber-500/50' : 'bg-white/30'
                      }`}
                    />
                <p className={`text-sm sm:text-base font-light uppercase tracking-wider px-4 pb-2 ${
                  vibe === 'epic' ? 'text-amber-500/70' : 'text-white/70'
                    }`}>
                      An Invitation To{' '}
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.5 }}
                        className="font-semibold"
                      >
                        {inviteName}
                      </motion.span>
                    </p>
                  </motion.div>
                )}
                {invalidInvite && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      duration: 0.8, 
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.1
                    }}
                    className="mb-4 relative"
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      className={`absolute bottom-0 left-0 h-[2px] ${
                    vibe === 'epic' ? 'bg-amber-500/50' : 'bg-white/30'
                      }`}
                    />
                <p className={`text-sm sm:text-base font-light uppercase tracking-wider px-4 pb-2 ${
                  vibe === 'epic' ? 'text-amber-500/70' : 'text-white/70'
                    }`}>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.5 }}
                        className="font-semibold"
                      >
                        Nice try
                      </motion.span>
                    </p>
                  </motion.div>
                )}
            
            <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black mb-6 uppercase transition-colors duration-300 ${
              vibe === 'epic' ? 'text-yellow-50' : 'text-white'
            }`} style={{
              textShadow: vibe === 'epic' 
                ? '0 0 40px rgba(234,179,8,0.25), 0 0 80px rgba(234,179,8,0.15)'
                : '0 0 40px rgba(255,255,255,0.2), 0 0 80px rgba(255,255,255,0.1)',
              letterSpacing: '0.5em',
              fontWeight: 900
            }}>
              <span className="inline-block -mr-[0.5em]">ADOS</span>
                </h1>
            
                <motion.p 
                  key={`subtitle-${vibe}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
              className={`text-sm sm:text-base md:text-lg mb-6 font-light uppercase transition-colors duration-300 ${
                vibe === 'epic' ? 'text-yellow-100/80' : 'text-white/90'
              }`}
              style={{
                letterSpacing: '0.2em',
                textShadow: vibe === 'epic' 
                  ? '0 0 20px rgba(234,179,8,0.15)'
                  : '0 0 20px rgba(255,255,255,0.15)',
                fontWeight: 300
              }}
            >
              <span className="inline-block -mr-[0.2em]">{content[vibe].subtitle}</span>
                </motion.p>
            
                <motion.p
                  key={`date-${vibe}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
              className={`text-xs sm:text-sm mb-7 font-light uppercase transition-colors duration-300 ${
                vibe === 'epic' ? 'text-yellow-100/60' : 'text-white/70'
              }`}
              style={{
                letterSpacing: '0.25em',
                textShadow: vibe === 'epic' 
                  ? '0 0 15px rgba(234,179,8,0.12)'
                  : '0 0 15px rgba(255,255,255,0.1)',
                fontWeight: 300
              }}
            >
              <span className="inline-block -mr-[0.25em]">{content[vibe].date}</span>
                </motion.p>

            <div className="flex flex-col gap-5 items-center lg:items-start w-full">
              <motion.div
                key={`cta-${vibe}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Button 
                  size="lg" 
                  className={`min-w-[200px] cursor-default ${vibe === 'epic' ? 'hover:bg-yellow-50' : 'hover:bg-gray-800'}`} 
                  isDark={vibe === 'epic'}
                >
                  {content[vibe].cta}
                </Button>
              </motion.div>
            
              {/* Hide on desktop, show on mobile */}
                <motion.button
                  key={`trailer-${vibe}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setIsModalOpen(true)}
                className={`lg:hidden flex items-center gap-2 transition-colors text-sm uppercase tracking-wide group ${
                  vibe === 'epic' ? 'text-yellow-100 hover:text-yellow-50' : 'text-white hover:text-gray-300'
                  }`}
                >
                  <motion.div
                    className="inline-block"
                    whileHover={{
                      rotate: [0, -10, 10, -10, 10, 0],
                      transition: { duration: 0.5 }
                    }}
                  >
                    <Play size={20} />
                  </motion.div>
                  <span>{content[vibe].watchTrailer}</span>
                </motion.button>

              <motion.div 
                className="flex items-center gap-6 mt-2"
                key={`tooltips-${vibe}`}
              >
                  <InfoTooltip
                    trigger={vibe === 'epic' ? 'Purpose' : 'Why'}
                    content={content[vibe].whyGather}
                    isDark={vibe === 'epic'}
                    arrowPosition="left"
                  />
                <motion.span 
                  className={`transition-colors duration-300 ${vibe === 'epic' ? 'text-yellow-200/40' : 'text-white/40'}`}
                  animate={{
                    color: vibe === 'epic' ? 'rgba(254, 240, 138, 0.4)' : 'rgba(255, 255, 255, 0.4)'
                  }}
                >|</motion.span>
                  <InfoTooltip
                    trigger={vibe === 'epic' ? 'Vision' : 'What'}
                    content={content[vibe].whatIsIt}
                    isDark={vibe === 'epic'}
                    arrowPosition="center"
                  />
                <motion.span 
                  className={`transition-colors duration-300 ${vibe === 'epic' ? 'text-yellow-200/40' : 'text-white/40'}`}
                  animate={{
                    color: vibe === 'epic' ? 'rgba(254, 240, 138, 0.4)' : 'rgba(255, 255, 255, 0.4)'
                  }}
                >|</motion.span>
                  <InfoTooltip
                    trigger={vibe === 'epic' ? 'Group' : 'Who'}
                    content={content[vibe].whoIsItFor}
                    isDark={vibe === 'epic'}
                    arrowPosition="right"
                  />
              </motion.div>

            <div className="mt-4">
              <VibeToggle value={vibe} onChange={handleVibeChange} />
            </div>

              <motion.div 
                className="mt-8 flex items-center justify-center lg:justify-start gap-4"
                key={`cohosted-${vibe}`}
              >
                <motion.p 
                  className={`text-xs sm:text-sm font-light uppercase tracking-wider transition-colors duration-300 ${
                    vibe === 'epic' ? 'text-yellow-100/50' : 'text-white/60'
                  }`}
                  animate={{
                    color: vibe === 'epic' ? 'rgba(254, 243, 199, 0.5)' : 'rgba(255, 255, 255, 0.6)'
                  }}
                >
                Cohosted by
                </motion.p>
              <div className="flex items-center gap-3">
                <a href="https://www.asteriafilm.com" target="_blank" rel="noopener noreferrer" className="opacity-75 hover:opacity-100 transition-opacity">
                    {vibe === 'epic' ? (
                  <img 
                    src="/a.png" 
                    alt="Asteria" 
                        className="h-6 w-6 object-contain transition-all duration-300 brightness-[2] sepia saturate-[3] hue-rotate-[5deg]" 
                      />
                    ) : (
                  <img 
                    src="/a.png" 
                    alt="Asteria" 
                        className="h-6 w-6 object-contain transition-all duration-300 brightness-[2]" 
                      />
                    )}
                  </a>
                  <motion.span 
                    className={`text-lg transition-colors duration-300 ${vibe === 'epic' ? 'text-yellow-200/40' : 'text-white/40'}`}
                    animate={{
                      color: vibe === 'epic' ? 'rgba(254, 240, 138, 0.4)' : 'rgba(255, 255, 255, 0.4)'
                    }}
                  >×</motion.span>
                <a href="https://banodoco.ai/" target="_blank" rel="noopener noreferrer" className="opacity-75 hover:opacity-100 transition-opacity">
                    {vibe === 'epic' ? (
                  <img 
                    src="/b.png" 
                    alt="Banodoco" 
                        className="h-6 w-6 object-contain transition-all duration-300 brightness-[2] sepia saturate-[3] hue-rotate-[5deg]" 
                      />
                    ) : (
                  <img 
                    src="/b.png" 
                    alt="Banodoco" 
                        className="h-6 w-6 object-contain transition-all duration-300 brightness-[2]" 
                  />
                    )}
                </a>
              </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Video Screen - 60% */}
        <div className="relative w-[60%] h-[80vh] flex items-center justify-center pr-16">
          {/* Deep shadow layers for depth */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-black/40 blur-3xl transform scale-95" />
            <div className="absolute inset-0 bg-black/30 blur-2xl transform scale-98" />
          </div>
          
          {/* Inner container with group for hover */}
          <div className="relative w-full h-full group z-20">
            {/* Watch Full Screen Button - appears on hover */}
            <div 
              className="absolute inset-0 z-50 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none group-hover:pointer-events-auto"
              style={{
                background: vibe === 'epic' 
                  ? 'radial-gradient(circle at center, rgba(26, 13, 8, 0.5) 0%, rgba(26, 13, 8, 0.2) 100%)'
                  : 'radial-gradient(circle at center, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.2) 100%)',
                backdropFilter: 'blur(2px)'
              }}
            >
              <button
                onClick={() => setIsModalOpen(true)}
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
              >
              <motion.div 
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-4 px-6 py-3"
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Play 
                    size={28} 
                    className={vibe === 'epic' ? 'text-yellow-300' : 'text-white'} 
                    fill="currentColor"
                    style={{
                      filter: vibe === 'epic' 
                        ? 'drop-shadow(0 0 8px rgba(234, 179, 8, 0.5))'
                        : 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))'
                    }}
                  />
        </motion.div>
                <span 
                  className={`text-sm uppercase tracking-[0.3em] font-light ${
                    vibe === 'epic' ? 'text-yellow-100' : 'text-white'
                  }`}
                  style={{
                    textShadow: vibe === 'epic'
                      ? '0 0 20px rgba(234, 179, 8, 0.3)'
                      : '0 0 20px rgba(255, 255, 255, 0.3)'
                  }}
                >
                  {content[vibe].watchTrailer}
                </span>
      </motion.div>
            </button>
          </div>
          
          {/* Screen Frame - Changes based on vibe */}
          <motion.div
            className="relative w-full h-full"
            animate={{
              filter: isGlitching ? `blur(4px)` : 'none',
            }}
            transition={{ duration: 0.6 }}
          >
            {/* Art Deco Frame (Epic) */}
            {vibe === 'epic' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 pointer-events-none z-20"
              >
                {/* Outer frame - only on edges */}
                <div className="absolute inset-0">
                  {/* Top bar */}
                  <div className="absolute top-0 left-0 right-0 h-6" style={{
                    background: 'linear-gradient(135deg, #1a0d08 0%, #3d2817 50%, #1a0d08 100%)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.9)',
                  }} />
                  {/* Bottom bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-6" style={{
                    background: 'linear-gradient(135deg, #1a0d08 0%, #3d2817 50%, #1a0d08 100%)',
                    boxShadow: '0 -4px 16px rgba(0,0,0,0.9)',
                  }} />
                  {/* Left bar */}
                  <div className="absolute top-0 bottom-0 left-0 w-6" style={{
                    background: 'linear-gradient(135deg, #1a0d08 0%, #3d2817 50%, #1a0d08 100%)',
                    boxShadow: '4px 0 16px rgba(0,0,0,0.9)',
                  }} />
                  {/* Right bar */}
                  <div className="absolute top-0 bottom-0 right-0 w-6" style={{
                    background: 'linear-gradient(135deg, #1a0d08 0%, #3d2817 50%, #1a0d08 100%)',
                    boxShadow: '-4px 0 16px rgba(0,0,0,0.9)',
                  }} />
                </div>
                
                {/* Gold trim */}
                <div className="absolute inset-0" style={{
                  border: '2px solid transparent',
                  borderImage: 'linear-gradient(135deg, #d97706 0%, #fbbf24 25%, #f59e0b 50%, #fbbf24 75%, #d97706 100%) 1',
                  boxShadow: 'inset 0 0 20px rgba(251,191,36,0.2), 0 0 20px rgba(251,191,36,0.3)',
                }} />
                
                {/* Ornate corner pieces */}
                <div className="absolute top-3 left-3 w-20 h-20">
                  <div className="absolute inset-0 border-t-4 border-l-4 border-amber-400" style={{
                    borderImage: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) 1',
                    filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))'
                  }} />
                  <div className="absolute top-0 left-0 w-4 h-4 bg-amber-400 rounded-full" style={{
                    boxShadow: '0 0 12px rgba(251,191,36,0.8)'
                  }} />
                </div>
                <div className="absolute top-3 right-3 w-20 h-20">
                  <div className="absolute inset-0 border-t-4 border-r-4 border-amber-400" style={{
                    borderImage: 'linear-gradient(225deg, #fbbf24 0%, #f59e0b 100%) 1',
                    filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))'
                  }} />
                  <div className="absolute top-0 right-0 w-4 h-4 bg-amber-400 rounded-full" style={{
                    boxShadow: '0 0 12px rgba(251,191,36,0.8)'
                  }} />
                </div>
                <div className="absolute bottom-3 left-3 w-20 h-20">
                  <div className="absolute inset-0 border-b-4 border-l-4 border-amber-400" style={{
                    borderImage: 'linear-gradient(45deg, #fbbf24 0%, #f59e0b 100%) 1',
                    filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))'
                  }} />
                  <div className="absolute bottom-0 left-0 w-4 h-4 bg-amber-400 rounded-full" style={{
                    boxShadow: '0 0 12px rgba(251,191,36,0.8)'
                  }} />
                </div>
                <div className="absolute bottom-3 right-3 w-20 h-20">
                  <div className="absolute inset-0 border-b-4 border-r-4 border-amber-400" style={{
                    borderImage: 'linear-gradient(315deg, #fbbf24 0%, #f59e0b 100%) 1',
                    filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))'
                  }} />
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-amber-400 rounded-full" style={{
                    boxShadow: '0 0 12px rgba(251,191,36,0.8)'
                  }} />
                </div>
                
                {/* Decorative mid-lines with gradients */}
                <div className="absolute top-3 left-24 right-24 h-0.5" style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.8) 50%, transparent 100%)',
                  boxShadow: '0 0 10px rgba(251,191,36,0.5)'
                }} />
                <div className="absolute bottom-3 left-24 right-24 h-0.5" style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.8) 50%, transparent 100%)',
                  boxShadow: '0 0 10px rgba(251,191,36,0.5)'
                }} />
              </motion.div>
            )}

            {/* Modern Minimal Frame (Chill) */}
            {vibe === 'chill' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 pointer-events-none z-20"
              >
                {/* Frame bars - only on edges */}
                <div className="absolute inset-0">
                  {/* Top bar */}
                  <div className="absolute top-0 left-0 right-0 h-4" style={{
                    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.8)',
                  }} />
                  {/* Bottom bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-4" style={{
                    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)',
                    boxShadow: '0 -4px 16px rgba(0,0,0,0.8)',
                  }} />
                  {/* Left bar */}
                  <div className="absolute top-0 bottom-0 left-0 w-4" style={{
                    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)',
                    boxShadow: '4px 0 16px rgba(0,0,0,0.8)',
                  }} />
                  {/* Right bar */}
                  <div className="absolute top-0 bottom-0 right-0 w-4" style={{
                    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)',
                    boxShadow: '-4px 0 16px rgba(0,0,0,0.8)',
                  }} />
                </div>
                
                {/* Clean border with glow */}
                <div className="absolute inset-0 border border-blue-400/40" style={{
                  boxShadow: '0 0 30px rgba(59,130,246,0.2), inset 0 0 20px rgba(59,130,246,0.1)',
                }} />
                
                {/* Corner accents */}
                <div className="absolute top-1 left-1 w-8 h-8 border-t-2 border-l-2 border-blue-400/60" style={{
                  filter: 'drop-shadow(0 0 4px rgba(59,130,246,0.5))'
                }} />
                <div className="absolute top-1 right-1 w-8 h-8 border-t-2 border-r-2 border-blue-400/60" style={{
                  filter: 'drop-shadow(0 0 4px rgba(59,130,246,0.5))'
                }} />
                <div className="absolute bottom-1 left-1 w-8 h-8 border-b-2 border-l-2 border-blue-400/60" style={{
                  filter: 'drop-shadow(0 0 4px rgba(59,130,246,0.5))'
                }} />
                <div className="absolute bottom-1 right-1 w-8 h-8 border-b-2 border-r-2 border-blue-400/60" style={{
                  filter: 'drop-shadow(0 0 4px rgba(59,130,246,0.5))'
                }} />
              </motion.div>
            )}

            {/* Video Container with Screen Glow */}
            <div className="relative w-full h-full overflow-hidden bg-black">
              {/* Screen glow effect */}
              <motion.div
                className="absolute inset-0 pointer-events-none z-10"
                animate={{
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{
                  background: vibe === 'epic'
                    ? 'radial-gradient(circle at center, rgba(251,191,36,0.2) 0%, transparent 70%)'
                    : 'radial-gradient(circle at center, rgba(59,130,246,0.15) 0%, transparent 70%)'
                }}
              />

              {/* Visible Background Video */}
              <motion.video
                ref={videoRef}
                autoPlay
                loop
                muted
                playsInline
                poster={vibe === 'epic' ? '/epic-hero-poster.jpg' : '/chill-hero-poster.jpg'}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ 
                  opacity: 1,
                  scale: isGlitching ? [1, 1.05, 0.95, 1] : 1,
                  rotate: isGlitching ? (rotationDirection === 'right' ? [0, 1, -1, 0] : [0, -1, 1, 0]) : 0,
                }}
                transition={{ duration: isGlitching ? 0.6 : 0.5 }}
                className="w-full h-full object-cover"
                style={{
                  filter: isGlitching ? `blur(8px) saturate(2) hue-rotate(${rotationDirection === 'right' ? 30 : -30}deg)` : 'none',
                }}
              >
                <source src={vibe === 'epic' ? '/epic-hero.mp4' : '/chill-hero.mp4'} type="video/mp4" />
              </motion.video>

              {/* Hidden preload video for the inactive vibe */}
              <video
                ref={preloadVideoRef}
                loop
                muted
                playsInline
                preload="auto"
                className="hidden"
                src={vibe === 'epic' ? '/chill-hero.mp4' : '/epic-hero.mp4'}
              />
            </div>
          </motion.div>

          {/* Multi-layer external screen glow (illuminates the entire room) */}
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {/* Primary glow - bright and pulsing */}
            <motion.div
              className="absolute -inset-32"
              style={{
                filter: 'blur(100px)',
              }}
              animate={{
                opacity: [0.3, 0.45, 0.3],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <div 
                className="w-full h-full"
                style={{
                  background: vibe === 'epic'
                    ? 'radial-gradient(ellipse 150% 140% at 50% 50%, rgba(251,191,36,0.3) 0%, rgba(217,119,6,0.2) 25%, rgba(217,119,6,0.1) 50%, transparent 75%)'
                    : 'radial-gradient(ellipse 150% 140% at 50% 50%, rgba(96,165,250,0.25) 0%, rgba(59,130,246,0.18) 25%, rgba(59,130,246,0.1) 50%, transparent 75%)'
                }}
              />
            </motion.div>
            
            {/* Secondary glow - wider reach with pulse */}
            <motion.div
              className="absolute -inset-48"
              style={{
                filter: 'blur(150px)',
              }}
              animate={{
                opacity: [0.18, 0.28, 0.18],
                scale: [0.98, 1.02, 0.98],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.5
              }}
            >
              <div 
                className="w-full h-full"
                style={{
                  background: vibe === 'epic'
                    ? 'radial-gradient(ellipse 140% 130% at 50% 50%, rgba(251,191,36,0.2) 0%, rgba(217,119,6,0.12) 30%, rgba(217,119,6,0.05) 60%, transparent 85%)'
                    : 'radial-gradient(ellipse 140% 130% at 50% 50%, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.1) 30%, rgba(37,99,235,0.05) 60%, transparent 85%)'
                }}
              />
            </motion.div>
            
            {/* Edge highlights - reaches all edges */}
            <motion.div
              className="absolute -inset-64"
              animate={{
                opacity: [0.1, 0.18, 0.1],
                scale: [1, 1.03, 1],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 3
              }}
              style={{
                background: vibe === 'epic'
                  ? 'radial-gradient(ellipse 180% 160% at 50% 50%, transparent 30%, rgba(251,191,36,0.12) 55%, rgba(217,119,6,0.08) 75%, transparent 100%)'
                  : 'radial-gradient(ellipse 180% 160% at 50% 50%, transparent 30%, rgba(59,130,246,0.1) 55%, rgba(37,99,235,0.06) 75%, transparent 100%)',
                filter: 'blur(60px)'
              }}
            />
            
            {/* Atmospheric wash - fills entire background */}
            <motion.div
              className="absolute -inset-96"
              animate={{
                opacity: [0.08, 0.15, 0.08],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 5
              }}
              style={{
                background: vibe === 'epic'
                  ? 'radial-gradient(ellipse 200% 180% at 50% 50%, transparent 40%, rgba(251,191,36,0.08) 70%, rgba(217,119,6,0.04) 85%, transparent 100%)'
                  : 'radial-gradient(ellipse 200% 180% at 50% 50%, transparent 40%, rgba(59,130,246,0.06) 70%, rgba(37,99,235,0.03) 85%, transparent 100%)',
                filter: 'blur(80px)'
              }}
            />
          </div>
          </div>
        </div>
      </div>

      {/* Kaleidoscope Vortex Overlay - Behind video on desktop, in front on mobile */}
      {isGlitching && (
        <div className="absolute inset-0 pointer-events-none z-30 lg:z-0">
          {/* Gentle center flash */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              opacity: [0, 0.4, 0],
            }}
            style={{ 
              background: vibe === 'epic' 
                ? 'radial-gradient(circle at 50% 50%, rgba(255,200,150,0.5) 0%, transparent 35%)'
                : 'radial-gradient(circle at 50% 50%, rgba(150,200,255,0.4) 0%, transparent 35%)',
              mixBlendMode: 'screen' 
            }}
            transition={{ duration: 0.4 }}
          />

          {/* Subtle edge vignette pulse */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              opacity: [0, 0.6, 0],
            }}
            style={{ 
              background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)',
            }}
            transition={{ duration: 0.8 }}
          />

          {/* Radial gradient pulses */}
          {[0, 1, 2, 3].map((i) => {
            const multiplier = rotationDirection === 'right' ? 1 : -1
            const pulseColor = vibe === 'epic' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.1)'
            return (
              <motion.div
                key={i}
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 50%, transparent ${20 + i * 15}%, ${pulseColor} ${25 + i * 15}%, transparent ${30 + i * 15}%)`,
                  mixBlendMode: 'overlay',
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0, 0.8, 0],
                  rotate: [0, 180 * multiplier * (i % 2 ? 1 : -1), 360 * multiplier * (i % 2 ? 1 : -1)],
                }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
              />
            )
          })}
          
          {/* Kaleidoscope mirror effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: vibe === 'epic' 
                ? 'conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.4) 60deg, transparent 120deg, rgba(217,119,6,0.4) 180deg, transparent 240deg, rgba(251,191,36,0.4) 300deg, transparent 360deg)'
                : 'conic-gradient(from 0deg, transparent 0deg, rgba(255,100,255,0.3) 60deg, transparent 120deg, rgba(100,255,255,0.3) 180deg, transparent 240deg, rgba(255,255,100,0.3) 300deg, transparent 360deg)',
              mixBlendMode: 'screen',
            }}
            animate={{
              rotate: rotationDirection === 'right' ? [0, 720] : [0, -720],
              scale: [1, 1.2, 1],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
          
          {/* Prismatic color burst */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background: vibe === 'epic' 
                ? [
                    'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.5) 0%, transparent 30%)',
                    'radial-gradient(circle at 50% 50%, rgba(217,119,6,0.5) 0%, transparent 50%)',
                    'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.5) 0%, transparent 30%)',
                    'radial-gradient(circle at 50% 50%, transparent 0%, transparent 30%)',
                  ]
                : [
                    'radial-gradient(circle at 50% 50%, rgba(255,0,255,0.4) 0%, transparent 30%)',
                    'radial-gradient(circle at 50% 50%, rgba(0,255,255,0.4) 0%, transparent 50%)',
                    'radial-gradient(circle at 50% 50%, rgba(255,255,0,0.4) 0%, transparent 30%)',
                    'radial-gradient(circle at 50% 50%, transparent 0%, transparent 30%)',
                  ],
              scale: [0.5, 2, 0.5],
              opacity: [0, 0.8, 0],
            }}
            style={{ mixBlendMode: 'screen' }}
            transition={{ duration: 0.8 }}
          />
        </div>
      )}


      <VideoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        videoSrc={vibe === 'epic' ? '/epic-hero-full.mp4' : '/chill-hero-full.mp4'}
      />
    </div>
    </>
  )
}