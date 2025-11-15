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
};

type Mode = "normal" | "insert";

const Leaderboard = () => {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "1", name: "Alice", score: 0 },
    { id: "2", name: "Bob", score: 0 },
    { id: "3", name: "Charlie", score: 0 },
  ]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("normal");
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      // Normal mode commands
      if (e.key === "i") {
        e.preventDefault();
        setMode("insert");
        setEditValue(participants[focusedIndex]?.name || "");
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (e.key === "o") {
        e.preventDefault();
        const newId = Date.now().toString();
        setParticipants((prev) => [...prev, { id: newId, name: "", score: 0 }]);
        setFocusedIndex(participants.length);
        setMode("insert");
        setEditValue("");
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (e.key === "j") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, participants.length - 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "d") {
        e.preventDefault();
        if (participants.length > 1) {
          setParticipants((prev) => prev.filter((_, i) => i !== focusedIndex));
          setFocusedIndex((prev) => Math.min(prev, participants.length - 2));
        }
      } else if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        setParticipants((prev) =>
          prev.map((p, i) => (i === focusedIndex ? { ...p, score: p.score + 1 } : p))
        );
      } else if (e.ctrlKey && e.key === "x") {
        e.preventDefault();
        setParticipants((prev) =>
          prev.map((p, i) => (i === focusedIndex ? { ...p, score: p.score - 1 } : p))
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, focusedIndex, participants, editValue]);

  // Calculate angle for arrow rotation to point at focused participant
  const angleToFocused = participants.length > 0 
    ? (focusedIndex / participants.length) * 360 
    : 0;

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
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-sm font-medium text-card-foreground">
                {mode === "normal" ? "NORMAL" : "INSERT"}
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
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Editing</h3>
                    <div className="space-y-1 text-sm">
                      <p><kbd className="rounded bg-muted px-2 py-1">i</kbd> - Edit participant name</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">o</kbd> - Add new participant</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">d</kbd> - Delete participant</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">ESC</kbd> - Exit insert mode</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Scoring</h3>
                    <div className="space-y-1 text-sm">
                      <p><kbd className="rounded bg-muted px-2 py-1">Ctrl+A</kbd> - Add point (+1)</p>
                      <p><kbd className="rounded bg-muted px-2 py-1">Ctrl+X</kbd> - Remove point (-1)</p>
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

                return (
                  <div
                    key={participant.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div
                      className={`flex flex-col items-center gap-2 transition-all ${
                        isFocused ? "scale-110" : ""
                      }`}
                    >
                      <div
                        className={`flex h-24 w-24 items-center justify-center rounded-lg text-3xl font-bold transition-all ${
                          isFocused
                            ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[var(--shadow-focus)] ring-4 ring-primary/50"
                            : "bg-card border-2 border-border text-card-foreground"
                        }`}
                      >
                        {getInitials(participant.name)}
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
                  className="transition-transform duration-500 ease-out"
                  style={{ transform: `rotate(${angleToFocused}deg)` }}
                >
                  <ArrowUp className="h-16 w-16 text-primary drop-shadow-lg" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-center gap-4 text-sm text-muted-foreground">
          <span>Press <kbd className="rounded bg-muted px-2 py-1">j/k</kbd> to navigate</span>
          <span>•</span>
          <span>Press <kbd className="rounded bg-muted px-2 py-1">i</kbd> to edit</span>
          <span>•</span>
          <span>Press <kbd className="rounded bg-muted px-2 py-1">Ctrl+A/X</kbd> to score</span>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
