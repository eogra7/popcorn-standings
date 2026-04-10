import { useState, useEffect, useRef } from "react";
import { Plus, Minus, Info, ArrowUp, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const getInitials = (name: string): string => {
  if (!name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.map(part => part[0]?.toUpperCase() || "").join("");
};

type Participant = {
  id: string;
  name: string;
  score: number;
  hasSpoken: boolean;
  hasOfficeHoursTopic: boolean;
  officeHoursTopicComment: string;
};

type ParticipantStats = {
  id: string;
  name: string;
  score: number;
  speakingTime: number;
  hasOfficeHoursTopic: boolean;
  officeHoursTopicComment: string;
};

type Mode = "normal" | "insert" | "meeting";
type SearchOverlayMode = "participant" | "bonus-topic";

const Leaderboard = () => {
  // Load from localStorage or use defaults
  const loadParticipants = (): Participant[] => {
    try {
      const saved = localStorage.getItem('leaderboard-participants');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((p, index) => ({
            id: typeof p.id === "string" ? p.id : `participant-${index}`,
            name: typeof p.name === "string" ? p.name : "",
            score: typeof p.score === "number" ? p.score : 0,
            hasSpoken: Boolean(p.hasSpoken),
            hasOfficeHoursTopic: Boolean(p.hasOfficeHoursTopic),
            officeHoursTopicComment: typeof p.officeHoursTopicComment === "string" ? p.officeHoursTopicComment : "",
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load participants from localStorage:', error);
    }
    return [
      { id: "1", name: "Alice", score: 0, hasSpoken: false, hasOfficeHoursTopic: false, officeHoursTopicComment: "" },
      { id: "2", name: "Bob", score: 0, hasSpoken: false, hasOfficeHoursTopic: false, officeHoursTopicComment: "" },
      { id: "3", name: "Charlie", score: 0, hasSpoken: false, hasOfficeHoursTopic: false, officeHoursTopicComment: "" },
    ];
  };

  const [participants, setParticipants] = useState<Participant[]>(loadParticipants);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("normal");
  const [editValue, setEditValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOverlayMode, setSearchOverlayMode] = useState<SearchOverlayMode>("participant");
  const [bonusTopicParticipantId, setBonusTopicParticipantId] = useState<string | null>(null);
  const [errorParticipantId, setErrorParticipantId] = useState<string | null>(null);
  const [meetingTime, setMeetingTime] = useState(0);
  const [isRevealingStatus, setIsRevealingStatus] = useState(false);
  const [speakingStartTime, setSpeakingStartTime] = useState<number | null>(null);
  const [speakingDuration, setSpeakingDuration] = useState(0);
  const [participantSpeakingTimes, setParticipantSpeakingTimes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('leaderboard-speaking-times');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showMeetingSummary, setShowMeetingSummary] = useState(false);
  const [meetingSummaryData, setMeetingSummaryData] = useState<{
    stats: ParticipantStats[];
    totalTime: number;
  } | null>(null);
  const [summaryCloseTimer, setSummaryCloseTimer] = useState(10);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [endMeetingProgress, setEndMeetingProgress] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  const [overtimeThreshold, setOvertimeThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('leaderboard-overtime-threshold');
      return saved ? parseInt(saved, 10) : 30;
    } catch {
      return 30;
    }
  });
  const [showAutoSummary, setShowAutoSummary] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('leaderboard-auto-summary');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speakingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tickTockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const summaryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const endMeetingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const spinAnimationRef = useRef<number | null>(null);

  // Persist participants to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('leaderboard-participants', JSON.stringify(participants));
    } catch (error) {
      console.error('Failed to save participants to localStorage:', error);
    }
  }, [participants]);

  // Persist speaking times to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('leaderboard-speaking-times', JSON.stringify(participantSpeakingTimes));
    } catch (error) {
      console.error('Failed to save speaking times to localStorage:', error);
    }
  }, [participantSpeakingTimes]);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('leaderboard-overtime-threshold', overtimeThreshold.toString());
    } catch (error) {
      console.error('Failed to save overtime threshold to localStorage:', error);
    }
  }, [overtimeThreshold]);

  useEffect(() => {
    try {
      localStorage.setItem('leaderboard-auto-summary', JSON.stringify(showAutoSummary));
    } catch (error) {
      console.error('Failed to save auto-summary setting to localStorage:', error);
    }
  }, [showAutoSummary]);

  // Audio feedback
  const playSound = (frequency: number, duration: number = 50) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  };

  const playBuzzer = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    const gainNode = audioContext.createGain();
    
    // LFO setup for frequency modulation
    lfo.frequency.value = 8; // 8 Hz modulation
    lfoGain.gain.value = 30; // Modulation depth
    
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);
    
    // Main oscillator
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 180; // Base frequency
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
    
    lfo.start(audioContext.currentTime);
    oscillator.start(audioContext.currentTime);
    lfo.stop(audioContext.currentTime + 0.8);
    oscillator.stop(audioContext.currentTime + 0.8);
  };

  const playTickTock = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const triggerError = (participantId: string) => {
    setErrorParticipantId(participantId);
    playBuzzer();
    setTimeout(() => setErrorParticipantId(null), 600);
  };

  // Timer effect for meeting mode
  useEffect(() => {
    if (mode === "meeting") {
      timerIntervalRef.current = setInterval(() => {
        setMeetingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [mode]);

  // Speaking timer effect for meeting mode
  useEffect(() => {
    if (mode === "meeting" && focusedIndex >= 0) {
      // Save speaking time for previous participant
      if (speakingStartTime !== null && participants[focusedIndex]) {
        const prevParticipantId = participants[focusedIndex].id;
        setParticipantSpeakingTimes((prev) => ({
          ...prev,
          [prevParticipantId]: (prev[prevParticipantId] || 0) + speakingDuration,
        }));
      }
      
      // Start tracking speaking time when focused participant changes
      setSpeakingStartTime(Date.now());
      setSpeakingDuration(0);
      
      speakingTimerRef.current = setInterval(() => {
        setSpeakingDuration((prev) => prev + 1);
      }, 1000);
      
      // Clear tick-tock interval when speaker changes
      if (tickTockIntervalRef.current) {
        clearInterval(tickTockIntervalRef.current);
        tickTockIntervalRef.current = null;
      }
    } else {
      // Save final speaking time when exiting meeting mode
      if (mode !== "meeting" && speakingStartTime !== null && participants[focusedIndex]) {
        const currentParticipantId = participants[focusedIndex].id;
        setParticipantSpeakingTimes((prev) => ({
          ...prev,
          [currentParticipantId]: (prev[currentParticipantId] || 0) + speakingDuration,
        }));
      }
      
      setSpeakingStartTime(null);
      setSpeakingDuration(0);
      if (speakingTimerRef.current) {
        clearInterval(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
      if (tickTockIntervalRef.current) {
        clearInterval(tickTockIntervalRef.current);
        tickTockIntervalRef.current = null;
      }
    }

    return () => {
      if (speakingTimerRef.current) {
        clearInterval(speakingTimerRef.current);
      }
      if (tickTockIntervalRef.current) {
        clearInterval(tickTockIntervalRef.current);
      }
    };
  }, [mode, focusedIndex]);

  // Tick-tock sound effect when speaking over overtime threshold
  useEffect(() => {
    if (mode === "meeting" && speakingDuration > overtimeThreshold) {
      if (!tickTockIntervalRef.current) {
        // Play immediately
        playTickTock();
        // Then play every 2 seconds
        tickTockIntervalRef.current = setInterval(() => {
          playTickTock();
        }, 2000);
      }
    } else {
      if (tickTockIntervalRef.current) {
        clearInterval(tickTockIntervalRef.current);
        tickTockIntervalRef.current = null;
      }
    }

    return () => {
      if (tickTockIntervalRef.current) {
        clearInterval(tickTockIntervalRef.current);
      }
    };
  }, [mode, speakingDuration, overtimeThreshold]);

  // Meeting summary auto-close timer
  useEffect(() => {
    if (showMeetingSummary) {
      setSummaryCloseTimer(10);
      summaryTimerRef.current = setInterval(() => {
        setSummaryCloseTimer((prev) => {
          if (prev <= 1) {
            setShowMeetingSummary(false);
            if (summaryTimerRef.current) {
              clearInterval(summaryTimerRef.current);
            }
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (summaryTimerRef.current) {
        clearInterval(summaryTimerRef.current);
        summaryTimerRef.current = null;
      }
    }

    return () => {
      if (summaryTimerRef.current) {
        clearInterval(summaryTimerRef.current);
      }
    };
  }, [showMeetingSummary]);

  // Spinning arrow animation when meeting starts (only for fresh meetings)
  useEffect(() => {
    if (mode === "meeting" && !isSpinning && meetingTime === 0 && participants.length > 0) {
      setIsSpinning(true);
      
      // Randomly select from participants who haven't spoken yet
      const eligibleIndices = participants.reduce<number[]>((acc, p, i) => {
        if (!p.hasSpoken) acc.push(i);
        return acc;
      }, []);
      const pool = eligibleIndices.length > 0 ? eligibleIndices : participants.map((_, i) => i);
      const randomIndex = pool[Math.floor(Math.random() * pool.length)];
      
      // Calculate angle to the random participant
      const angle = (360 / participants.length) * randomIndex;
      
      // Animation parameters
      const startTime = Date.now();
      const duration = 3000; // 3 seconds
      const totalSpins = 5; // Number of full rotations
      const totalRotation = 360 * totalSpins + angle;
      
      // Audio setup for spinning sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      
      // Start frequency
      const startFreq = 300;
      const endFreq = 800;
      
      oscillator.frequency.setValueAtTime(startFreq, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      
      oscillator.start(audioContext.currentTime);
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out cubic for smooth deceleration
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        const currentRotation = totalRotation * easeProgress;
        setSpinRotation(currentRotation);
        
        // Update frequency based on progress
        const currentFreq = startFreq + (endFreq - startFreq) * progress;
        oscillator.frequency.setValueAtTime(currentFreq, audioContext.currentTime);
        
        // Fade out sound near the end
        if (progress > 0.9) {
          const fadeProgress = (progress - 0.9) / 0.1;
          gainNode.gain.setValueAtTime(0.15 * (1 - fadeProgress), audioContext.currentTime);
        }
        
        if (progress < 1) {
          spinAnimationRef.current = requestAnimationFrame(animate);
        } else {
          // Stop the spinning sound
          oscillator.stop(audioContext.currentTime);
          
          // Play satisfying 'ding' sound
          const dingOsc1 = audioContext.createOscillator();
          const dingOsc2 = audioContext.createOscillator();
          const dingGain = audioContext.createGain();
          
          dingOsc1.connect(dingGain);
          dingOsc2.connect(dingGain);
          dingGain.connect(audioContext.destination);
          
          // Two frequencies for a richer 'ding' sound
          dingOsc1.frequency.setValueAtTime(1200, audioContext.currentTime);
          dingOsc2.frequency.setValueAtTime(1800, audioContext.currentTime);
          dingOsc1.type = 'sine';
          dingOsc2.type = 'sine';
          
          // Bell-like envelope
          dingGain.gain.setValueAtTime(0.4, audioContext.currentTime);
          dingGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          
          dingOsc1.start(audioContext.currentTime);
          dingOsc2.start(audioContext.currentTime);
          dingOsc1.stop(audioContext.currentTime + 0.5);
          dingOsc2.stop(audioContext.currentTime + 0.5);
          
          // Animation complete - set the focused index
          setFocusedIndex(randomIndex);
          setIsSpinning(false);
          setSpinRotation(0);
        }
      };
      
      animate();
      
      return () => {
        if (spinAnimationRef.current) {
          cancelAnimationFrame(spinAnimationRef.current);
        }
        oscillator.stop();
        audioContext.close();
      };
    }
  }, [mode, participants.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close meeting summary with 'q'
      if (showMeetingSummary && e.key === "q") {
        e.preventDefault();
        setShowMeetingSummary(false);
        return;
      }

      // Don't process other keys if summary is showing
      if (showMeetingSummary) {
        return;
      }

      // Handle 'e' key hold for ending meeting
      if (e.key === "e" && mode === "meeting" && !isSearching && !isEndingMeeting && !e.repeat) {
        setIsEndingMeeting(true);
        setEndMeetingProgress(0);
        
        let progress = 0;
        endMeetingTimerRef.current = setInterval(() => {
          progress += 0.1; // 100ms intervals for 3 seconds = 30 steps
          setEndMeetingProgress(progress);
          
          if (progress >= 3) {
            // 3 seconds completed - execute meeting end
            if (endMeetingTimerRef.current) {
              clearInterval(endMeetingTimerRef.current);
              endMeetingTimerRef.current = null;
            }
            
            // Save final speaking time for current participant
            const currentParticipantId = participants[focusedIndex].id;
            const finalSpeakingTimes = {
              ...participantSpeakingTimes,
              [currentParticipantId]: (participantSpeakingTimes[currentParticipantId] || 0) + speakingDuration,
            };
            
            // Mark current participant as having spoken first
            setParticipants((prev) => {
              const updated = prev.map((p, i) => 
                i === focusedIndex ? { ...p, hasSpoken: true } : p
              );
              
              // Check if all participants have now spoken
              const allSpoken = updated.every((p) => p.hasSpoken);
              
              if (allSpoken) {
                // Success - award point to current participant, prepare summary
                const updatedWithScore = updated.map((p, i) => ({
                  ...p,
                  score: i === focusedIndex ? p.score + 1 : p.score,
                  hasSpoken: false
                }));
                
                // Prepare meeting summary data
                const stats: ParticipantStats[] = updatedWithScore.map((p) => ({
                  id: p.id,
                  name: p.name,
                  score: p.score,
                  speakingTime: finalSpeakingTimes[p.id] || 0,
                  hasOfficeHoursTopic: p.hasOfficeHoursTopic,
                  officeHoursTopicComment: p.officeHoursTopicComment,
                })).sort((a, b) => b.score - a.score);
                
                setMeetingSummaryData({
                  stats,
                  totalTime: meetingTime,
                });
                
                setMode("normal");
                setMeetingTime(0);
                setParticipantSpeakingTimes({});
                if (showAutoSummary) {
                  setShowMeetingSummary(true);
                }
                playSound(1000, 150); // High success sound
                
                return updatedWithScore;
              } else {
                // Failure - not everyone has spoken, apply penalty, revert hasSpoken
                triggerError(prev[focusedIndex].id);
                return prev.map((p, i) => 
                  i === focusedIndex ? { ...p, score: p.score - 1 } : p
                );
              }
            });
            
            setIsEndingMeeting(false);
            setEndMeetingProgress(0);
          }
        }, 100);
        
        return;
      }

      // Handle 'r' key for revealing status
      if (e.key === "r" && !isRevealingStatus && mode === "meeting") {
        setIsRevealingStatus(true);
        return;
      }
      // Handle search overlay (doesn't change mode)
      if (isSearching) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsSearching(false);
          setSearchQuery("");
          setSearchOverlayMode("participant");
          setBonusTopicParticipantId(null);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (searchOverlayMode === "participant") {
            const matchIndex = participants.findIndex((p) =>
              p.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            if (matchIndex !== -1) {
              // Apply meeting mode logic if in meeting mode
              if (mode === "meeting") {
                const targetParticipant = participants[matchIndex];
                if (targetParticipant.hasSpoken) {
                  // Failed selection - penalty, don't move focus
                  setParticipants((prev) =>
                    prev.map((p, i) => (i === focusedIndex ? { ...p, score: p.score - 1 } : p))
                  );
                  triggerError(participants[focusedIndex].id);
                } else {
                  // Successful selection - mark current as spoken and reward
                  setParticipants((prev) =>
                    prev.map((p, i) => 
                      i === focusedIndex 
                        ? { ...p, hasSpoken: true, score: p.score + 1 }
                        : p
                    )
                  );
                  setFocusedIndex(matchIndex);
                  playSound(800, 100); // High success sound
                }
              } else {
                // Normal mode - always move focus
                setFocusedIndex(matchIndex);
              }
            }
          } else if (searchOverlayMode === "bonus-topic" && bonusTopicParticipantId) {
            const topic = searchQuery.trim();
            setParticipants((prev) =>
              prev.map((p) =>
                p.id === bonusTopicParticipantId
                  ? {
                      ...p,
                      hasOfficeHoursTopic: topic.length > 0,
                      officeHoursTopicComment: topic,
                    }
                  : p
              )
            );
            playSound(topic.length > 0 ? 600 : 300, 50);
          }

          setIsSearching(false);
          setSearchQuery("");
          setSearchOverlayMode("participant");
          setBonusTopicParticipantId(null);
        }
        return; // Don't process other keys when searching
      }

      if (mode === "insert") {
        if (e.key === "Escape") {
          e.preventDefault();
          if (editValue.trim()) {
            setParticipants((prev) =>
              prev.map((p, i) =>
                i === focusedIndex ? { ...p, name: editValue.trim() } : p
              )
            );
          }
          setMode("normal");
          setEditValue("");
        }
        return;
      }

      // Normal and meeting mode commands
      if (e.key === "/") {
        e.preventDefault();
        setSearchOverlayMode("participant");
        setBonusTopicParticipantId(null);
        setIsSearching(true);
        setSearchQuery("");
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else if (e.key === "i") {
        e.preventDefault();
        setMode("insert");
        setEditValue(participants[focusedIndex]?.name || "");
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (e.key === "o") {
        e.preventDefault();
        const newId = Date.now().toString();
        setParticipants((prev) => [...prev, { id: newId, name: "", score: 0, hasSpoken: false, hasOfficeHoursTopic: false, officeHoursTopicComment: "" }]);
        setFocusedIndex(participants.length);
        setMode("insert");
        setEditValue("");
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (e.key === "m") {
        e.preventDefault();
        if (mode === "meeting") {
          setMode("normal");
          setIsSpinning(false);
          setSpinRotation(0);
          playSound(400, 100);
        } else {
          if (meetingTime === 0) {
            // Fresh meeting start: clear previous meeting's bonus topics.
            setParticipants((prev) =>
              prev.map((p) => ({ ...p, hasOfficeHoursTopic: false, officeHoursTopicComment: "" }))
            );
          }
          setMode("meeting");
          playSound(800, 100);
        }
      } else if (e.key === "s" && !e.ctrlKey) {
        e.preventDefault();
        setParticipants((prev) =>
          prev.map((p, i) => (i === focusedIndex ? { ...p, hasSpoken: !p.hasSpoken } : p))
        );
        playSound(500, 50);
      } else if (e.key === "f") {
        e.preventDefault();
        if (mode === "meeting" && participants[focusedIndex]) {
          const participant = participants[focusedIndex];
          setSearchOverlayMode("bonus-topic");
          setBonusTopicParticipantId(participant.id);
          setSearchQuery(participant.officeHoursTopicComment);
          setIsSearching(true);
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }
      } else if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (mode === "meeting") {
          setMode("normal");
          setMeetingTime(0);
          setParticipantSpeakingTimes({});
          setParticipants((prev) => prev.map((p) => ({ ...p, hasSpoken: false, hasOfficeHoursTopic: false, officeHoursTopicComment: "" })));
          playSound(700, 100);
        } else {
          setParticipants((prev) => prev.map((p) => ({ ...p, hasSpoken: false })));
          playSound(700, 100);
        }
      } else if (e.key === "j") {
        e.preventDefault();
        const nextIndex = (focusedIndex + 1) % participants.length;
        
        if (mode === "meeting") {
          const targetParticipant = participants[nextIndex];
          if (targetParticipant.hasSpoken) {
            // Failed selection - penalty
            setParticipants((prev) =>
              prev.map((p, i) => (i === focusedIndex ? { ...p, score: p.score - 1 } : p))
            );
            triggerError(participants[focusedIndex].id);
          } else {
            // Successful selection - mark current as spoken and reward
            setParticipants((prev) =>
              prev.map((p, i) => 
                i === focusedIndex 
                  ? { ...p, hasSpoken: true, score: p.score + 1 }
                  : p
              )
            );
            setFocusedIndex(nextIndex);
            playSound(800, 100); // High success sound
          }
        } else {
          setFocusedIndex(nextIndex);
          playSound(400, 30);
        }
      } else if (e.key === "k") {
        e.preventDefault();
        const prevIndex = (focusedIndex - 1 + participants.length) % participants.length;
        
        if (mode === "meeting") {
          const targetParticipant = participants[prevIndex];
          if (targetParticipant.hasSpoken) {
            // Failed selection - penalty
            setParticipants((prev) =>
              prev.map((p, i) => (i === focusedIndex ? { ...p, score: p.score - 1 } : p))
            );
            triggerError(participants[focusedIndex].id);
          } else {
            // Successful selection - mark current as spoken and reward
            setParticipants((prev) =>
              prev.map((p, i) => 
                i === focusedIndex 
                  ? { ...p, hasSpoken: true, score: p.score + 1 }
                  : p
              )
            );
            setFocusedIndex(prevIndex);
            playSound(800, 100); // High success sound
          }
        } else {
          setFocusedIndex(prevIndex);
          playSound(400, 30);
        }
      } else if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        if (participants.length > 1) {
          setParticipants((prev) => prev.filter((_, i) => i !== focusedIndex));
          setFocusedIndex((prev) => Math.min(prev, participants.length - 2));
        }
      } else if (e.key === "a") {
        e.preventDefault();
        setParticipants((prev) =>
          prev.map((p, i) => (i === focusedIndex ? { ...p, score: p.score + 1 } : p))
        );
        playSound(600, 80);
      } else if (e.key === "x") {
        e.preventDefault();
        setParticipants((prev) =>
          prev.map((p, i) => (i === focusedIndex ? { ...p, score: p.score - 1 } : p))
        );
        playSound(300, 80);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "r" && isRevealingStatus) {
        setIsRevealingStatus(false);
      }
      
      // Cancel meeting end if 'e' is released early
      if (e.key === "e" && isEndingMeeting) {
        if (endMeetingTimerRef.current) {
          clearInterval(endMeetingTimerRef.current);
          endMeetingTimerRef.current = null;
        }
        setIsEndingMeeting(false);
        setEndMeetingProgress(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode, focusedIndex, participants, editValue, isSearching, searchQuery, searchOverlayMode, bonusTopicParticipantId, isRevealingStatus, showMeetingSummary, meetingTime, participantSpeakingTimes, speakingDuration, isEndingMeeting]);

  // Calculate angle for arrow rotation to point at focused participant
  const angleToFocused = participants.length > 0 
    ? (focusedIndex / participants.length) * 360 
    : 0;

  // Filter participants based on search query
  const matchesSearch = (name: string) => {
    if (!isSearching || searchOverlayMode !== "participant" || !searchQuery) return false;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const bonusTopicParticipants = participants.filter((p) => p.hasOfficeHoursTopic);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleParticipantClick = (clickedIndex: number) => {
    if (mode !== "meeting" || clickedIndex === focusedIndex) {
      return;
    }

    const targetParticipant = participants[clickedIndex];
    if (targetParticipant.hasSpoken) {
      // Failed selection - penalty
      setParticipants((prev) =>
        prev.map((p, i) => (i === focusedIndex ? { ...p, score: p.score - 1 } : p))
      );
      triggerError(participants[focusedIndex].id);
    } else {
      // Successful selection - mark current as spoken and reward
      setParticipants((prev) =>
        prev.map((p, i) => 
          i === focusedIndex 
            ? { ...p, hasSpoken: true, score: p.score + 1 }
            : p
        )
      );
      setFocusedIndex(clickedIndex);
      playSound(800, 100); // High success sound
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Standup Popcorn Leaderboard
            </h1>
            <p className="mt-2 text-muted-foreground">
              Track your team's standup performance
            </p>
          </div>
          <div className="flex items-center gap-4">
            {mode === "meeting" && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2">
                <span className="font-mono text-lg font-bold text-orange-500">
                  {formatTime(meetingTime)}
                </span>
              </div>
            )}
            {mode !== "meeting" && meetingTime > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-500/50 bg-orange-500/20 px-4 py-2 animate-pulse">
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                  MEETING PAUSED
                </span>
                <span className="font-mono text-sm font-bold text-orange-500">
                  {formatTime(meetingTime)}
                </span>
                <span className="text-xs text-muted-foreground">
                  (Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">m</kbd> to resume)
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
              <div className={`h-2 w-2 rounded-full animate-pulse ${
                mode === "meeting" ? "bg-orange-500" : "bg-primary"
              }`} />
              <span className="font-mono text-sm font-medium text-card-foreground">
                {mode === "normal" ? "NORMAL" : mode === "insert" ? "INSERT" : "MEETING"}
              </span>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Keyboard Commands</DialogTitle>
                  <DialogDescription>
                    Control the leaderboard with these vim-style keyboard shortcuts
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 font-semibold">Navigation</h3>
                    <div className="space-y-1 text-sm">
                      <p><kbd className="rounded bg-muted px-2 py-1">j</kbd> - Move down</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">k</kbd> - Move up</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">/pattern</kbd> - Search and jump to participant</p>
                    </div>
                  </div>
                  <div>
                     <h3 className="mb-2 font-semibold">Meeting Mode</h3>
                     <div className="space-y-1 text-sm">
                       <p><kbd className="rounded bg-muted px-2 py-1">m</kbd> - Toggle meeting mode</p>
                       <p><kbd className="rounded bg-muted px-2 py-1">r</kbd> - Hold to reveal speaking status</p>
                       <p><kbd className="rounded bg-muted px-2 py-1">s</kbd> - Toggle speaking status</p>
                       <p><kbd className="rounded bg-muted px-2 py-1">f</kbd> - Add/edit bonus time topic</p>
                       <p><kbd className="rounded bg-muted px-2 py-1">e (hold 3s)</kbd> - End meeting (awards +1 if all spoke, -1 if not)</p>
                       <p><kbd className="rounded bg-muted px-2 py-1">Ctrl+S</kbd> - Exit meeting mode and reset</p>
                       <p className="text-muted-foreground text-xs mt-1">In meeting mode, j/k auto-scores based on popcorn success. Timer tracks meeting duration.</p>
                     </div>
                   </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Editing</h3>
                    <div className="space-y-1 text-sm">
                      <p><kbd className="rounded bg-muted px-2 py-1">i</kbd> - Edit participant name</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">o</kbd> - Add new participant</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">Ctrl+D</kbd> - Delete participant</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">ESC</kbd> - Exit insert mode</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Scoring</h3>
                    <div className="space-y-1 text-sm">
                      <p><kbd className="rounded bg-muted px-2 py-1">A</kbd> - Add point (+1)</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">X</kbd> - Remove point (-1)</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <h3 className="mb-2 font-semibold text-sm">Scoring Rules</h3>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>✅ Successfully popcorn to unspoken person: +1</p>
                      <p>✅ Recognize you're the last speaker: +1</p>
                      <p>❌ Popcorn to someone who already spoke: -1</p>
                      <p>❌ Don't select next speaker: -1</p>
                      <p>❌ Don't recognize you're last: -1</p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                  <DialogDescription>
                    Configure meeting behavior and preferences
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="overtime-threshold">
                      Overtime Threshold (seconds)
                    </Label>
                    <Input
                      id="overtime-threshold"
                      type="number"
                      min="10"
                      max="300"
                      value={overtimeThreshold}
                      onChange={(e) => setOvertimeThreshold(parseInt(e.target.value) || 30)}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground">
                      Time before the overtime indicator appears during speaking
                    </p>
                  </div>
                  <div className="flex items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-summary">
                        Auto-show Summary
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically display meeting summary when ending a meeting
                      </p>
                    </div>
                    <Switch
                      id="auto-summary"
                      checked={showAutoSummary}
                      onCheckedChange={setShowAutoSummary}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative aspect-square w-full max-w-4xl mx-auto">
          {participants.length === 0 ? (
            <Card className="flex h-full items-center justify-center border-2 border-border bg-card shadow-lg">
              <div className="text-center text-muted-foreground">
                No participants yet. Press <kbd className="rounded bg-muted px-2 py-1">o</kbd> to add one.
              </div>
            </Card>
          ) : (
            <>
              {/* Participants in a circle */}
              {participants.map((participant, index) => {
                const angle = (index / participants.length) * 2 * Math.PI - Math.PI / 2;
                const radius = 42; // percentage
                const x = 50 + radius * Math.cos(angle);
                const y = 50 + radius * Math.sin(angle);
                const isFocused = index === focusedIndex;
                const isEditing = isFocused && mode === "insert";
                const hasError = errorParticipantId === participant.id;
                const isSearchMatch = matchesSearch(participant.name);
                const isOvertime = isFocused && mode === "meeting" && speakingDuration > overtimeThreshold;

                return (
                  <div
                    key={participant.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div
                      className={`flex flex-col items-center gap-2 transition-all ${
                        isFocused ? "scale-110" : ""
                      } ${hasError ? "animate-shake" : ""} ${
                        mode === "meeting" && !isFocused ? "cursor-pointer hover:scale-105" : ""
                      }`}
                      onClick={() => handleParticipantClick(index)}
                    >
                      <div className="relative">
                        <div
                          className={`flex h-24 w-24 items-center justify-center rounded-lg text-3xl font-bold transition-all ${
                            isFocused
                              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[var(--shadow-focus)] ring-4 ring-primary/50"
                              : isSearchMatch
                              ? "bg-accent/50 border-2 border-accent text-accent-foreground ring-2 ring-accent/30"
                              : "bg-card border-2 border-border text-card-foreground"
                          } ${
                            participant.hasSpoken && (mode !== "meeting" || isRevealingStatus) ? "opacity-50 transition-opacity duration-200" : ""
                          } ${hasError ? "animate-flash-red" : ""} ${
                            isOvertime ? "ring-4 ring-orange-500 animate-pulse" : ""
                          }`}
                        >
                          {getInitials(participant.name)}
                        </div>
                        {isOvertime && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse whitespace-nowrap">
                            {Math.floor(speakingDuration / 60)}:{(speakingDuration % 60).toString().padStart(2, '0')}
                          </div>
                        )}
                        {participant.hasSpoken && (mode !== "meeting" || isRevealingStatus) && (
                          <div className={`absolute -top-2 -right-2 h-6 w-6 rounded-full bg-green-500 border-2 border-background flex items-center justify-center transition-opacity duration-200 ${
                            mode === "meeting" && !isRevealingStatus ? "opacity-0" : "opacity-100"
                          }`}>
                            <span className="text-xs text-white font-bold">✓</span>
                          </div>
                        )}
                        {participant.hasOfficeHoursTopic && mode === "meeting" && (
                          <div className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full bg-blue-500 border-2 border-background flex items-center justify-center">
                            <span className="text-xs text-white font-bold">📋</span>
                          </div>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-32 rounded-md border-2 border-primary bg-background px-2 py-1 text-center text-sm font-semibold text-foreground outline-none"
                          placeholder="Enter name..."
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-foreground max-w-32 truncate">
                            {participant.name || "(unnamed)"}
                          </p>
                          {mode !== "meeting" && (
                            <div
                              className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-bold ${
                                participant.score > 0
                                  ? "bg-success/10 text-success"
                                  : participant.score < 0
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {participant.score > 0 && <Plus className="h-3 w-3" />}
                              {participant.score < 0 && <Minus className="h-3 w-3" />}
                              {participant.score}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Center arrow */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div
                  className={`${isSpinning ? "" : "transition-transform duration-500 ease-out"} ${errorParticipantId ? "animate-arrow-bounce" : ""}`}
                  style={{ 
                    transform: `rotate(${isSpinning ? spinRotation : angleToFocused}deg)`,
                    '--arrow-angle': `${angleToFocused}deg`
                  } as React.CSSProperties}
                >
                  <ArrowUp className="h-32 w-32 text-orange-500 drop-shadow-lg" strokeWidth={2.5} />
                </div>
              </div>
            </>
          )}
        </div>

        {bonusTopicParticipants.length > 0 && (
          <div className="mt-6 mx-auto max-w-3xl">
            <Card className="border-2 border-blue-500/30 bg-blue-500/10 p-4">
              <h3 className="text-sm font-semibold text-foreground">Bonus Time Topics</h3>
              <div className="mt-3 space-y-2">
                {bonusTopicParticipants.map((participant) => (
                  <div key={participant.id} className="text-sm">
                    <span className="font-medium text-foreground">
                      {participant.name || "(unnamed)"}:
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {participant.officeHoursTopicComment || "No topic entered yet"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span>Press <kbd className="rounded bg-muted px-2 py-1">j/k</kbd> to navigate</span>
            <span>•</span>
            <span>Press <kbd className="rounded bg-muted px-2 py-1">/</kbd> to search</span>
            <span>•</span>
            <span>Press <kbd className="rounded bg-muted px-2 py-1">a/x</kbd> to score</span>
          </div>
        </div>

        {/* Search overlay */}
        {isSearching && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-end justify-center pb-16 z-50">
            <div className="w-full max-w-md animate-in slide-in-from-bottom-4 duration-200">
              <div className="rounded-lg border-2 border-primary bg-card px-6 py-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-primary font-mono text-lg">
                    {searchOverlayMode === "participant" ? "/" : "f"}
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-foreground font-mono text-lg placeholder:text-muted-foreground"
                    placeholder={searchOverlayMode === "participant" ? "Search participant..." : "Enter bonus time topic..."}
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground">
                    ESC to cancel
                  </span>
                </div>
                {searchOverlayMode === "participant" && searchQuery && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {participants.filter(p => matchesSearch(p.name)).length} match(es) found
                  </div>
                )}
                {searchOverlayMode === "bonus-topic" && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Press Enter to save topic. Submit empty text to clear the bonus flag.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* End Meeting Confirmation */}
        {isEndingMeeting && (
          <div className="fixed inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
            <div className="w-full max-w-md mx-4">
              <Card className="border-2 border-orange-500 bg-card shadow-2xl p-6">
                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-bold text-foreground">Ending Meeting...</h3>
                  <p className="text-sm text-muted-foreground">
                    Hold <kbd className="rounded bg-muted px-2 py-1 font-mono">e</kbd> for {Math.ceil(3 - endMeetingProgress)} more seconds
                  </p>
                  <p className="text-xs text-orange-500 font-semibold">
                    ⚠️ Will fail if not everyone has spoken
                  </p>
                  
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 transition-all duration-100 ease-linear"
                        style={{ width: `${(endMeetingProgress / 3) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Release to cancel
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Meeting Summary */}
        {showMeetingSummary && meetingSummaryData && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
            <div className="w-full max-w-3xl mx-4 animate-scale-in">
              <Card className="border-2 border-primary bg-card shadow-2xl overflow-hidden">
                <div className="p-8">
                  <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold text-foreground mb-2">Meeting Summary</h2>
                    <p className="text-muted-foreground">
                      Total Duration: {Math.floor(meetingSummaryData.totalTime / 60)}:{(meetingSummaryData.totalTime % 60).toString().padStart(2, "0")}
                    </p>
                  </div>

                  <div className="space-y-4 mb-6">
                    {meetingSummaryData.stats.map((stat, index) => {
                      const isOvertime = stat.speakingTime > overtimeThreshold;
                      const maxSpeakingTime = Math.max(...meetingSummaryData.stats.map(s => s.speakingTime));
                      const barWidth = maxSpeakingTime > 0 ? (stat.speakingTime / maxSpeakingTime) * 100 : 0;
                      
                      return (
                        <div key={stat.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`text-2xl font-bold ${
                                index === 0 ? "text-yellow-500" :
                                index === 1 ? "text-gray-400" :
                                index === 2 ? "text-orange-600" :
                                "text-muted-foreground"
                              }`}>
                                #{index + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-foreground">{stat.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Score: {stat.score} • Speaking: {Math.floor(stat.speakingTime / 60)}:{(stat.speakingTime % 60).toString().padStart(2, "0")}
                                </p>
                              </div>
                            </div>
                            {isOvertime && (
                              <span className="text-xs bg-orange-500/20 text-orange-500 px-2 py-1 rounded font-semibold">
                                Overtime
                              </span>
                            )}
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                isOvertime ? "bg-orange-500" : "bg-primary"
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {meetingSummaryData.stats.some(s => s.hasOfficeHoursTopic) && (
                    <div className="mb-6 p-4 rounded-lg border-2 border-blue-500/30 bg-blue-500/10">
                      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <span className="text-blue-500">📋</span> Bonus Time Topics
                      </h3>
                      <div className="space-y-2">
                        {meetingSummaryData.stats
                          .filter(s => s.hasOfficeHoursTopic)
                          .map(stat => (
                            <div key={stat.id} className="text-sm">
                              <span className="font-medium text-foreground">{stat.name}:</span>
                              <span className="ml-2 text-muted-foreground">
                                {stat.officeHoursTopicComment || "No topic entered"}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="text-center text-sm text-muted-foreground mb-4">
                    Press <kbd className="rounded bg-muted px-2 py-1">q</kbd> to close
                  </div>
                </div>

                {/* Countdown timer bar */}
                <div className="h-2 bg-muted relative overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-linear"
                    style={{ width: `${(summaryCloseTimer / 10) * 100}%` }}
                  />
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
