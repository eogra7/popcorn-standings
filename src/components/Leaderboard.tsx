import { useState, useEffect, useRef } from "react";
import { Plus, Minus, Info, ArrowUp } from "lucide-react";
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
};

type Mode = "normal" | "insert" | "meeting";

const Leaderboard = () => {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "1", name: "Alice", score: 0, hasSpoken: false },
    { id: "2", name: "Bob", score: 0, hasSpoken: false },
    { id: "3", name: "Charlie", score: 0, hasSpoken: false },
  ]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("normal");
  const [editValue, setEditValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorParticipantId, setErrorParticipantId] = useState<string | null>(null);
  const [meetingTime, setMeetingTime] = useState(0);
  const [isRevealingStatus, setIsRevealingStatus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        } else if (e.key === "Enter") {
          e.preventDefault();
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
          setIsSearching(false);
          setSearchQuery("");
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
        setParticipants((prev) => [...prev, { id: newId, name: "", score: 0, hasSpoken: false }]);
        setFocusedIndex(participants.length);
        setMode("insert");
        setEditValue("");
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (e.key === "m") {
        e.preventDefault();
        setMode((prev) => prev === "meeting" ? "normal" : "meeting");
        playSound(mode === "meeting" ? 400 : 800, 100);
      } else if (e.key === "s" && !e.ctrlKey) {
        e.preventDefault();
        setParticipants((prev) =>
          prev.map((p, i) => (i === focusedIndex ? { ...p, hasSpoken: !p.hasSpoken } : p))
        );
        playSound(500, 50);
      } else if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (mode === "meeting") {
          setMode("normal");
          setMeetingTime(0);
          setParticipants((prev) => prev.map((p) => ({ ...p, hasSpoken: false })));
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
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode, focusedIndex, participants, editValue, isSearching, searchQuery, isRevealingStatus]);

  // Calculate angle for arrow rotation to point at focused participant
  const angleToFocused = participants.length > 0 
    ? (focusedIndex / participants.length) * 360 
    : 0;

  // Filter participants based on search query
  const matchesSearch = (name: string) => {
    if (!isSearching || !searchQuery) return false;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

                return (
                  <div
                    key={participant.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div
                      className={`flex flex-col items-center gap-2 transition-all ${
                        isFocused ? "scale-110" : ""
                      } ${hasError ? "animate-shake" : ""}`}
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
                            participant.hasSpoken ? "opacity-50" : ""
                          } ${hasError ? "animate-flash-red" : ""}`}
                        >
                          {getInitials(participant.name)}
                        </div>
                        {participant.hasSpoken && (mode !== "meeting" || isRevealingStatus) && (
                          <div className={`absolute -top-2 -right-2 h-6 w-6 rounded-full bg-green-500 border-2 border-background flex items-center justify-center transition-opacity duration-200 ${
                            mode === "meeting" && !isRevealingStatus ? "opacity-0" : "opacity-100"
                          }`}>
                            <span className="text-xs text-white font-bold">✓</span>
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Center arrow */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div
                  className={`transition-transform duration-500 ease-out ${errorParticipantId ? "animate-arrow-bounce" : ""}`}
                  style={{ 
                    transform: `rotate(${angleToFocused}deg)`,
                    '--arrow-angle': `${angleToFocused}deg`
                  } as React.CSSProperties}
                >
                  <ArrowUp className="h-32 w-32 text-orange-500 drop-shadow-lg" strokeWidth={2.5} />
                </div>
              </div>
            </>
          )}
        </div>

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
                  <span className="text-primary font-mono text-lg">/</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-foreground font-mono text-lg placeholder:text-muted-foreground"
                    placeholder="Search participant..."
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground">
                    ESC to cancel
                  </span>
                </div>
                {searchQuery && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {participants.filter(p => matchesSearch(p.name)).length} match(es) found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
